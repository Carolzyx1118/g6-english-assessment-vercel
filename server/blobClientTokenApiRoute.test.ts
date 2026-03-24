import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createPaperAssetClientToken = vi.fn();

vi.mock("./blobClientTokenRoute", () => ({
  createPaperAssetClientToken,
}));

function createRequest(method: string, body?: unknown) {
  const chunks = body === undefined ? [] : [JSON.stringify(body)];
  const req = Readable.from(chunks) as Readable & {
    method?: string;
    headers?: Record<string, string>;
  };
  req.method = method;
  req.headers = { "content-type": "application/json" };
  return req;
}

function createResponse() {
  let body = "";
  const headers = new Map<string, string>();

  return {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    end(payload?: string) {
      body = payload ?? "";
    },
    getBody() {
      return body;
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
  };
}

describe("/api/blob/client-token", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a client upload token for listening audio", async () => {
    createPaperAssetClientToken.mockResolvedValue("client-token");
    const { default: handler } = await import("../api/blob/client-token");
    const req = createRequest("POST", {
      pathname: "paper-assets/audio-listening.mp3",
      contentType: "audio/mpeg",
      fileSize: 1024,
    });
    const res = createResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.getHeader("content-type")).toContain("application/json");
    expect(JSON.parse(res.getBody())).toEqual({ token: "client-token" });
    expect(createPaperAssetClientToken).toHaveBeenCalledWith({
      pathname: "paper-assets/audio-listening.mp3",
      contentType: "audio/mpeg",
      fileSize: 1024,
    });
  });

  it("rejects unsupported methods", async () => {
    const { default: handler } = await import("../api/blob/client-token");
    const req = createRequest("GET");
    const res = createResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(res.getHeader("allow")).toBe("POST, OPTIONS");
  });
});
