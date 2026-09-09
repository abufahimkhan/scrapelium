"use client";

import { useEffect, useState } from "react";

type Platform = "Windows" | "macOS" | "Linux" | "";

const releaseUrl = "https://github.com/abufahimkhan/scrapelium/releases/latest";
const installerUrls = {
    Windows: "https://github.com/abufahimkhan/scrapelium/releases/latest/download/Scrapelium_0.1.0_x64-setup.exe",
    macOS: releaseUrl,
    Linux: releaseUrl,
} as const;

function detectPlatform(userAgent: string): Platform {
    if (/windows/i.test(userAgent)) return "Windows";
    if (/macintosh|mac os x/i.test(userAgent)) return "macOS";
    if (/linux/i.test(userAgent)) return "Linux";
    return "";
}

export default function DownloadPage() {
    const [platform, setPlatform] = useState<Platform>("");

    useEffect(() => {
        setPlatform(detectPlatform(navigator.userAgent));
    }, []);

    const downloads = [
        { name: "Windows", detail: "MSI installer", badge: "WIN" },
        { name: "macOS", detail: "DMG installer", badge: "MAC" },
        { name: "Linux", detail: "AppImage / DEB", badge: "LIN" },
    ] as const;

    return (
        <main className="app-shell">
            <div className="content-wrap">
                <header className="max-w-2xl pt-8">
                    <div className="eyebrow">Scrapelium desktop</div>
                    <h1 className="brand-title">Your product data,<br /><span>running locally.</span></h1>
                    <p className="subtitle">
                        A fast desktop workspace for extracting, reviewing, importing, and exporting e-commerce catalogs.
                    </p>
                </header>

                <section className="mt-12 grid gap-3 md:grid-cols-3">
                    {downloads.map((download) => {
                        const isRecommended = platform === download.name;
                        return (
                            <a
                                key={download.name}
                                href={installerUrls[download.name]}
                                download={download.name === "Windows" ? true : undefined}
                                className={`command-panel block p-5 transition hover:-translate-y-1 hover:border-teal-300/50 ${isRecommended ? "border-teal-300/70 bg-teal-300/10" : ""}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="eyebrow">{download.badge}</span>
                                    {isRecommended && <span className="status-chip">Recommended</span>}
                                </div>
                                <h2 className="mt-9 text-xl font-semibold text-slate-100">{download.name}</h2>
                                <p className="mt-1 text-sm text-slate-400">{download.detail}</p>
                                <span className="mt-6 inline-block text-xs font-bold uppercase tracking-wider text-teal-300">
                                    Download latest
                                </span>
                            </a>
                        );
                    })}
                </section>

                <p className="mt-8 max-w-2xl text-sm leading-6 text-slate-500">
                    Scrapelium runs on your computer. No account, cloud database, or separate server setup is required.
                    Google Chrome is required for desktop scraping when Playwright Chromium is not bundled in the installer.
                </p>
            </div>
        </main>
    );
}
