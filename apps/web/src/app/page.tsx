"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, waitForBackend } from "@/lib/api";
import { ProductTable } from "@/components/ProductTable";
import { ExportButtons } from "@/components/ExportButtons";
import { StorageAccount, type StorageProvider } from "@/components/StorageAccount";

type Product = {
    id: string;
    url: string;
    name: string;
    description: string;
    price: number | null;
    currency: string | null;
    images: string[];
    sku?: string | null;
};

type Tab = "scrape" | "import";

interface ScrapeJob {
    id: string;
    status: "pending" | "running" | "done" | "error";
    products?: Product[];
    error?: string;
    pagesVisited?: number;
    source?: "sitemap" | "crawl";
}

interface ImportResponse {
    imported: number;
    rejected: number;
    errors: { row: number; message: string }[];
}

export default function Home() {
    const [tab, setTab] = useState<Tab>("scrape");
    const [backendState, setBackendState] = useState<"connecting" | "ready" | "error">("connecting");
    const [backendError, setBackendError] = useState("");
    const [storageStatus, setStorageStatus] = useState<{ activeProvider: StorageProvider | null; connected: boolean }>({ activeProvider: null, connected: false });

    useEffect(() => {
        waitForBackend().then(() => setBackendState("ready")).catch((error) => {
            setBackendError((error as Error).message); setBackendState("error");
        });
    }, []);

    // --- Tab 1: scrape ---
    const [url, setUrl] = useState("");
    const [maxPages, setMaxPages] = useState<number | "">(15);
    const [uploadImages, setUploadImages] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [job, setJob] = useState<ScrapeJob | null>(null);
    const [scrapeError, setScrapeError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    async function startScrape() {
        setScrapeError(null);
        setJob(null);

        try {
            if (uploadImages && !storageStatus.connected) throw new Error("Connect a Cloudinary or Google Cloud account before mirroring images");
            const res = await apiFetch("/api/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ baseUrl: url, maxPages, uploadImages }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Request failed (${res.status})`);
            }
            const { jobId: newJobId } = (await res.json()) as { jobId: string };
            setJobId(newJobId);

            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = setInterval(async () => {
                const statusRes = await apiFetch(`/api/scrape/${newJobId}`);
                const statusBody = (await statusRes.json()) as ScrapeJob;
                setJob(statusBody);
                if (statusBody.status === "done" || statusBody.status === "error") {
                    if (pollRef.current) clearInterval(pollRef.current);
                }
            }, 2000);
        } catch (err) {
            setScrapeError((err as Error).message);
        }
    }

    // --- Tab 2: import ---
    const [importResult, setImportResult] = useState<
        (ImportResponse & { products: Product[] }) | null
    >(null);
    const [importError, setImportError] = useState<string | null>(null);

    async function handleFileUpload(file: File) {
        setImportError(null);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await apiFetch("/api/import", { method: "POST", body: formData });
            const body = (await res.json()) as ImportResponse;
            if (!res.ok && body.imported === undefined) {
                throw new Error("Import failed");
            }

            const productsRes = await apiFetch("/api/products");
            const products = (await productsRes.json()) as Product[];

            setImportResult({ ...body, products });
        } catch (err) {
            setImportError((err as Error).message);
        }
    }

    const scrapedProducts = job?.products ?? [];

    const isScraping = job?.status === "running" || job?.status === "pending";
    const activeProducts = tab === "scrape" ? scrapedProducts : importResult?.products ?? [];
    const activeCount = activeProducts.length;

    if (backendState !== "ready") {
        return <main className="app-shell backend-gate"><div className="scan-loader" role="status"><span className="scan-loader-orbit" /><div><strong>{backendState === "error" ? "Local engine unavailable" : "Starting local engine"}</strong><p>{backendState === "error" ? backendError : "Waiting for the secure backend connection…"}</p></div></div></main>;
    }

    return (
        <main className="app-shell">
            <div className="content-wrap">
                <header className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                        <div className="eyebrow">Local commerce intelligence</div>
                        <h1 className="brand-title">Scrape<span>lium</span></h1>
                        <p className="subtitle">
                            Extract clean product data, inspect it locally, and move it in any format.
                        </p>
                    </div>
                    <div className="status-chip">
                        LOCAL ENGINE ONLINE
                    </div>
                </header>

                <StorageAccount onStatusChange={setStorageStatus} />

                <div className="tab-list" role="tablist" aria-label="Scrapelium actions">
                    <button
                        type="button"
                        className={`tab-button ${tab === "scrape" ? "active" : ""}`}
                        onClick={() => setTab("scrape")}
                        role="tab"
                        aria-selected={tab === "scrape"}
                    >
                        Scan storefront
                    </button>
                    <button
                        type="button"
                        className={`tab-button ${tab === "import" ? "active" : ""}`}
                        onClick={() => setTab("import")}
                        role="tab"
                        aria-selected={tab === "import"}
                    >
                        Import dataset
                    </button>
                </div>

                {tab === "scrape" && (
                    <section className="command-panel">
                        <div className="panel-topline">
                            <span className="panel-label">Target configuration</span>
                            <span className="eyebrow">GET / DISCOVER / EXTRACT</span>
                        </div>
                        <div className="control-grid">
                            <label htmlFor="baseUrl" className="field-label">
                                <span>Storefront URL</span>
                                <input
                                    id="baseUrl"
                                    className="field-input"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://store.example.com"
                                />
                            </label>
                            <label htmlFor="maxPages" className="field-label">
                                <span>Page cap</span>
                                <input
                                    id="maxPages"
                                    type="number"
                                    className="field-input"
                                    value={maxPages}
                                    onChange={(e) => setMaxPages(Number(e.target.value))}
                                />
                            </label>
                            <label className="toggle-row">
                                <input
                                    type="checkbox"
                                    checked={uploadImages}
                                    onChange={(e) => setUploadImages(e.target.checked)}
                                />
                                <span>{storageStatus.activeProvider === "gcs" ? "Google Cloud mirror" : "Cloudinary mirror"}</span>
                            </label>
                            <button
                                type="button"
                                className="primary-button"
                                onClick={startScrape}
                                disabled={!url || isScraping}
                            >
                                {isScraping ? "Scanning..." : "Start scan"}
                            </button>
                        </div>

                        {scrapeError && <p className="job-status error-status">{scrapeError}</p>}

                        {isScraping && (
                            <div className="scan-loader" role="status" aria-live="polite">
                                <span className="scan-loader-orbit" aria-hidden="true" />
                                <div>
                                    <strong>Scanning storefront</strong>
                                    <p>Discovering product pages and normalizing catalog data locally.</p>
                                </div>
                            </div>
                        )}

                        {job && (
                            <p className={`job-status ${job.status === "error" ? "error-status" : ""}`}>
                                JOB {jobId?.slice(0, 8)} <strong>{job.status}</strong>
                                {job.status === "done" &&
                                    ` // ${job.products?.length ?? 0} records // ${job.source} // ${job.pagesVisited} pages`}
                                {job.status === "error" && ` // ${job.error}`}
                            </p>
                        )}
                    </section>
                )}

                {tab === "import" && (
                    <section className="command-panel">
                        <div className="panel-topline">
                            <span className="panel-label">Dataset intake</span>
                            <span className="eyebrow">CSV / XLSX / JSON</span>
                        </div>
                        <label className="upload-zone">
                            <input
                                type="file"
                                accept=".csv,.xlsx,.json"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                }}
                            />
                            <p>Choose a product export to normalize and validate locally.</p>
                        </label>

                        {importError && <p className="job-status error-status">{importError}</p>}

                        {importResult && (
                            <div className={`import-status ${importResult.rejected > 0 ? "error-status" : ""}`}>
                                <p>Imported {importResult.imported} | Rejected {importResult.rejected}</p>
                                {importResult.errors.length > 0 && (
                                    <ul className="mt-2 list-disc pl-5">
                                        {importResult.errors.map((e) => (
                                            <li key={e.row}>
                                                Row {e.row}: {e.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </section>
                )}
                <section className="results-section">
                    <div className="results-heading">
                        <div>
                            <div className="eyebrow">Product manifest</div>
                            <h2>{activeCount.toString().padStart(2, "0")} records available</h2>
                            <p>{tab === "scrape" ? "Current scan output" : "Current imported dataset"}</p>
                        </div>
                        <ExportButtons products={activeProducts} />
                    </div>
                    <ProductTable products={activeProducts} />
                </section>
            </div>
        </main>
    );
}
