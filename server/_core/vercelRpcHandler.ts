import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { registerBlobProxyRoute } from "../blobProxy";
import { appRouter } from "../routers";
import { LOCAL_STORAGE_DIR, LOCAL_STORAGE_ROUTE } from "../storage";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";

type RpcAppHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => unknown | Promise<unknown>;

let appPromise: Promise<RpcAppHandler> | null = null;

function rewriteTrpcPath(req: IncomingMessage) {
  if (!req.url?.startsWith("/api/rpc?")) {
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

async function createRpcApp(): Promise<RpcAppHandler> {
  const app = express();

  await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(LOCAL_STORAGE_ROUTE, express.static(LOCAL_STORAGE_DIR));
  registerBlobProxyRoute(app);

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app as unknown as RpcAppHandler;
}

async function getApp() {
  if (!appPromise) {
    appPromise = createRpcApp();
  }

  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    rewriteTrpcPath(req);
    const app = await getApp();
    return await app(req, res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown rpc startup error";
    const stack =
      error instanceof Error && error.stack
        ? error.stack.split("\n").slice(0, 8).join("\n")
        : String(error);

    console.error("[Vercel rpc] Startup failed", error);

    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "RPC_STARTUP_FAILED",
        message,
        stack,
      })
    );
  }
}
