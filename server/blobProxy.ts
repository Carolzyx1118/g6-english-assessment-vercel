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
}

export function registerBlobProxyRoute(app: Express) {
  app.get(BLOB_PROXY_ROUTE, async (req, res) => {
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
      const upstream = await fetch(target.url, {
        headers: {
          Authorization: `Bearer ${ENV.blobReadWriteToken}`,
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
      });

      if (!upstream.body) {
        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.status(200).end(buffer);
        return;
      }

      Readable.fromWeb(upstream.body as never).pipe(res);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown blob proxy error";
      res.status(500).json({ error: "Blob proxy failed.", detail: message });
    }
  });
}
