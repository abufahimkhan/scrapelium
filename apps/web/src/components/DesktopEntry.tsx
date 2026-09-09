"use client";

import { useEffect } from "react";

export function DesktopEntry() {
    useEffect(() => {
        if ("__TAURI_INTERNALS__" in window) {
            const workspaceUrl = process.env.NODE_ENV === "development" ? "/scrape" : "./scrape.html";
            window.location.replace(workspaceUrl);
        }
    }, []);

    return null;
}
