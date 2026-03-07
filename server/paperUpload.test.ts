import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    appId: "",
    cookieSecret: "",
    databaseUrl: "",
    oAuthServerUrl: "",
    ownerOpenId: "",
    isProduction: false,
    forgeApiUrl: "https://forge.example.com/",
    forgeApiKey: "test-key",
  },
  getForgeConfigStatus: () => ({
    isConfigured: true,
    missingVariables: [],
  }),
  getForgeConfigErrorMessage: () => "",
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock storagePut to avoid actual S3 calls
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    url: "https://s3.example.com/paper-assets/test-image.png",
    key: "paper-assets/test-image.png",
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("papers.uploadFile", () => {
  it("uploads a base64-encoded image and returns a URL", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Create a small 1x1 red PNG pixel as base64
    const base64Pixel =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const result = await caller.papers.uploadFile({
      fileName: "test-question-image.png",
      fileBase64: base64Pixel,
      contentType: "image/png",
    });

    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
    expect(typeof result.url).toBe("string");
    expect(result.url).toContain("https://");
    expect(result.key).toBeDefined();
    expect(typeof result.key).toBe("string");
  });

  it("handles different file types", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const base64Pixel =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    // Test with JPEG content type
    const jpegResult = await caller.papers.uploadFile({
      fileName: "photo.jpg",
      fileBase64: base64Pixel,
      contentType: "image/jpeg",
    });

    expect(jpegResult.url).toBeDefined();
    expect(jpegResult.key).toContain("paper-assets/");

    // Test with WebP content type
    const webpResult = await caller.papers.uploadFile({
      fileName: "image.webp",
      fileBase64: base64Pixel,
      contentType: "image/webp",
    });

    expect(webpResult.url).toBeDefined();
    expect(webpResult.key).toContain("paper-assets/");
  });

  it("sanitizes file names with special characters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const base64Pixel =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const result = await caller.papers.uploadFile({
      fileName: "测试图片 (1).png",
      fileBase64: base64Pixel,
      contentType: "image/png",
    });

    expect(result.url).toBeDefined();
    expect(result.key).toBeDefined();
    // Key should not contain spaces or special characters
    expect(result.key).not.toContain(" ");
    expect(result.key).not.toContain("(");
  });
});
