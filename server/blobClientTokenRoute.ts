import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { processPaperAssetUploadRequest } from "./blobClientUpload";

async function handleBlobClientTokenRequest(req: Request, res: Response) {
  try {
    const payload = await processPaperAssetUploadRequest({
      request: req,
      body: req.body,
    });
    res.status(200).json(payload);
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
      console.error("[BlobClientTokenRoute] Failed to issue upload token", error);
    }

    res.status(statusCode).json({ message });
  }
}

export function registerBlobClientTokenRoute(app: Express) {
  app.post("/api/blob/client-token", handleBlobClientTokenRequest);
}
