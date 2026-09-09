import { v2 as cloudinary } from "cloudinary";
import { Storage } from "@google-cloud/storage";
import { decryptedActiveSettings, type StorageProvider } from "./storageSettings.js";

export async function validateCloudinary(credentials: { cloudName: string; apiKey: string; apiSecret: string }): Promise<void> {
  const client = cloudinary.config({ cloud_name: credentials.cloudName, api_key: credentials.apiKey, api_secret: credentials.apiSecret });
  await cloudinary.api.ping({ auth: client });
}

export async function validateGcs(credentials: { bucketName: string; serviceAccountJson: string }): Promise<void> {
  const parsed = JSON.parse(credentials.serviceAccountJson) as Record<string, unknown>;
  const storage = new Storage({ credentials: parsed });
  const [exists] = await storage.bucket(credentials.bucketName).exists();
  if (!exists) throw new Error("GCS bucket does not exist or is not accessible");
}

export function getActiveUploader(): { provider: StorageProvider; upload: (url: string) => Promise<string> } {
  const settings = decryptedActiveSettings();
  if (!settings?.active_provider) throw new Error("No active storage account");

  if (settings.active_provider === "cloudinary") {
    if (!settings.cloud_name || !settings.api_key || !settings.api_secret) throw new Error("Cloudinary credentials are incomplete");
    const credentials = { cloud_name: settings.cloud_name, api_key: settings.api_key, api_secret: settings.api_secret };
    cloudinary.config(credentials);
    return {
      provider: "cloudinary",
      // Passing credentials on the operation keeps an in-flight scrape bound to
      // the account it started with even if the user switches accounts meanwhile.
      upload: async (url) => (await cloudinary.uploader.upload(url, credentials)).secure_url,
    };
  }

  if (!settings.gcs_bucket_name || !settings.gcs_service_account_json) throw new Error("GCS credentials are incomplete");
  const storage = new Storage({ credentials: JSON.parse(settings.gcs_service_account_json) });
  const bucket = storage.bucket(settings.gcs_bucket_name);
  return {
    provider: "gcs",
    upload: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not download source image (${response.status})`);
      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      const extension = contentType.split("/")[1]?.split(";")[0] ?? "bin";
      const name = `scrapelium/${crypto.randomUUID()}.${extension}`;
      const file = bucket.file(name);
      await file.save(Buffer.from(await response.arrayBuffer()), { contentType, resumable: false });
      return `https://storage.googleapis.com/${encodeURIComponent(bucket.name)}/${name.split("/").map(encodeURIComponent).join("/")}`;
    },
  };
}
