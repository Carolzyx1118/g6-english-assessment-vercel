import { upload as uploadBlob } from "@vercel/blob/client";

const BLOB_PROXY_ROUTE = "/api/blob";
const MULTIPART_UPLOAD_THRESHOLD_BYTES = 20 * 1024 * 1024;
const DIRECT_UPLOAD_TIMEOUT_MS = 120_000;
const SERVER_UPLOAD_TIMEOUT_MS = 60_000;
const PREFERRED_SERVER_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
const HOSTED_SERVER_UPLOAD_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

type BlobUploadAccess = "private" | "public";

function buildBlobProxyUrl(key: string) {
  return `${BLOB_PROXY_ROUTE}?key=${encodeURIComponent(key.replace(/^\/+/, ""))}`;
}

function isStorageConfigurationError(message: string) {
  return (
    message.includes("BLOB_READ_WRITE_TOKEN")
    || message.includes("Direct blob uploads are not available")
    || message.includes("Uploads on Vercel require")
  );
}

function isServerUploadBodyLimitError(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("request entity too large")
    || normalized.includes("request too large")
    || normalized.includes("payload too large")
    || (
      normalized.includes("unexpected token 'r'")
      && normalized.includes("not valid json")
    )
  );
}

function getDirectUploadAttempts(blobSize: number) {
  const multipart = blobSize >= MULTIPART_UPLOAD_THRESHOLD_BYTES;
  return [
    { access: "private" as const, multipart },
    { access: "public" as const, multipart },
  ];
}

function getClientUploadResultUrl(pathname: string, access: BlobUploadAccess, uploadedUrl: string) {
  if (access === "private") {
    return buildBlobProxyUrl(pathname);
  }
  return uploadedUrl;
}

export function shouldPreferDirectBlobUpload() {
  if (typeof window === "undefined") return false;
  return !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

export function getFriendlyAudioUploadErrorMessage(
  error: unknown,
  fallback = "Failed to save recording.",
) {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  if (isStorageConfigurationError(rawMessage)) {
    return "This Vercel deployment is missing file storage. Add BLOB_READ_WRITE_TOKEN in Project Settings and redeploy.";
  }
  if (isServerUploadBodyLimitError(rawMessage)) {
    return "The fallback server upload exceeded Vercel's request size limit. Retry the upload after Blob direct upload is working, or use a smaller audio file.";
  }
  return rawMessage || fallback;
}

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
  const pathname = `paper-assets/${fileName}`;
  const clientPayload = JSON.stringify({
    contentType: normalizedContentType,
    fileSize: blob.size,
  });

  const uploadDirectly = async () => {
    const directErrors: string[] = [];

    for (const { access, multipart } of getDirectUploadAttempts(blob.size)) {
      try {
        const uploaded = await withTimeout(
          uploadBlob(pathname, blob, {
            access: access as "public",
            contentType: normalizedContentType,
            handleUploadUrl: "/api/blob/client-token",
            clientPayload,
            multipart,
          }),
          DIRECT_UPLOAD_TIMEOUT_MS,
          "Direct audio upload",
        );
        return getClientUploadResultUrl(pathname, access, uploaded.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown direct upload error.";
        directErrors.push(message);
        console.warn(
          `[audioUpload] Direct upload attempt failed (${access}${multipart ? ", multipart" : ""}).`,
          error,
        );
      }
    }

    throw new Error(directErrors[directErrors.length - 1] || "Direct audio upload failed.");
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
  const preferDirectUpload = shouldPreferDirectBlobUpload();
  const canUseServerFallback = !preferDirectUpload || blob.size <= HOSTED_SERVER_UPLOAD_FALLBACK_MAX_BYTES;
  const tryServerFirst = blob.size <= PREFERRED_SERVER_UPLOAD_MAX_BYTES;
  const strategies = preferDirectUpload
    ? canUseServerFallback
      ? [uploadDirectly, uploadViaServer]
      : [uploadDirectly]
    : tryServerFirst
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

  throw new Error(
    getFriendlyAudioUploadErrorMessage(
      new Error(errors[errors.length - 1] || ""),
      "Failed to save recording.",
    ),
  );
}
