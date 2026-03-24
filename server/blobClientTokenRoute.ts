import type { Express, Request, Response } from "express";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { z } from "zod";

const PAPER_ASSET_PREFIX = "paper-assets/";
const MAX_CLIENT_UPLOAD_BYTES = 100 * 1024 * 1024;
const CLIENT_TOKEN_TTL_MS = 15 * 60 * 1000;

const blobClientTokenSchema = z.object({
  pathname: z
    .string()
    .trim()
    .min(1)
    .regex(/^paper-assets\/[a-zA-Z0-9._/-]+$/, "Invalid asset path."),
  contentType: z
    .string()
    .trim()
    .min(1)
    .regex(/^audio\/[a-zA-Z0-9.+-]+$/, "Only audio uploads are supported."),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_CLIENT_UPLOAD_BYTES)
    .optional(),
});

export async function createPaperAssetClientToken(input: {
  pathname: string;
  contentType: string;
  fileSize?: number;
}) {
  const parsed = blobClientTokenSchema.parse(input);

  if (!parsed.pathname.startsWith(PAPER_ASSET_PREFIX)) {
    throw new Error("Asset uploads must stay inside paper-assets/.");
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Direct blob uploads are not available in this environment.");
  }

  const maximumSizeInBytes = Math.min(
    Math.max(parsed.fileSize ?? 0, 10 * 1024 * 1024),
    MAX_CLIENT_UPLOAD_BYTES,
  );

  return generateClientTokenFromReadWriteToken({
    token,
    pathname: parsed.pathname,
    allowedContentTypes: [parsed.contentType],
    maximumSizeInBytes,
    validUntil: Date.now() + CLIENT_TOKEN_TTL_MS,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function handleBlobClientTokenRequest(req: Request, res: Response) {
  try {
    const clientToken = await createPaperAssetClientToken(req.body ?? {});
    res.status(200).json({ token: clientToken });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate upload token.";
    const statusCode =
      message.includes("Direct blob uploads are not available")
        ? 503
        : error instanceof z.ZodError
          ? 400
          : 500;

    if (statusCode >= 500) {
      console.error("[BlobClientTokenRoute] Failed to issue upload token", error);
    }

    res.status(statusCode).json({ message });
  }
}

export function registerBlobClientTokenRoute(app: Express) {
  app.post("/api/blob/client-token", handleBlobClientTokenRequest);
}
