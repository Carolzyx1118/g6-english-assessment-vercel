import type { IncomingMessage, ServerResponse } from "node:http";

let appPromise: Promise<{
  (req: IncomingMessage, res: ServerResponse): unknown;
}> | null = null;

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
    appPromise = import("../server/_core/app").then(({ createApp }) =>
      createApp()
    ) as Promise<{
      (req: IncomingMessage, res: ServerResponse): unknown;
    }>;
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
    return app(req, res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server startup error";
    const stack =
      error instanceof Error && error.stack
        ? error.stack.split("\n").slice(0, 6).join("\n")
        : String(error);

    console.error("[Vercel handler] Startup failed", error);

    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "SERVER_STARTUP_FAILED",
        message,
        stack,
      })
    );
  }
}
