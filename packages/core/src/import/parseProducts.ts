import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ProductSchema, type Product } from "../types/product.js";

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult {
  products: Product[];
  errors: ImportError[];
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

// Accepts both our own export column names and a few common alternates (e.g. "Regular price",
// "Images" from the WooCommerce format) so round-tripping an exported file works out of the box.
function normalizeRow(raw: Record<string, unknown>): unknown {
  const rawImages = raw.images ?? raw.Images;
  const images = Array.isArray(rawImages)
    ? rawImages
    : typeof rawImages === "string" && rawImages.length > 0
      ? rawImages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const rawPrice = raw.price ?? raw["Regular price"];
  const price =
    rawPrice === "" || rawPrice === undefined || rawPrice === null
      ? null
      : Number(rawPrice);

  const url = toStringOrEmpty(raw.url ?? raw.URL);
  const sku = raw.sku ?? raw.SKU;
  const skuStr = toStringOrEmpty(sku) || undefined;

  return {
    id: raw.id || skuStr || url,
    url,
    name: raw.name ?? raw.Name,
    description: raw.description ?? raw.Description ?? "",
    price: typeof price === "number" && Number.isNaN(price) ? null : price,
    currency: raw.currency ?? raw.Currency ?? null,
    images,
    sku: skuStr,
  };
}

// Every row is validated independently — bad rows are reported as errors, not silently dropped.
function validateRows(rawRows: Record<string, unknown>[]): ImportResult {
  const products: Product[] = [];
  const errors: ImportError[] = [];

  rawRows.forEach((raw, index) => {
    const candidate = normalizeRow(raw);
    const parsed = ProductSchema.safeParse(candidate);
    if (parsed.success) {
      products.push(parsed.data);
    } else {
      const message = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      errors.push({ row: index + 1, message });
    }
  });

  return { products, errors };
}

export function parseCSV(buffer: Buffer): ImportResult {
  const text = buffer.toString("utf-8");
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return validateRows(parsed.data);
}

export function parseXLSX(buffer: Buffer): ImportResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return validateRows(rows);
}

export function parseJSON(buffer: Buffer): ImportResult {
  const text = buffer.toString("utf-8");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return {
      products: [],
      errors: [{ row: 0, message: `Invalid JSON: ${(err as Error).message}` }],
    };
  }
  const rows = Array.isArray(data) ? data : [data];
  return validateRows(rows as Record<string, unknown>[]);
}

export function parseProductsFile(
  filename: string,
  buffer: Buffer,
): ImportResult {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "csv") return parseCSV(buffer);
  if (ext === "xlsx") return parseXLSX(buffer);
  if (ext === "json") return parseJSON(buffer);
  return {
    products: [],
    errors: [
      { row: 0, message: `Unsupported file type: .${ext ?? "unknown"}` },
    ],
  };
}
