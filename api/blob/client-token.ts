import type { IncomingMessage, ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import { handleUpload } from "@vercel/blob/client";
import { ZodError, z } from "zod";

type JsonObject = Record<string, unknown>;
type UploadBody = Parameters<typeof handleUpload>[0]["body"];

const PAPER_ASSET_PREFIX = "paper-assets/";
const MAX_CLIENT_UPLOAD_BYTES = 100 * 1024 * 1024;

const pathnameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^paper-assets\/[a-zA-Z0-9._/-]+$/, "Invalid asset path.");

const audioContentTypeSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.split(";")[0]?.trim().toLowerCase() || "")
  .pipe(
    z
      .string()
      .trim()
      .min(1)
      .regex(/^audio\/[a-zA-Z0-9.+-]+$/, "Only audio uploads are supported."),
  );

const clientPayloadSchema = z.object({
  contentType: audioContentTypeSchema,
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_CLIENT_UPLOAD_BYTES, "Audio file is too large."),
});

async function readJsonBody(req: IncomingMessage): Promise<JsonObject> {
  const maybeBody = req as IncomingMessage & { body?: unknown };
  if (
    maybeBody.body &&
    typeof maybeBody.body === "object" &&
    !Array.isArray(maybeBody.body)
  ) {
    return maybeBody.body as JsonObject;
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
  } catch {
    // Fall through to the shared validation error below.
  }

  throw new ZodError([
    {
      code: "custom",
      message: "Request body must be a JSON object.",
      path: [],
    },
  ]);
}

function respondJson(
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

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

function createUploadConfig(
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

async function processUploadRequest(
  request: IncomingMessage,
  body: UploadBody,
) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Direct blob uploads are not available in this environment.");
  }

  return handleUpload({
    token,
    request,
    body,
    onBeforeGenerateToken: async (pathname, clientPayload) =>
      createUploadConfig(pathname, clientPayload),
    onUploadCompleted: async () => {
      // Paper intake persists the uploaded URL in the blueprint immediately.
    },
  });
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("allow", "POST, OPTIONS");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("allow", "POST, OPTIONS");
    respondJson(res, 405, { message: "Method not allowed." });
    return;
  }

  try {
    const requestBody = await readJsonBody(req);
    const payload = await processUploadRequest(
      req,
      requestBody as unknown as UploadBody,
    );

    respondJson(res, 200, payload as Record<string, unknown>);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate upload token.";
    const statusCode =
      message.includes("Direct blob uploads are not available")
        ? 503
        : error instanceof ZodError
          ? 400
          : 500;

    if (statusCode >= 500) {
      console.error("[BlobClientTokenApi] Failed to issue upload token", error);
    }

    respondJson(res, statusCode, { message });
  }
}
