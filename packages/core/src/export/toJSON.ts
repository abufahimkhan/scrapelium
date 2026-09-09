import type { Product } from "../types/product.js";

export function toJSON(products: Product[]): string {
  return JSON.stringify(products, null, 2);
}
