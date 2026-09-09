const releaseUrl = "https://github.com/abufahimkhan/scrapelium/releases";

export default function DownloadPage() {
    return (
        <main className="app-shell">
            <div className="content-wrap">
                <header className="max-w-2xl pt-8">
                    <div className="eyebrow">Scrapelium desktop</div>
                    <h1 className="brand-title">Your product data,<br /><span>running locally.</span></h1>
                    <p className="subtitle">
                        A fast desktop workspace for extracting, reviewing, importing, and exporting e-commerce catalogs.
                    </p>
                    <a className="primary-button mt-7 inline-flex items-center no-underline" href="/scrape">
                        Open functional workspace
                    </a>
                </header>

                <section className="mt-12 max-w-2xl">
                    <a href={releaseUrl} className="command-panel block p-6 transition hover:-translate-y-1 hover:border-teal-300/50">
                        <div className="flex items-center justify-between">
                            <span className="eyebrow">Desktop release</span>
                            <span className="status-chip">Latest</span>
                        </div>
                        <h2 className="mt-9 text-xl font-semibold text-slate-100">Download Scrapelium</h2>
                        <p className="mt-1 text-sm text-slate-400">Open the official releases page to get the latest installer.</p>
                        <span className="mt-6 inline-block text-xs font-bold uppercase tracking-wider text-teal-300">View downloads</span>
                    </a>
                </section>

                <p className="mt-8 max-w-2xl text-sm leading-6 text-slate-500">
                    Scrapelium runs on your computer. No account, cloud database, or separate server setup is required.
                    Google Chrome is required for desktop scraping when Playwright Chromium is not bundled in the installer.
                </p>

                <section className="command-panel mt-8 max-w-2xl p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-300">
                        Seeing a Windows SmartScreen warning?
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                        Scrapelium is a new, independently published app, so Windows and your browser have not yet built up a
                        download reputation for it. This does not mean the file is unsafe &mdash; it means SmartScreen has not
                        seen enough installs of this exact build yet.
                    </p>
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-400">
                        <li>If your browser blocks the download, click the three dots or arrow next to it and choose <span className="text-slate-200">Keep</span>.</li>
                        <li>When you run the installer and see &ldquo;Windows protected your PC&rdquo;, click <span className="text-slate-200">More info</span>.</li>
                        <li>Click <span className="text-slate-200">Run anyway</span> to continue the install.</li>
                    </ol>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        You can verify the file came from this project by downloading only from{" "}
                        <a
                            href={releaseUrl}
                            className="text-teal-300 underline underline-offset-2"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            the official GitHub Releases page
                        </a>
                        .
                    </p>
                </section>
            </div>
        </main>
    );
}
