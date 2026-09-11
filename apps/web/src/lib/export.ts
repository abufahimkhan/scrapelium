import Papa from "papaparse";
import * as XLSX from "xlsx";

type Product = {
  id: string | number | null;
  url: string | null;
  name: string | null;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  images: string[];
  sku?: string | null;
};

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

function isDesktopApp(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function saveDesktopBlob(blob: Blob, filename: string): Promise<boolean> {
  const { invoke } = await import("@tauri-apps/api/core");
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  return invoke<boolean>("save_export", { filename, bytes });
}

export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  if (isDesktopApp()) return saveDesktopBlob(blob, filename);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export async function downloadText(
  text: string,
  filename: string,
  mime: string,
): Promise<boolean> {
  return downloadBlob(new Blob([text], { type: mime }), filename);
}
