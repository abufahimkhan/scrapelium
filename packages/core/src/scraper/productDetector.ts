import type { Page } from "playwright";

const PRICE_REGEX =
  /(\$|€|£|৳|USD|BDT|EUR|GBP)\s?(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2})?)/;
// Single-product "add to cart" buttons, not the <a> links used on catalog/listing grids.
const ADD_TO_CART_SELECTOR =
  'button.single_add_to_cart_button, form.cart button[type="submit"], button[name="add-to-cart"], input[name="add-to-cart"]';

interface JsonLdOffer {
  price?: string | number;
  priceCurrency?: string;
}

interface JsonLdProduct {
  "@type"?: string | string[];
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
  const productBlock = jsonLdBlocks.find((b) => isProductType(b?.["@type"]));

  if (productBlock) {
    const offer = normalizeOffer(productBlock.offers);
    return {
      url,
      name: productBlock.name ?? (await page.title()),
      description: productBlock.description ?? "",
      price: offer?.price !== undefined ? Number(offer.price) : null,
      currency: offer?.priceCurrency ?? null,
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

  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  const priceMatch = bodyText.match(PRICE_REGEX);
  const hasAddToCartButton =
    (await page
      .locator(ADD_TO_CART_SELECTOR)
      .count()
      .catch(() => 0)) > 0;

  // Require the single-product add-to-cart button; a price alone (or og:type alone) also
  // appears on catalog/cart/checkout pages and would otherwise cause false positives.
  const looksLikeProduct =
    hasAddToCartButton && (!!priceMatch || ogType === "product");
  if (!looksLikeProduct) return null;

  const ogImage = await page
    .locator('meta[property="og:image"]')
    .first()
    .getAttribute("content")
    .catch(() => null);

  return {
    url,
    name: await page.title(),
    description: "",
    price: priceMatch ? Number(priceMatch[2].replaceAll(",", "")) : null,
    currency: priceMatch ? priceMatch[1] : null,
    images: ogImage ? [ogImage] : [],
  };
}
