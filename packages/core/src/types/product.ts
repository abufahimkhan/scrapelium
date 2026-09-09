import { z } from "zod";

export const ProductSchema = z.object({
  id: z.string(), // SKU if available, otherwise the product URL
  url: z.string(),
  name: z.string(),
  description: z.string().default(""),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  images: z.array(z.string()).default([]),
  sku: z.string().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export const ScrapeOptionsSchema = z.object({
  baseUrl: z.string().url(),
  maxPages: z.number().int().positive().max(2000).default(100),
  maxDepth: z.number().int().min(0).max(10).default(3),
  delayMs: z.number().int().min(0).default(500),
  dbPath: z.string().default("./data/app.db"),
  // Opt-in: upload product images to Cloudinary instead of keeping the original URLs.
  uploadImages: z.boolean().default(false),
});

export type ScrapeOptions = z.infer<typeof ScrapeOptionsSchema>;
