import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { createApp } from "../server/_core/app";

let appPromise: Promise<Express> | null = null;

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
  const app = await getApp();
  return app(req as any, res as any);
}
