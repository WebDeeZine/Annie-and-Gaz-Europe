Europe 2026 – Netlify package with shared notes and shared day files

Deploy through the existing connected Git repository or upload this ZIP to Netlify.

Shared notes endpoint:
  /api/travel-notes

Shared files endpoint:
  /api/travel-files

Shared day files use Netlify Blobs so they persist across deployments. The package.json dependency must be installed by Netlify during deployment. Each file is limited to 3.5 MB because standard Netlify Function request payloads have a lower effective limit for encoded binary uploads.

The day page now supports:
  • selecting one or several files
  • opening/downloading shared files
  • deleting shared files
  • up to 20 files per itinerary day
