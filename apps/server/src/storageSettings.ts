import Database from "better-sqlite3";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DB_PATH } from "./productsStore.js";

export type StorageProvider = "cloudinary" | "gcs";

interface StorageRow {
  workspace_id: string;
  cloud_name: string | null;
  api_key: string | null;
  api_secret: string | null;
  gcs_bucket_name: string | null;
  gcs_service_account_json: string | null;
  active_provider: StorageProvider | null;
}

const WORKSPACE_ID = process.env.SCRAPELIUM_WORKSPACE_ID ?? "default";
const keyPath = process.env.SCRAPELIUM_CREDENTIAL_KEY_PATH ?? `${DB_PATH}.key`;

function openDb(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS StorageSettings (
      workspace_id TEXT PRIMARY KEY,
      cloud_name TEXT,
      api_key TEXT,
      api_secret TEXT,
      gcs_bucket_name TEXT,
      gcs_service_account_json TEXT,
      active_provider TEXT CHECK(active_provider IN ('cloudinary', 'gcs') OR active_provider IS NULL),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return db;
}

function encryptionKey(): Buffer {
  const configured = process.env.SCRAPELIUM_CREDENTIAL_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) throw new Error("SCRAPELIUM_CREDENTIAL_KEY must be a 32-byte base64 value");
    return key;
  }
  if (existsSync(keyPath)) return Buffer.from(readFileSync(keyPath, "utf8"), "base64");
  mkdirSync(dirname(keyPath), { recursive: true });
  const key = randomBytes(32);
  writeFileSync(keyPath, key.toString("base64"), { encoding: "utf8", mode: 0o600 });
  return key;
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string): string {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function getStorageSettings(): StorageRow | null {
  const db = openDb();
  try {
    return (db.prepare("SELECT * FROM StorageSettings WHERE workspace_id = ?").get(WORKSPACE_ID) as StorageRow | undefined) ?? null;
  } finally { db.close(); }
}

export function saveCloudinary(input: { cloudName: string; apiKey: string; apiSecret: string }): void {
  const db = openDb();
  try {
    db.prepare(`INSERT INTO StorageSettings (workspace_id, cloud_name, api_key, api_secret, active_provider)
      VALUES (?, ?, ?, ?, 'cloudinary') ON CONFLICT(workspace_id) DO UPDATE SET
      cloud_name=excluded.cloud_name, api_key=excluded.api_key, api_secret=excluded.api_secret,
      active_provider='cloudinary', updated_at=CURRENT_TIMESTAMP`).run(
      WORKSPACE_ID, input.cloudName, encrypt(input.apiKey), encrypt(input.apiSecret),
    );
  } finally { db.close(); }
}

export function saveGcs(input: { bucketName: string; serviceAccountJson: string }): void {
  const db = openDb();
  try {
    db.prepare(`INSERT INTO StorageSettings (workspace_id, gcs_bucket_name, gcs_service_account_json, active_provider)
      VALUES (?, ?, ?, 'gcs') ON CONFLICT(workspace_id) DO UPDATE SET
      gcs_bucket_name=excluded.gcs_bucket_name, gcs_service_account_json=excluded.gcs_service_account_json,
      active_provider='gcs', updated_at=CURRENT_TIMESTAMP`).run(
      WORKSPACE_ID, input.bucketName, encrypt(input.serviceAccountJson),
    );
  } finally { db.close(); }
}

export function decryptedActiveSettings(): (StorageRow & { api_key: string | null; api_secret: string | null; gcs_service_account_json: string | null }) | null {
  const row = getStorageSettings();
  if (!row?.active_provider) return null;
  return {
    ...row,
    api_key: row.api_key ? decrypt(row.api_key) : null,
    api_secret: row.api_secret ? decrypt(row.api_secret) : null,
    gcs_service_account_json: row.gcs_service_account_json ? decrypt(row.gcs_service_account_json) : null,
  };
}

export function logoutActiveProvider(): StorageProvider | null {
  const current = getStorageSettings()?.active_provider ?? null;
  if (!current) return null;
  const db = openDb();
  try {
    const fields = current === "cloudinary"
      ? "cloud_name=NULL, api_key=NULL, api_secret=NULL"
      : "gcs_bucket_name=NULL, gcs_service_account_json=NULL";
    db.prepare(`UPDATE StorageSettings SET ${fields}, active_provider=NULL, updated_at=CURRENT_TIMESTAMP WHERE workspace_id=?`).run(WORKSPACE_ID);
  } finally { db.close(); }
  return current;
}
