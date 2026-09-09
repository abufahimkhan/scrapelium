import {
  ScrapeOptionsSchema,
  type Product,
  type ScrapeOptions,
} from "../types/product.js";
import { discoverSitemapUrls } from "./sitemap.js";
import { fetchRobotsRules, isPathAllowed } from "./robots.js";
import {
  CRAWL_CONCURRENCY,
  crawlAndExtract,
  fetchProductFromUrl,
  prioritizeProductUrls,
} from "./crawler.js";
import { runInBatches } from "./concurrency.js";
import { uploadProductImages } from "./images.js";
import { createProductsDb, insertProducts } from "./db.js";
import { launchScraperBrowser } from "./browser.js";

export interface ScrapeResult {
  products: Product[];
  pagesVisited: number;
  source: "sitemap" | "crawl";
}

export async function scrapeSite(
  rawOptions: Partial<ScrapeOptions> & { baseUrl: string },
  uploadImage?: (url: string) => Promise<string>,
): Promise<ScrapeResult> {
  const options = ScrapeOptionsSchema.parse(rawOptions);
  const entryUrl = new URL(options.baseUrl);
  const origin = entryUrl.origin;
  const robots = await fetchRobotsRules(origin);

  // A category, catalog, or search URL expresses a narrower user intent than the
  // site's global sitemap. Crawl that exact page instead of returning unrelated products.
  const useSitemap = entryUrl.pathname === "/" && entryUrl.search === "";
  const rawSitemapUrls = useSitemap
    ? await discoverSitemapUrls(origin, Math.min(options.maxPages * 5, 500))
    : [];
  const allowedSitemapUrls = rawSitemapUrls.filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === origin && isPathAllowed(parsed.pathname, robots);
    } catch {
      return false;
    }
  });
  const sitemapUrls = prioritizeProductUrls(allowedSitemapUrls).slice(
    0,
    options.maxPages,
  );

  const browser = await launchScraperBrowser();
  let products: Product[] = [];
  let pagesVisited = 0;
  let source: "sitemap" | "crawl" = "sitemap";

  try {
    const context = await browser.newContext();

    if (sitemapUrls.length > 0) {
      const results = await runInBatches(
        sitemapUrls,
        CRAWL_CONCURRENCY,
        (url) => fetchProductFromUrl(context, url),
      );
      pagesVisited = results.length;
      products = results.filter((p): p is Product => p !== null);
    } else {
      source = "crawl";
      const crawlResult = await crawlAndExtract(
        context,
        options,
        robots,
        origin,
      );
      products = crawlResult.products;
      pagesVisited = crawlResult.pagesVisited;
    }
  } finally {
    await browser.close();
  }

  if (options.uploadImages) {
    if (!uploadImage) {
      throw new Error("An active storage account is required to mirror images");
    }
    products = await uploadProductImages(products, uploadImage);
  }

  const db = createProductsDb(options.dbPath);
  insertProducts(db, products);
  db.close();

  return { products, pagesVisited, source };
}
