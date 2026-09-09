"use client";

import type { Product } from "@scrapelium/core";
import { downloadBlob, downloadText, toCSV, toJSON, toXLSXBlob } from "@/lib/export";

export function ExportButtons({ products }: { readonly products: Product[] }) {
    if (products.length === 0) return null;

    return (
        <div className="export-actions">
            <button
                type="button"
                className="export-button"
                onClick={() => downloadText(toJSON(products), "products.json", "application/json")}
            >
                JSON
            </button>
            <button
                type="button"
                className="export-button"
                onClick={() => downloadText(toCSV(products), "products.csv", "text/csv")}
            >
                CSV
            </button>
            <button
                type="button"
                className="export-button"
                onClick={() => downloadBlob(toXLSXBlob(products), "products.xlsx")}
            >
                XLSX
            </button>
        </div>
    );
}
