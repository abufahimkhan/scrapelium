"use client";

import { useState } from "react";
import { downloadBlob, downloadText, toCSV, toJSON, toXLSXBlob } from "@/lib/export";

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

export function ExportButtons({ products }: { readonly products: Product[] }) {
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    if (products.length === 0) return null;

    async function runExport(filename: string, create: () => Promise<boolean>) {
        setBusy(filename);
        setMessage(null);
        try {
            const saved = await create();
            setMessage(saved ? `${filename} saved.` : "Export cancelled.");
        } catch (error) {
            setMessage(`Export failed: ${(error as Error).message}`);
        } finally {
            setBusy(null);
        }
    }

    return (
        <div>
            <div className="export-actions">
                <button type="button" className="export-button" disabled={busy !== null} onClick={() => void runExport("products.json", () => downloadText(toJSON(products), "products.json", "application/json"))}>
                    {busy === "products.json" ? "Saving…" : "JSON"}
                </button>
                <button type="button" className="export-button" disabled={busy !== null} onClick={() => void runExport("products.csv", () => downloadText(toCSV(products), "products.csv", "text/csv"))}>
                    {busy === "products.csv" ? "Saving…" : "CSV"}
                </button>
                <button type="button" className="export-button" disabled={busy !== null} onClick={() => void runExport("products.xlsx", () => downloadBlob(toXLSXBlob(products), "products.xlsx"))}>
                    {busy === "products.xlsx" ? "Saving…" : "XLSX"}
                </button>
            </div>
            {message && <p role="status" className="import-status">{message}</p>}
        </div>
    );
}
