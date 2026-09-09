import Papa from "papaparse";
import type { Product } from "../types/product.js";

// Column subset recognized by WooCommerce's built-in CSV product importer.
const WOOCOMMERCE_HEADERS = [
  "ID",
  "Type",
  "SKU",
  "Name",
  "Published",
  "Short description",
  "Description",
  "Regular price",
  "Categories",
  "Images",
];

function toRow(product: Product): Record<string, string | number> {
  return {
    ID: "",
    Type: "simple",
    SKU: product.sku ?? "",
    Name: product.name,
    Published: 1,
    "Short description": "",
    Description: product.description,
    "Regular price": product.price ?? "",
    Categories: "",
    Images: product.images.join(", "), // WooCommerce expects a comma-separated list of image URLs
  };
}

export function toWooCommerceCSV(products: Product[]): string {
  const rows = products.map(toRow);
  return Papa.unparse({
    fields: WOOCOMMERCE_HEADERS,
    data: rows.map((row) => WOOCOMMERCE_HEADERS.map((header) => row[header])),
  });
}
