import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import type { Product } from "@scrapelium/core";

export const DB_PATH = process.env.SCRAPELIUM_DB_PATH ?? "../../data/app.db";

interface ProductRow {
  id: string;
  url: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  images: string | null;
  sku: string | null;
}

// In-memory cache of the last-scraped products, refreshed from the session SQLite DB on each read.
let cachedProducts: Product[] = [];

export function refreshProductsCache(): Product[] {
  if (!existsSync(DB_PATH)) {
    cachedProducts = [];
    return cachedProducts;
  }

  const db = new Database(DB_PATH, { readonly: true });
  try {
    const rows = db.prepare("SELECT * FROM products").all() as ProductRow[];
    cachedProducts = rows.map((row) => ({
      id: row.id,
      url: row.url,
      name: row.name,
      description: row.description ?? "",
      price: row.price,
      currency: row.currency,
      images: row.images ? (JSON.parse(row.images) as string[]) : [],
      sku: row.sku ?? undefined,
    }));
  } finally {
    db.close();
  }

  return cachedProducts;
}

export function getCachedProducts(): Product[] {
  return cachedProducts;
}

// Used by the reverse-flow import (POST /api/import) to populate the same store GET /api/products reads from.
export function setProducts(products: Product[]): void {
  cachedProducts = products;
}
