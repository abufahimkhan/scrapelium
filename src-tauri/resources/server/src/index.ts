import express from "express";
import cors from "cors";
import multer from "multer";
import { ScrapeOptionsSchema, parseProductsFile, scrapeSite } from "@scrapelium/core";
import {
  DB_PATH,
  getCachedProducts,
  refreshProductsCache,
  setProducts,
} from "./productsStore.js";
import { createJob, getJob, updateJob } from "./jobsStore.js";

const app = express();
app.disable("x-powered-by"); // avoid disclosing the framework/version via response headers
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());

// Memory storage only (single local user, no persistence needed beyond the session DB/cache).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

refreshProductsCache(); // seed the in-memory store from the last CLI scrape session, if any

app.get("/api/products", (_req, res) => {
  res.json(getCachedProducts());
});

const ScrapeRequestSchema = ScrapeOptionsSchema.pick({
  baseUrl: true,
  maxPages: true,
  uploadImages: true,
});

app.post("/api/scrape", (req, res) => {
  const parsed = ScrapeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }

  const job = createJob();
  res.json({ jobId: job.id });

  updateJob(job.id, { status: "running" });
  scrapeSite({ ...parsed.data, dbPath: DB_PATH })
    .then((result) => {
      setProducts(result.products); // keep GET /api/products in sync with the finished job
      updateJob(job.id, {
        status: "done",
        source: result.source,
        pagesVisited: result.pagesVisited,
        products: result.products,
      });
    })
    .catch((err) => {
      updateJob(job.id, { status: "error", error: (err as Error).message });
    });
});

app.get("/api/scrape/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

app.post("/api/import", upload.single("file"), (req, res) => {
  if (!req.file) {
    res
      .status(400)
      .json({ error: 'No file uploaded (expected multipart field "file")' });
    return;
  }

  const { products, errors } = parseProductsFile(
    req.file.originalname,
    req.file.buffer,
  );

  if (products.length === 0 && errors.length > 0) {
    res.status(422).json({ imported: 0, rejected: errors.length, errors });
    return;
  }

  setProducts(products);
  res.json({ imported: products.length, rejected: errors.length, errors });
});

app.listen(PORT, () => {
  console.log(`[scrapelium-server] listening on http://localhost:${PORT}`);
});
