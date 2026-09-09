"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type StorageProvider = "cloudinary" | "gcs";
interface StorageStatus { activeProvider: StorageProvider | null; connected: boolean }

export function StorageAccount({ onStatusChange }: { onStatusChange: (status: StorageStatus) => void }) {
  const [status, setStatus] = useState<StorageStatus>({ activeProvider: null, connected: false });
  const [provider, setProvider] = useState<StorageProvider | null>(null);
  const [cloudName, setCloudName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function publish(next: StorageStatus) { setStatus(next); onStatusChange(next); }

  useEffect(() => {
    apiFetch("/api/storage/status").then((response) => response.json()).then(publish).catch(() => undefined);
  }, []);

  async function connect() {
    if (!provider) return;
    setBusy(true); setError(null);
    try {
      const body = provider === "cloudinary"
        ? { provider, cloudName, apiKey, apiSecret }
        : { provider, bucketName, serviceAccountJson };
      const response = await apiFetch("/api/storage/credentials", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not connect storage account");
      publish(result); setProvider(null); setApiSecret(""); setServiceAccountJson("");
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError(null);
    try {
      const response = await apiFetch("/api/storage/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not disconnect storage account");
      publish(await response.json());
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  }

  return <>
    <div className="storage-account">
      <div><span className="eyebrow">Image mirror</span><strong>{status.connected ? `${status.activeProvider === "gcs" ? "Google Cloud" : "Cloudinary"} connected` : "No account connected"}</strong></div>
      <div className="storage-actions">
        <button className="export-button" type="button" onClick={() => setProvider("cloudinary")}>Cloudinary Mirror</button>
        <button className="export-button" type="button" onClick={() => setProvider("gcs")}>Google Cloud Mirror</button>
        {status.connected && <button className="export-button danger-button" type="button" onClick={logout} disabled={busy}>Logout / Switch Account</button>}
      </div>
    </div>
    {provider && <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy && setProvider(null)}>
      <section className="credential-modal" role="dialog" aria-modal="true" aria-labelledby="storage-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-topline"><div><span className="eyebrow">Storage account</span><h2 id="storage-title">Connect {provider === "gcs" ? "Google Cloud Storage" : "Cloudinary"}</h2></div><button className="modal-close" onClick={() => setProvider(null)} aria-label="Close">×</button></div>
        <div className="credential-fields">
          {provider === "cloudinary" ? <>
            <label className="field-label"><span>Cloud name</span><input className="field-input" value={cloudName} onChange={(e) => setCloudName(e.target.value)} /></label>
            <label className="field-label"><span>API key</span><input className="field-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></label>
            <label className="field-label"><span>API secret</span><input type="password" className="field-input" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} /></label>
          </> : <>
            <label className="field-label"><span>Bucket name</span><input className="field-input" value={bucketName} onChange={(e) => setBucketName(e.target.value)} /></label>
            <label className="field-label"><span>Service account JSON</span><textarea className="field-input credential-json" value={serviceAccountJson} onChange={(e) => setServiceAccountJson(e.target.value)} spellCheck={false} /></label>
          </>}
          {error && <p className="job-status error-status">{error}</p>}
          <button type="button" className="primary-button" onClick={connect} disabled={busy}>{busy ? "Validating..." : "Validate & connect"}</button>
        </div>
      </section>
    </div>}
  </>;
}
