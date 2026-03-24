import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const processPaperAssetUploadRequest = vi.fn();

vi.mock("./blobClientUpload", () => ({
  processPaperAssetUploadRequest,
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

  it("returns a client upload token payload for listening audio", async () => {
    processPaperAssetUploadRequest.mockResolvedValue({
      type: "blob.generate-client-token",
      clientToken: "client-token",
    });
    const { default: handler } = await import("../api/blob/client-token");
    const req = createRequest("POST", {
      type: "blob.generate-client-token",
      payload: {
        pathname: "paper-assets/audio-listening.mp3",
        callbackUrl: "https://example.com/api/blob/client-token",
        clientPayload: JSON.stringify({
          contentType: "audio/mpeg",
          fileSize: 1024,
        }),
        multipart: false,
      },
    });
    const res = createResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.getHeader("content-type")).toContain("application/json");
    expect(JSON.parse(res.getBody())).toEqual({
      type: "blob.generate-client-token",
      clientToken: "client-token",
    });
    expect(processPaperAssetUploadRequest).toHaveBeenCalledTimes(1);
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
