import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Product } from "../types/product.js";

// Keep the database file itself intact because it also contains workspace settings.
// Only the product snapshot is replaced for a new scrape.
export function createProductsDb(dbPath: string): Database.Database {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL,
      currency TEXT,
      images TEXT,
      sku TEXT
    );
    DELETE FROM products;
  `);
  return db;
}

export function insertProducts(
  db: Database.Database,
  products: Product[],
): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO products (id, url, name, description, price, currency, images, sku)
    VALUES (@id, @url, @name, @description, @price, @currency, @images, @sku)
  `);
  const insertMany = db.transaction((items: Product[]) => {
    for (const p of items) {
      insert.run({
        id: p.id,
        url: p.url,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        images: JSON.stringify(p.images),
        sku: p.sku ?? null,
      });
    }
  });
  insertMany(products);
}
