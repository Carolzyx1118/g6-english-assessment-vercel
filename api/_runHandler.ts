import type { IncomingMessage, ServerResponse } from "node:http";

export default async function runHandler(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const { default: handler } = await import("./_handler");
    return handler(req, res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown route startup error";
    const stack =
      error instanceof Error && error.stack
        ? error.stack.split("\n").slice(0, 6).join("\n")
        : String(error);

    console.error("[Vercel route] Failed to load shared handler", error);

    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "ROUTE_STARTUP_FAILED",
        message,
        stack,
      })
    );
  }
}
