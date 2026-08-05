const SCORES_API = "https://gaznat-scores.netlify.app/api/scores";

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    if (event.httpMethod === "GET") {
      const res = await fetch(SCORES_API, { headers: { "Accept": "application/json" } });
      const state = await res.json();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(state.travelNotes || {})
      };
    }

    if (event.httpMethod === "PUT") {
      const incoming = JSON.parse(event.body || "{}");

      const currentRes = await fetch(SCORES_API, { headers: { "Accept": "application/json" } });
      const currentState = await currentRes.json();

      currentState.travelNotes = incoming && typeof incoming === "object" ? incoming : {};

      const saveRes = await fetch(SCORES_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentState)
      });

      if (!saveRes.ok) {
        return {
          statusCode: saveRes.status,
          headers,
          body: JSON.stringify({ error: "Could not save shared notes" })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(currentState.travelNotes)
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Shared notes error" })
    };
  }
};