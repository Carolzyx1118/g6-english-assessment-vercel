import type { IncomingMessage, ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import { ZodError } from "zod";
import { createPaperAssetClientToken } from "../../server/blobClientTokenRoute";

type JsonObject = Record<string, unknown>;

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
    const token = await createPaperAssetClientToken({
      pathname: typeof requestBody.pathname === "string" ? requestBody.pathname : "",
      contentType:
        typeof requestBody.contentType === "string" ? requestBody.contentType : "",
      fileSize:
        typeof requestBody.fileSize === "number" ? requestBody.fileSize : undefined,
    });

    respondJson(res, 200, { token });
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
