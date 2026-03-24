import type { IncomingMessage } from "node:http";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";

const PAPER_ASSET_PREFIX = "paper-assets/";
const MAX_CLIENT_UPLOAD_BYTES = 100 * 1024 * 1024;

const pathnameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^paper-assets\/[a-zA-Z0-9._/-]+$/, "Invalid asset path.");

const clientPayloadSchema = z.object({
  contentType: z
    .string()
    .trim()
    .min(1)
    .regex(/^audio\/[a-zA-Z0-9.+-]+$/, "Only audio uploads are supported."),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_CLIENT_UPLOAD_BYTES, "Audio file is too large."),
});

function parseClientPayload(clientPayload: string | null | undefined) {
  if (!clientPayload) {
    throw new Error("Missing upload payload.");
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(clientPayload);
  } catch {
    throw new Error("Upload payload must be valid JSON.");
  }

  return clientPayloadSchema.parse(parsedPayload);
}

export function createPaperAssetUploadConfig(
  pathname: string,
  clientPayload: string | null | undefined,
) {
  const validatedPathname = pathnameSchema.parse(pathname);
  if (!validatedPathname.startsWith(PAPER_ASSET_PREFIX)) {
    throw new Error("Asset uploads must stay inside paper-assets/.");
  }

  const { contentType, fileSize } = parseClientPayload(clientPayload);

  return {
    allowedContentTypes: [contentType],
    maximumSizeInBytes: fileSize,
    allowOverwrite: true,
    addRandomSuffix: false,
  };
}

export async function processPaperAssetUploadRequest({
  request,
  body,
}: {
  request: IncomingMessage | Request;
  body: HandleUploadBody;
}) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Direct blob uploads are not available in this environment.");
  }

  return handleUpload({
    token,
    request,
    body,
    onBeforeGenerateToken: async (pathname, clientPayload) => (
      createPaperAssetUploadConfig(pathname, clientPayload)
    ),
    onUploadCompleted: async () => {
      // Paper intake persists the uploaded URL in the blueprint immediately.
    },
  });
}
