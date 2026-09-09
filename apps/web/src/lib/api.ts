let backendUrlPromise: Promise<string> | null = null;

async function discoverBackendUrl(): Promise<string> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("backend_url");
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
}

export function getApiBase(): Promise<string> {
  backendUrlPromise ??= discoverBackendUrl();
  return backendUrlPromise;
}

export async function waitForBackend(timeoutMs = 20_000): Promise<string> {
  const base = await getApiBase();
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return base;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Local backend did not become ready${lastError instanceof Error ? `: ${lastError.message}` : ""}`);
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = await getApiBase();
  return fetch(`${base}${path}`, init);
}
