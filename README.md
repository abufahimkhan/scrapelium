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
3. Set **Root Directory** to `apps/web`.
4. Set **Build Command** to `pnpm build:vercel`.
5. Set **Output Directory** to `out`.
6. Keep **Install Command** as `pnpm install --frozen-lockfile`.
7. Deploy. The first page is `https://your-project.vercel.app/download`.
8. Upload the generated installers from `src-tauri/target/release/bundle` to a GitHub Release. The Windows button points directly to the `.exe`; macOS and Linux currently use the release page until those installers are published.

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

## Cloudinary Image Mirroring

Cloudinary mirroring is optional. When enabled, Scrapelium copies the product images it discovers into your own Cloudinary account and replaces the original store image URLs in the resulting product data with Cloudinary HTTPS URLs.

### Connect a Cloudinary account

1. Open the Scrapelium workspace.
2. Select **Cloudinary Mirror**.
3. Enter the Cloudinary account's **Cloud name**, **API key**, and **API secret**.
4. Select **Validate & connect**.

Scrapelium sends the credentials only to its backend running locally on your computer. The backend calls Cloudinary's API to verify that the credentials work before saving them. The API key and API secret are encrypted locally with AES-256-GCM, and the encryption key is stored separately in the operating system's application-data directory. Scrapelium does not send these credentials to the Scrapelium website or to a Scrapelium cloud server.

This is an API-credential connection rather than a Cloudinary web login or OAuth window. Cloudinary credentials are available from the API Keys section of the Cloudinary Console and should never be shared or committed to this repository.

### Scrape and mirror images

1. Enter the storefront URL and page limit.
2. Enable **Cloudinary mirror**.
3. Start the scan.

During the scan, Scrapelium discovers product pages and extracts their names, descriptions, prices, currencies, SKUs, product URLs, and image URLs. For every discovered image, the local backend uses the active encrypted Cloudinary account to perform an authenticated upload. Cloudinary downloads the source image, stores it in your Media Library, and returns a secure URL. Scrapelium then uses that URL in the product record:

```text
Store image URL
    -> Scrapelium local backend
    -> Your Cloudinary account
    -> Cloudinary secure HTTPS URL
    -> Scrapelium product record and exports
```

Image uploads use a global concurrency limit of three. If an individual image cannot be uploaded, the scrape continues and that image keeps its original store URL. Successfully mirrored images keep their Cloudinary URLs.

### Product exports

JSON, CSV, and XLSX exports contain the resulting Cloudinary URLs. For example:

```json
{
  "name": "Example product",
  "images": [
    "https://res.cloudinary.com/your-cloud/image/upload/..."
  ]
}
```

The exported image continues to load from Cloudinary independently of Scrapelium as long as the asset remains available in your Cloudinary account.

### Logout or switch accounts

Select **Logout / Switch Account** to clear the active Cloudinary credentials from Scrapelium's local database. You can then connect another Cloudinary account or use Google Cloud Storage instead. Logging out does not delete images already uploaded to Cloudinary, and deleting products from Scrapelium does not remove their Cloudinary assets.

### Current behavior and limits

- Uploads count against your Cloudinary storage, bandwidth, and transformation allowance.
- Repeating the same scrape can create duplicate Cloudinary assets because automatic deduplication is not currently implemented.
- Uploaded images currently use Cloudinary-generated identifiers and are not organized into storefront or product folders.
- If the local encryption key is deleted, saved credentials cannot be decrypted and the account must be connected again.
- Cloudinary credentials are tied to the active local workspace. They are not bundled into installers or exported product files.

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
