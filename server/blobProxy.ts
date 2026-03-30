import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";
import { ENV } from "./_core/env";
import { BLOB_PROXY_ROUTE, getBlobProxyTarget } from "./storage";

function getBlobKey(req: Request) {
  const rawKey = req.query.key;
  return typeof rawKey === "string" ? rawKey.trim() : "";
}

function setBlobHeaders(res: Response, headers: {
  contentType?: string;
  contentDisposition?: string;
  cacheControl?: string;
  contentLength?: string;
  contentRange?: string;
  acceptRanges?: string;
}) {
  if (headers.contentType) {
    res.setHeader("content-type", headers.contentType);
  }
  if (headers.contentDisposition) {
    res.setHeader("content-disposition", headers.contentDisposition);
  }
  if (headers.cacheControl) {
    res.setHeader("cache-control", headers.cacheControl);
  }
  if (headers.contentLength) {
    res.setHeader("content-length", headers.contentLength);
  }
  if (headers.contentRange) {
    res.setHeader("content-range", headers.contentRange);
  }
  if (headers.acceptRanges) {
    res.setHeader("accept-ranges", headers.acceptRanges);
  }
}

async function proxyBlobRequest(req: Request, res: Response) {
  const key = getBlobKey(req);
  if (!key) {
    res.status(400).json({ error: "Missing blob key." });
    return;
  }

  if (!ENV.blobReadWriteToken) {
    res.status(503).json({ error: "BLOB_READ_WRITE_TOKEN is not configured." });
    return;
  }

  try {
    const target = await getBlobProxyTarget(key);
    const rangeHeader = typeof req.headers.range === "string" ? req.headers.range : undefined;
    const upstream = await fetch(target.url, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: {
        Authorization: `Bearer ${ENV.blobReadWriteToken}`,
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });

    if (!upstream.ok) {
      const message = await upstream.text().catch(() => upstream.statusText);
      res.status(upstream.status).json({
        error: `Blob fetch failed: ${upstream.status} ${upstream.statusText}`,
        detail: message,
      });
      return;
    }

    setBlobHeaders(res, {
      contentType: upstream.headers.get("content-type") ?? target.contentType,
      contentDisposition:
        upstream.headers.get("content-disposition") ?? target.contentDisposition,
      cacheControl: upstream.headers.get("cache-control") ?? target.cacheControl,
      contentLength: upstream.headers.get("content-length") ?? undefined,
      contentRange: upstream.headers.get("content-range") ?? undefined,
      acceptRanges: upstream.headers.get("accept-ranges") ?? undefined,
    });

    res.status(upstream.status);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    if (!upstream.body) {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.end(buffer);
      return;
    }

    Readable.fromWeb(upstream.body as never).pipe(res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown blob proxy error";
    res.status(500).json({ error: "Blob proxy failed.", detail: message });
  }
}

export function registerBlobProxyRoute(app: Express) {
  app.get(BLOB_PROXY_ROUTE, proxyBlobRequest);
  app.head(BLOB_PROXY_ROUTE, proxyBlobRequest);
}
