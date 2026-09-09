import Papa from "papaparse";
import type { Product } from "../types/product.js";

const CSV_FIELDS = [
  "id",
  "url",
  "name",
  "description",
  "price",
  "currency",
  "images",
  "sku",
];

// Flattens images[] to a comma-joined string since CSV has no native array type.
function flatten(product: Product): Record<string, string | number | null> {
  return {
    id: product.id,
    url: product.url,
    name: product.name,
    description: product.description,
    price: product.price,
    currency: product.currency,
    images: product.images.join(", "),
    sku: product.sku ?? "",
  };
}

export function toCSV(products: Product[]): string {
  const rows = products.map(flatten);
  return Papa.unparse({
    fields: CSV_FIELDS,
    data: rows.map((row) => CSV_FIELDS.map((field) => row[field])),
  });
}
