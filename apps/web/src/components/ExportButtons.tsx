"use client";

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
