import type { Product } from "../types/product.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { runInBatches } from "./concurrency.js";

export const IMAGE_UPLOAD_CONCURRENCY = 3;

interface ImageRef {
  productIndex: number;
  imageIndex: number;
  url: string;
}

// Uploads every image across all products through one global concurrency-limited queue
// (not per-product), so the cap holds regardless of how many images a product has.
export async function uploadProductImages(products: Product[]): Promise<Product[]> {
  const refs: ImageRef[] = [];
  products.forEach((product, productIndex) => {
    product.images.forEach((url, imageIndex) => refs.push({ productIndex, imageIndex, url }));
  });

  const uploaded = await runInBatches(refs, IMAGE_UPLOAD_CONCURRENCY, async (ref) => {
    try {
      return { ...ref, url: await uploadToCloudinary(ref.url) };
    } catch (err) {
      console.warn(`[scrapelium] image upload failed for ${ref.url}:`, (err as Error).message);
      return ref; // fall back to the original URL
    }
  });

  const result = products.map((p) => ({ ...p, images: [...p.images] }));
  for (const ref of uploaded) result[ref.productIndex].images[ref.imageIndex] = ref.url;
  return result;
}
