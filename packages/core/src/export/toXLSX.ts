import * as XLSX from "xlsx";
import type { Product } from "../types/product.js";

// Flattens images[] to a comma-joined string since XLSX cells have no native array type.
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

export function toXLSX(products: Product[]): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(products.map(flatten));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
