import type { Page } from "playwright";

const PREFIX_PRICE_REGEX =
  /(\$|€|£|৳|USD|BDT|EUR|GBP)\s?(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2})?)/i;
const SUFFIX_PRICE_REGEX =
  /(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2}))\s?(USD|BDT|EUR|GBP|\$|€|£|৳)/i;
// Single-product "add to cart" buttons, not the <a> links used on catalog/listing grids.
const ADD_TO_CART_SELECTOR =
  'button.single_add_to_cart_button, form.cart button[type="submit"], button[name="add-to-cart"], input[name="add-to-cart"], form[action*="/cart/add"] button, button[name="add"]';

interface JsonLdOffer {
  price?: string | number;
  priceCurrency?: string;
}

interface JsonLdProduct {
  "@type"?: string | string[];
  "@id"?: string;
  url?: string;
  name?: string;
  description?: string;
  sku?: string;
  image?: string | string[];
  offers?: JsonLdOffer | JsonLdOffer[];
}

async function readJsonLdBlocks(page: Page): Promise<JsonLdProduct[]> {
  const raw = await page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((n) => n.textContent || ""),
  );

  const blocks: JsonLdProduct[] = [];
  for (const text of raw) {
    try {
      const parsed = JSON.parse(text);
      const graph = Array.isArray(parsed)
        ? parsed
        : (parsed?.["@graph"] ?? [parsed]);
      blocks.push(...graph);
    } catch {
      // ignore malformed JSON-LD block
    }
  }
  return blocks;
}

function isProductType(type: JsonLdProduct["@type"]): boolean {
  if (typeof type === "string") return type.toLowerCase() === "product";
  if (Array.isArray(type))
    return type.some((t) => t.toLowerCase() === "product");
  return false;
}

function normalizeImages(image: JsonLdProduct["image"]): string[] {
  if (!image) return [];
  return Array.isArray(image) ? image : [image];
}

function normalizeOffer(
  offers: JsonLdProduct["offers"],
): JsonLdOffer | undefined {
  if (!offers) return undefined;
  return Array.isArray(offers) ? offers[0] : offers;
}

function sameDocumentUrl(candidate: string | undefined, current: string): boolean {
  if (!candidate) return false;
  try {
    const left = new URL(candidate);
    const right = new URL(current);
    return left.origin === right.origin && left.pathname.replace(/\/$/, "") === right.pathname.replace(/\/$/, "");
  } catch { return false; }
}

function isListingUrl(url: string): boolean {
  try {
    return /\/(catalog|category|categories|collections?|search)(\/|$)/i.test(new URL(url).pathname);
  } catch { return false; }
}

async function extractVisiblePrice(page: Page): Promise<{ price: number | null; currency: string | null }> {
  const priceText = await page
    .locator('[itemprop="price"], .product-price, [class*="price"]')
    .first()
    .innerText()
    .catch(() => "");
  const bodyText = priceText || await page.locator("body").innerText().catch(() => "");
  const prefix = bodyText.match(PREFIX_PRICE_REGEX);
  const suffix = bodyText.match(SUFFIX_PRICE_REGEX);
  return {
    price: prefix ? Number(prefix[2].replaceAll(",", "")) : suffix ? Number(suffix[1].replaceAll(",", "")) : null,
    currency: prefix?.[1] ?? suffix?.[2] ?? null,
  };
}

export interface DetectedProduct {
  url: string;
  name: string;
  description: string;
  price: number | null;
  currency: string | null;
  images: string[];
  sku?: string;
}

export async function detectAndExtractProduct(
  page: Page,
  url: string,
): Promise<DetectedProduct | null> {
  // JSON-LD Product schema is the most reliable signal — prefer it when present.
  const jsonLdBlocks = await readJsonLdBlocks(page);
  const productBlocks = jsonLdBlocks.filter((b) => isProductType(b?.["@type"]));
  const productBlock = productBlocks.find((block) =>
    sameDocumentUrl(block.url ?? block["@id"], url),
  ) ?? (productBlocks.length === 1 && !isListingUrl(url) && !productBlocks[0].url && !productBlocks[0]["@id"]
    ? productBlocks[0]
    : undefined);

  if (productBlock) {
    const offer = normalizeOffer(productBlock.offers);
    const visiblePrice = offer?.price === undefined ? await extractVisiblePrice(page) : null;
    return {
      url,
      name: productBlock.name ?? (await page.title()),
      description: productBlock.description ?? "",
      price: offer?.price !== undefined ? Number(offer.price) : visiblePrice?.price ?? null,
      currency: offer?.priceCurrency ?? visiblePrice?.currency ?? null,
      images: normalizeImages(productBlock.image),
      sku: productBlock.sku,
    };
  }

  // Fallback heuristics: og:type=product + price pattern + add-to-cart button text.
  const ogType = await page
    .locator('meta[property="og:type"]')
    .first()
    .getAttribute("content")
    .catch(() => null);

  const { price, currency } = await extractVisiblePrice(page);
  const hasAddToCartButton =
    (await page
      .locator(ADD_TO_CART_SELECTOR)
      .count()
      .catch(() => 0)) > 0;

  // Require the single-product add-to-cart button; a price alone (or og:type alone) also
  // appears on catalog/cart/checkout pages and would otherwise cause false positives.
  const looksLikeProduct =
    hasAddToCartButton &&
    (price !== null || ogType?.toLowerCase().startsWith("product"));
  if (!looksLikeProduct) return null;

  const name = await page
    .locator('h1, [itemprop="name"]')
    .first()
    .innerText()
    .catch(() => page.title());
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .first()
    .getAttribute("content")
    .catch(() => null);

  return {
    url,
    name: name.trim() || (await page.title()),
    description: "",
    price,
    currency,
    images: ogImage ? [ogImage] : [],
  };
}
