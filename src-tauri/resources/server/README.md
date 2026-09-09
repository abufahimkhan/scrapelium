# apps/server

Express API (port 4000). `GET /api/products` serves the last-scraped `Product[]`
from the session SQLite DB (`/data/app.db`), cached in memory per request.

Run with `pnpm --filter @scrapelium/server dev`.
