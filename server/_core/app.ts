import express, { type Express } from "express";
import fs from "node:fs/promises";
import type { Server } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { LOCAL_STORAGE_DIR, LOCAL_STORAGE_ROUTE } from "../storage";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { serveStatic, setupVite } from "./vite";

export type CreateAppOptions = {
  serveClient?: boolean;
  server?: Server;
};

export async function createApp({
  serveClient = false,
  server,
}: CreateAppOptions = {}): Promise<Express> {
  const app = express();

  await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(LOCAL_STORAGE_ROUTE, express.static(LOCAL_STORAGE_DIR));

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (!serveClient) {
    return app;
  }

  if (process.env.NODE_ENV === "development") {
    if (!server) {
      throw new Error("A Node HTTP server is required to run Vite middleware");
    }
    await setupVite(app, server);
    return app;
  }

  serveStatic(app);
  return app;
}
