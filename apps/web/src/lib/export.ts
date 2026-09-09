import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Product } from "@scrapelium/core";

// Reimplemented client-side (rather than importing @scrapelium/core's export module at runtime)
// so the browser bundle doesn't pull in the core package's Node-only deps (better-sqlite3, playwright).
const FIELDS = [
  "id",
  "url",
  "name",
  "description",
  "price",
  "currency",
  "images",
  "sku",
];

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

export function toJSON(products: Product[]): string {
  return JSON.stringify(products, null, 2);
}

export function toCSV(products: Product[]): string {
  const rows = products.map(flatten);
  return Papa.unparse({
    fields: FIELDS,
    data: rows.map((row) => FIELDS.map((field) => row[field])),
  });
}

export function toXLSXBlob(products: Product[]): Blob {
  const worksheet = XLSX.utils.json_to_sheet(products.map(flatten));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
  const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(
  text: string,
  filename: string,
  mime: string,
): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}
