# Scrapelium

Scrapelium is a local-first e-commerce product scraper. It crawls a store, finds product pages, extracts normalized product data, previews it in a local web app, and exports or re-imports the result. Nothing requires a cloud database or account.

## Install the Desktop App

For normal use, no Node.js, pnpm, or terminal is needed.

1. Visit the [Scrapelium download page](https://github.com/abufahimkhan/scrapelium/releases/latest).
2. Download the installer for Windows, macOS, or Linux.
3. Run the installer and open Scrapelium from your Applications or Start menu.
4. Enter a store URL, select **Start scan**, then export or import product data from the app.

The app stores its session database in your operating system's application-data directory, rather than inside the installation folder.

### Chrome Requirement

The desktop app first tries Playwright Chromium. Because that browser is not currently bundled into the desktop installer, Scrapelium falls back to a system-installed Google Chrome executable. Install Google Chrome before using the scraper in the desktop app. This is a current packaging limitation, not a requirement for the download page or file import/export features.

## What You Need

These requirements apply only when running or building Scrapelium from source.

- Node.js 20 or newer
- pnpm 9 or newer
- A Playwright Chromium browser (installed by the setup command below)

## Install

From the repository root:

```powershell
pnpm install
pnpm --filter @scrapelium/core exec playwright install chromium
pnpm build:core
```

## Run the App

After installation, run this single command from the repository root:

```powershell
pnpm dev
```

Then open http://localhost:3000 in your browser. This starts both the local API on port `4000` and the web app on port `3000`.

To stop both services, press `Ctrl+C` in that terminal.

## Build a Desktop Installer

Desktop installers are built for the operating system you run the command on; cross-compiling is not configured.

```powershell
pnpm install
pnpm tauri:build
```

This command builds the Next static frontend, compiles and stages the Express API with its production dependencies, includes the current platform's Node runtime, then generates the native installer. Tauri output is written under `src-tauri/target/release/bundle`.

For local desktop development:

```powershell
pnpm tauri:dev
```

## Download Landing Page

`/download` is a static Next.js route designed for Vercel. It detects the visitor's operating system and highlights the appropriate installer link. The download links point to the GitHub Releases latest-release URL, where installers can be uploaded after each desktop build.

## Deploy the Download Page to Vercel

Yes: visitors to your Vercel URL can download Scrapelium. The root [vercel.json](vercel.json) builds only the static Next.js site and deliberately excludes `apps/server`, because scraping and SQLite run inside the desktop app rather than Vercel.

1. Push this repository to GitHub.
2. In Vercel, select **Add New Project** and import the repository.
3. Keep the project root directory as the repository root.
4. Deploy. Vercel uses `pnpm build:vercel` and publishes `apps/web/out`.
5. Visit `https://your-project.vercel.app/download` to see the download page.
6. Upload the generated installers from `src-tauri/target/release/bundle` to a GitHub Release. The download buttons already point to the latest release.

The Vercel deployment is a download page only. The main scraper screen requires the local desktop app or `pnpm dev`; it cannot scrape from Vercel because it depends on local Playwright, Express, and SQLite.

## Scrape a Store

1. Open the **Scrape URL** tab.
2. Paste the store's base URL, such as `https://www.scrapingcourse.com/ecommerce/`.
3. Choose the maximum number of pages to visit.
4. Leave **Upload images to Cloudinary** unchecked to keep the original image URLs.
5. Select **Scrape**. The page polls the local job status every two seconds.
6. When the job completes, review the product table and choose **Export JSON**, **Export CSV**, or **Export XLSX**.

The scraper checks `robots.txt`, tries `sitemap.xml` first, and otherwise crawls same-origin links. It prioritizes likely product URLs such as `/product/` links.

## Import a Product File

1. Open the **Upload File** tab.
2. Choose a `.json`, `.csv`, or `.xlsx` product file.
3. Scrapelium validates every row against the shared product schema.
4. Valid products appear in the preview and are available through the export buttons.
5. Invalid rows are listed with their row number and validation error; they are never silently discarded.

Files exported by Scrapelium can be uploaded back into the app. CSV and XLSX files store multiple image URLs as a comma-separated `images` value.

## Optional Cloudinary Image Uploads

Scrapelium can replace extracted image URLs with Cloudinary-hosted URLs through an unsigned upload preset. This is opt-in and needs your own Cloudinary configuration.

Set these environment variables before starting the API:

```powershell
$env:CLOUDINARY_CLOUD_NAME = "your-cloud-name"
$env:CLOUDINARY_UPLOAD_PRESET = "your-unsigned-upload-preset"
```

Then check **Upload images to Cloudinary** before starting a scrape. Image uploads run with a concurrency limit of three. Failed image uploads retain the original image URL rather than failing the scrape.

## Command-Line Scraping

You can scrape and export without the UI:

```powershell
pnpm test:scrape https://www.scrapingcourse.com/ecommerce/ 15 --export=json
pnpm test:scrape https://www.scrapingcourse.com/ecommerce/ 15 --export=csv
pnpm test:scrape https://www.scrapingcourse.com/ecommerce/ 15 --export=xlsx
```

Exports are written to the `output` folder. Add `--upload-images` only after setting the Cloudinary environment variables.

## Local API

- `POST /api/scrape` starts a scrape job.
- `GET /api/scrape/:jobId` returns a job's status and final results.
- `GET /api/products` returns the current product list.
- `POST /api/import` accepts one multipart file field named `file` (`.csv`, `.xlsx`, or `.json`).

The session database lives at `data/app.db`. It is recreated for each scrape and is deliberately not persistent storage.
