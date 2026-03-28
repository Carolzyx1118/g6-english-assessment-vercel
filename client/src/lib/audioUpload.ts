import { upload as uploadBlob } from "@vercel/blob/client";

const MULTIPART_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;
const DIRECT_UPLOAD_TIMEOUT_MS = 120_000;
const SERVER_UPLOAD_TIMEOUT_MS = 60_000;
const PREFERRED_SERVER_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

export type UploadFileMutationLike = {
  mutateAsync: (input: {
    fileName: string;
    fileBase64: string;
    contentType: string;
  }) => Promise<{ url: string }>;
};

export function normalizeAudioContentType(value: string | null | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() || "";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out. Please try again.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to encode recording."));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to encode recording."));
    reader.readAsDataURL(blob);
  });
}

async function blobToBase64(blob: Blob) {
  const dataUrl = await blobToDataUrl(blob);
  const [, base64 = ""] = dataUrl.split(",", 2);
  if (!base64) {
    throw new Error("Failed to encode recording.");
  }
  return base64;
}

export function getAudioExtension(mimeType: string) {
  const normalizedMimeType = normalizeAudioContentType(mimeType);
  if (normalizedMimeType.includes("mp4") || normalizedMimeType.includes("m4a")) return "m4a";
  if (normalizedMimeType.includes("mpeg") || normalizedMimeType.includes("mp3")) return "mp3";
  if (normalizedMimeType.includes("wav")) return "wav";
  if (normalizedMimeType.includes("ogg")) return "ogg";
  if (normalizedMimeType.includes("aac")) return "aac";
  return "webm";
}

export async function uploadAudioBlob({
  blob,
  contentType,
  fileName,
  uploadFileMutation,
}: {
  blob: Blob;
  contentType: string;
  fileName: string;
  uploadFileMutation: UploadFileMutationLike;
}) {
  const normalizedContentType = normalizeAudioContentType(contentType) || "audio/webm";
  const clientPayload = JSON.stringify({
    contentType: normalizedContentType,
    fileSize: blob.size,
  });

  const uploadDirectly = async () => {
    const uploaded = await withTimeout(
      uploadBlob(`paper-assets/${fileName}`, blob, {
        access: "public",
        contentType: normalizedContentType,
        handleUploadUrl: "/api/blob/client-token",
        clientPayload,
        multipart: blob.size >= MULTIPART_UPLOAD_THRESHOLD_BYTES,
      }),
      DIRECT_UPLOAD_TIMEOUT_MS,
      "Direct audio upload",
    );
    return uploaded.url;
  };

  const uploadViaServer = async () => {
    const fileBase64 = await blobToBase64(blob);
    const uploaded = await withTimeout(
      uploadFileMutation.mutateAsync({
        fileName,
        fileBase64,
        contentType: normalizedContentType,
      }),
      SERVER_UPLOAD_TIMEOUT_MS,
      "Audio save",
    );
    return uploaded.url;
  };

  const errors: string[] = [];
  const tryServerFirst = blob.size <= PREFERRED_SERVER_UPLOAD_MAX_BYTES;
  const strategies = tryServerFirst
    ? [uploadViaServer, uploadDirectly]
    : [uploadDirectly, uploadViaServer];

  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown upload error.";
      errors.push(message);
      console.warn("[audioUpload] Upload attempt failed.", error);
    }
  }

  throw new Error(errors[errors.length - 1] || "Failed to save recording.");
}
