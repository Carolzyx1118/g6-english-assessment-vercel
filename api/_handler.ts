import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { createApp } from "../server/_core/app";

let appPromise: Promise<Express> | null = null;

function rewriteTrpcPath(req: IncomingMessage) {
  if (!req.url?.startsWith("/api/trpc?")) {
    return;
  }

  const url = new URL(req.url, "http://127.0.0.1");
  const trpcPath = url.searchParams.get("trpc");

  if (!trpcPath) {
    return;
  }

  url.searchParams.delete("trpc");
  const pathname = `/api/trpc/${trpcPath.replace(/^\/+/, "")}`;
  const search = url.searchParams.toString();
  req.url = `${pathname}${search ? `?${search}` : ""}`;
}

async function getApp() {
  if (!appPromise) {
    appPromise = createApp();
  }

  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  rewriteTrpcPath(req);
  const app = await getApp();
  return app(req as any, res as any);
}
