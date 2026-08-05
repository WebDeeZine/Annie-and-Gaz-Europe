const { connectLambda, getStore } = require("@netlify/blobs");
const { randomUUID } = require("node:crypto");

const STORE_NAME = "europe-day-files";
const MAX_FILE_BYTES = 3.5 * 1024 * 1024;
const MAX_FILES_PER_DAY = 20;

function json(statusCode, value, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(value)
  };
}

function validDay(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 27 ? day : null;
}

function safeName(value) {
  return String(value || "file")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .trim()
    .slice(0, 160) || "file";
}

function indexKey(day) {
  return `day-${day}/index.json`;
}

function fileKey(day, id) {
  return `day-${day}/files/${id}`;
}

async function readIndex(store, day) {
  return (await store.get(indexKey(day), { type: "json", consistency: "strong" })) || [];
}

async function writeIndex(store, day, files) {
  await store.setJSON(indexKey(day), files);
}

exports.handler = async (event) => {
  // Lambda-compatible Netlify Functions must initialise the Blobs context
  // from the incoming event before accessing a store.
  connectLambda(event);

  const method = event.httpMethod;
  const params = event.queryStringParameters || {};
  const day = validDay(params.day);
  const store = getStore(STORE_NAME);

  try {
    if (method === "OPTIONS") {
      return { statusCode: 204, headers: { "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
    }

    if (!day) return json(400, { error: "A valid itinerary day is required." });

    if (method === "GET" && params.id) {
      const files = await readIndex(store, day);
      const file = files.find((item) => item.id === params.id);
      if (!file) return json(404, { error: "File not found." });
      const data = await store.get(fileKey(day, file.id), { type: "arrayBuffer", consistency: "strong" });
      if (!data) return json(404, { error: "File data not found." });
      return {
        statusCode: 200,
        isBase64Encoded: true,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          "Cache-Control": "private, max-age=60"
        },
        body: Buffer.from(data).toString("base64")
      };
    }

    if (method === "GET") {
      const files = await readIndex(store, day);
      return json(200, files);
    }

    if (method === "POST") {
      const incoming = JSON.parse(event.body || "{}");
      const name = safeName(incoming.name);
      const type = String(incoming.type || "application/octet-stream").slice(0, 120);
      const base64 = String(incoming.data || "");
      if (!base64) return json(400, { error: "No file data received." });

      const buffer = Buffer.from(base64, "base64");
      if (!buffer.length) return json(400, { error: "The selected file is empty." });
      if (buffer.length > MAX_FILE_BYTES) return json(413, { error: "Files must be 3.5 MB or smaller." });

      const files = await readIndex(store, day);
      if (files.length >= MAX_FILES_PER_DAY) return json(409, { error: `Day ${day} already has the maximum of ${MAX_FILES_PER_DAY} files.` });

      const id = randomUUID();
      const record = { id, name, type, size: buffer.length, uploadedAt: new Date().toISOString() };
      await store.set(fileKey(day, id), buffer, { metadata: { day: String(day), name, type } });
      await writeIndex(store, day, [...files, record]);
      return json(201, record);
    }

    if (method === "DELETE") {
      const id = String(params.id || "");
      if (!id) return json(400, { error: "File id is required." });
      const files = await readIndex(store, day);
      const file = files.find((item) => item.id === id);
      if (!file) return json(404, { error: "File not found." });
      await store.delete(fileKey(day, id));
      await writeIndex(store, day, files.filter((item) => item.id !== id));
      return json(200, { deleted: true });
    }

    return json(405, { error: "Method not allowed." });
  } catch (error) {
    console.error("travel-files", error);
    return json(500, { error: error.message || "Shared files error." });
  }
};
