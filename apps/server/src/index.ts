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
import {
  getStorageSettings,
  logoutActiveProvider,
  saveCloudinary,
  saveGcs,
} from "./storageSettings.js";
import { getActiveUploader, validateCloudinary, validateGcs } from "./storageService.js";

const app = express();
app.disable("x-powered-by"); // avoid disclosing the framework/version via response headers
const PORT = process.env.PORT ?? 4000;
const HOST = process.env.HOST ?? "127.0.0.1";

const allowedOrigins = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https?:\/\/tauri\.localhost(?::\d+)?$/,
  /^(app|file|tauri|vscode-webview):\/\//,
];
app.use(cors({
  origin(origin, callback) {
    const configured = process.env.WEB_ORIGIN;
    const allowed = !origin || origin === configured || allowedOrigins.some((pattern) => pattern.test(origin));
    callback(allowed ? null : new Error("Origin not allowed by CORS"), allowed);
  },
}));
app.use(express.json({ limit: "2mb" }));

// Memory storage only (single local user, no persistence needed beyond the session DB/cache).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

refreshProductsCache(); // seed the in-memory store from the last CLI scrape session, if any

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/storage/status", (_req, res) => {
  const settings = getStorageSettings();
  const provider = settings?.active_provider ?? null;
  const connected = provider === "cloudinary"
    ? Boolean(settings?.cloud_name && settings.api_key && settings.api_secret)
    : provider === "gcs"
      ? Boolean(settings?.gcs_bucket_name && settings.gcs_service_account_json)
      : false;
  res.json({ activeProvider: provider, connected });
});

app.post("/api/storage/credentials", async (req, res) => {
  try {
    if (req.body?.provider === "cloudinary") {
      const { cloudName, apiKey, apiSecret } = req.body;
      if (![cloudName, apiKey, apiSecret].every((value) => typeof value === "string" && value.trim())) {
        res.status(400).json({ error: "cloudName, apiKey, and apiSecret are required" });
        return;
      }
      await validateCloudinary({ cloudName, apiKey, apiSecret });
      saveCloudinary({ cloudName, apiKey, apiSecret });
      res.json({ activeProvider: "cloudinary", connected: true });
      return;
    }

    if (req.body?.provider === "gcs") {
      const { bucketName, serviceAccountJson } = req.body;
      if (typeof bucketName !== "string" || !bucketName.trim() || typeof serviceAccountJson !== "string") {
        res.status(400).json({ error: "bucketName and serviceAccountJson are required" });
        return;
      }
      try { JSON.parse(serviceAccountJson); } catch {
        res.status(400).json({ error: "serviceAccountJson must be valid JSON" });
        return;
      }
      await validateGcs({ bucketName, serviceAccountJson });
      saveGcs({ bucketName, serviceAccountJson });
      res.json({ activeProvider: "gcs", connected: true });
      return;
    }
    res.status(400).json({ error: "provider must be 'cloudinary' or 'gcs'" });
  } catch (error) {
    res.status(422).json({ error: `Credential validation failed: ${(error as Error).message}` });
  }
});

app.post("/api/storage/logout", (_req, res) => {
  const provider = logoutActiveProvider();
  res.json({ activeProvider: null, connected: false, loggedOutProvider: provider });
});

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
  let uploadImage: ((url: string) => Promise<string>) | undefined;
  if (parsed.data.uploadImages) {
    try {
      uploadImage = getActiveUploader().upload;
    } catch (error) {
      updateJob(job.id, { status: "error", error: (error as Error).message });
      return;
    }
  }
  scrapeSite({ ...parsed.data, dbPath: DB_PATH }, uploadImage)
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

app.listen(Number(PORT), HOST, () => {
  console.log(`[scrapelium-server] listening on http://${HOST}:${PORT}`);
});
