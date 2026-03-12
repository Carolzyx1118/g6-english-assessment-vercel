import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const { createApp } = await import("../server/_core/app");
    const app = await createApp();

    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: true,
        appType: typeof app,
      })
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown debug app error";
    const stack =
      error instanceof Error && error.stack
        ? error.stack.split("\n").slice(0, 8).join("\n")
        : String(error);

    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: false,
        message,
        stack,
      })
    );
  }
}
