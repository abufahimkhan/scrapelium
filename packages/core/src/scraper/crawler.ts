import type { BrowserContext, Page } from "playwright";
import {
  ProductSchema,
  type Product,
  type ScrapeOptions,
} from "../types/product.js";
import { isPathAllowed, type RobotsRules } from "./robots.js";
import { detectAndExtractProduct } from "./productDetector.js";

const SKIP_EXTENSIONS =
  /\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|ico|woff2?|mp4)(\?.*)?$/i;
const PRODUCT_PATH_HINTS = [
  "/product/",
  "/products/",
  "/item/",
  "/p/",
  "/shop/",
  "/detail/",
];
export const CRAWL_CONCURRENCY = 4;
const NAV_TIMEOUT_MS = 15000;
const CLIENT_RENDER_SETTLE_MS = 1500;

async function waitForClientRenderedContent(page: Page): Promise<void> {
  await page.waitForTimeout(CLIENT_RENDER_SETTLE_MS);
}

function isLikelyProductUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return PRODUCT_PATH_HINTS.some((hint) => path.includes(hint));
  } catch {
    return false;
  }
}

// Product-card links are queued/visited ahead of category, pagination, and nav links
// so the page budget isn't wasted before reaching real product pages.
export function prioritizeProductUrls(urls: string[]): string[] {
  const productUrls = urls.filter(isLikelyProductUrl);
  const otherUrls = urls.filter((url) => !isLikelyProductUrl(url));
  return [...productUrls, ...otherUrls];
}

function isVisitable(
  url: string,
  origin: string,
  robots: RobotsRules,
): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === origin && isPathAllowed(parsed.pathname, robots);
  } catch {
    return false;
  }
}

function toProduct(
  detected: NonNullable<Awaited<ReturnType<typeof detectAndExtractProduct>>>,
): Product | null {
  const candidate = {
    id: detected.sku ?? detected.url,
    url: detected.url,
    name: detected.name,
    description: detected.description,
    price: detected.price,
    currency: detected.currency,
    images: detected.images,
    sku: detected.sku,
  };
  const parsed = ProductSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function fetchProductFromUrl(
  context: BrowserContext,
  url: string,
): Promise<Product | null> {
  const page = await context.newPage();
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    await waitForClientRenderedContent(page);
    const detected = await detectAndExtractProduct(page, url);
    return detected ? toProduct(detected) : null;
  } catch (err) {
    console.warn(`[scrapelium] failed to load ${url}:`, (err as Error).message);
    return null;
  } finally {
    await page.close();
  }
}

interface QueueItem {
  url: string;
  depth: number;
}

interface VisitOutcome {
  product: Product | null;
  links: string[];
}

async function visitAndCollectLinks(
  context: BrowserContext,
  url: string,
  collectLinks: boolean,
): Promise<VisitOutcome> {
  const page = await context.newPage();
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    await waitForClientRenderedContent(page);
    const detected = await detectAndExtractProduct(page, url);
    const product = detected ? toProduct(detected) : null;
    // A direct product URL is a terminal page. Following its recommendations,
    // navigation, and footer would mix unrelated products into the requested result.
    if (product) return { product, links: [] };
    let links: string[] = [];
    if (collectLinks) {
      const raw = await page.$$eval("a[href]", (as) =>
        as.map((a) => (a as HTMLAnchorElement).href),
      );
      links = raw.map((link) => link.split("#")[0]).filter(Boolean);
    }
    return { product: null, links };
  } catch (err) {
    console.warn(`[scrapelium] failed to load ${url}:`, (err as Error).message);
    return { product: null, links: [] };
  } finally {
    await page.close();
  }
}

export interface CrawlResult {
  products: Product[];
  pagesVisited: number;
}

function takeBatch(
  productQueue: QueueItem[],
  otherQueue: QueueItem[],
  remainingBudget: number,
): QueueItem[] {
  const limit = Math.min(CRAWL_CONCURRENCY, remainingBudget);
  const batch: QueueItem[] = [];
  while (batch.length < limit && productQueue.length)
    batch.push(productQueue.shift()!);
  while (batch.length < limit && otherQueue.length)
    batch.push(otherQueue.shift()!);
  return batch;
}

// Routes newly-discovered links into one of two global queues so product-like URLs stay
// ahead of category/pagination URLs across the *entire* crawl, not just within one batch.
function enqueueLinks(
  results: VisitOutcome[],
  batch: QueueItem[],
  visited: Set<string>,
  origin: string,
  robots: RobotsRules,
  productQueue: QueueItem[],
  otherQueue: QueueItem[],
): void {
  for (let i = 0; i < results.length; i++) {
    const nextDepth = batch[i].depth + 1;
    for (const link of results[i].links) {
      if (
        visited.has(link) ||
        SKIP_EXTENSIONS.test(link) ||
        !isVisitable(link, origin, robots)
      )
        continue;
      visited.add(link);
      const item: QueueItem = { url: link, depth: nextDepth };
      (isLikelyProductUrl(link) ? productQueue : otherQueue).push(item);
    }
  }
}

// BFS crawl fallback (used only when no sitemap is found). Extracts products in the same
// page visit as link discovery (no double-navigation), visits several pages concurrently,
// and keeps product-like URLs globally ahead of category/pagination URLs in the queue.
export async function crawlAndExtract(
  context: BrowserContext,
  options: ScrapeOptions,
  robots: RobotsRules,
  origin: string,
): Promise<CrawlResult> {
  const visited = new Set<string>();
  const products: Product[] = [];
  let pagesVisited = 0;

  const productQueue: QueueItem[] = [];
  const otherQueue: QueueItem[] = [];
  const seed: QueueItem = { url: options.baseUrl, depth: 0 };
  visited.add(seed.url);
  (isLikelyProductUrl(seed.url) ? productQueue : otherQueue).push(seed);

  while (
    (productQueue.length || otherQueue.length) &&
    pagesVisited < options.maxPages
  ) {
    const batch = takeBatch(
      productQueue,
      otherQueue,
      options.maxPages - pagesVisited,
    );
    if (batch.length === 0) break;

    const results = await Promise.all(
      batch.map((item) =>
        visitAndCollectLinks(context, item.url, item.depth < options.maxDepth),
      ),
    );
    pagesVisited += results.length;

    for (const { product } of results) if (product) products.push(product);
    enqueueLinks(
      results,
      batch,
      visited,
      origin,
      robots,
      productQueue,
      otherQueue,
    );
  }

  return { products, pagesVisited };
}
