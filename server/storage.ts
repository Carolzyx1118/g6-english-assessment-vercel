// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { head, put } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import { ENV } from './_core/env';
import { getForgeConfigStatus } from "./_core/env";
import { moduleDir } from "./_core/paths";
import { getWritableDataPath, isVercelRuntime } from "./_core/runtime";

type StorageConfig = { baseUrl: string; apiKey: string };

export const LOCAL_STORAGE_ROUTE = "/local-paper-assets";
export const BLOB_PROXY_ROUTE = "/api/blob";
const CURRENT_DIR = moduleDir(import.meta.url);
export const LOCAL_STORAGE_DIR = isVercelRuntime()
  ? getWritableDataPath("local-paper-assets")
  : path.resolve(CURRENT_DIR, "..", "local-paper-assets");

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function toBuffer(data: Buffer | Uint8Array | string) {
  if (typeof data === "string") {
    return Buffer.from(data);
  }

  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

function hasBlobStorageConfig() {
  return Boolean(ENV.blobReadWriteToken);
}

export function buildBlobProxyUrl(relKey: string) {
  return `${BLOB_PROXY_ROUTE}?key=${encodeURIComponent(normalizeKey(relKey))}`;
}

async function storagePutLocal(
  relKey: string,
  data: Buffer | Uint8Array | string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const fullPath = path.join(LOCAL_STORAGE_DIR, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  const buffer =
    toBuffer(data);

  await fs.writeFile(fullPath, buffer);
  return {
    key,
    url: `${LOCAL_STORAGE_ROUTE}/${key}`,
  };
}

async function storagePutBlob(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const body = toBuffer(data);
  const putBlob = async (access: "private" | "public") =>
    put(
      key,
      body,
      {
        access: access as "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
      } as Parameters<typeof put>[2]
    );

  try {
    await putBlob("private");
    return {
      key,
      url: buildBlobProxyUrl(key),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const canRetryPublic =
      message.includes("cannot use private access on a public store") ||
      message.includes("private access") && message.includes("public store");

    if (!canRetryPublic) {
      throw error;
    }
  }

  const blob = await putBlob("public");
  return {
    key,
    url: blob.url,
  };
}

async function storageGetBlob(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  await head(key);

  return {
    key,
    url: buildBlobProxyUrl(key),
  };
}

export async function getBlobProxyTarget(relKey: string) {
  const key = normalizeKey(relKey);
  const blob = await head(key);

  return {
    key,
    url: blob.url,
    contentType: blob.contentType,
    contentDisposition: blob.contentDisposition,
    cacheControl: blob.cacheControl,
  };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (hasBlobStorageConfig()) {
    return storagePutBlob(relKey, data, contentType);
  }

  const forge = getForgeConfigStatus();
  if (forge.isConfigured) {
    const { baseUrl, apiKey } = getStorageConfig();
    const key = normalizeKey(relKey);
    const uploadUrl = buildUploadUrl(baseUrl, key);
    const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: buildAuthHeaders(apiKey),
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(
        `Storage upload failed (${response.status} ${response.statusText}): ${message}`
      );
    }
    const url = (await response.json()).url;
    return { key, url };
  }

  if (isVercelRuntime()) {
    throw new Error(
      "Uploads on Vercel require BLOB_READ_WRITE_TOKEN or BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY."
    );
  }

  return storagePutLocal(relKey, data);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const forge = getForgeConfigStatus();
  if (forge.isConfigured) {
    const { baseUrl, apiKey } = getStorageConfig();
    const key = normalizeKey(relKey);
    return {
      key,
      url: await buildDownloadUrl(baseUrl, key, apiKey),
    };
  }

  if (hasBlobStorageConfig()) {
    return storageGetBlob(relKey);
  }

  if (isVercelRuntime()) {
    throw new Error(
      "File reads on Vercel require BLOB_READ_WRITE_TOKEN or BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY."
    );
  }

  const key = normalizeKey(relKey);
  return {
    key,
    url: `${LOCAL_STORAGE_ROUTE}/${key}`,
  };
}
