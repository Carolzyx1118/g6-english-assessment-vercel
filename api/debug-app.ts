import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const { default: bundledHandler } = await import("./_generated/rpc-handler.js");

    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: true,
        handlerType: typeof bundledHandler,
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
