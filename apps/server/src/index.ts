import express from "express";
import { refreshProductsCache } from "./productsStore.js";

const app = express();
app.disable("x-powered-by"); // avoid disclosing the framework/version via response headers
const PORT = process.env.PORT ?? 4000;

app.get("/api/products", (_req, res) => {
  const products = refreshProductsCache();
  res.json(products);
});

app.listen(PORT, () => {
  console.log(`[scrapelium-server] listening on http://localhost:${PORT}`);
});
