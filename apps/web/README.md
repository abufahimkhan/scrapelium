# apps/web

Next.js (App Router, TS, Tailwind) single-page UI.

- **Scrape URL** tab: `POST /api/scrape` → polls `GET /api/scrape/:jobId` every 2s → table preview + export.
- **Upload File** tab: `POST /api/import` (.csv/.xlsx/.json) → table preview + export.

Run with `pnpm --filter @scrapelium/web dev` (expects the server on `http://localhost:4000`).
