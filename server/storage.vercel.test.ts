import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unmock("./_core/env");
  vi.unmock("./_core/runtime");
  vi.unmock("@vercel/blob");
});

describe("storage on Vercel", () => {
  it("prefers Vercel Blob uploads when both Blob and Forge credentials are configured", async () => {
    const put = vi.fn().mockResolvedValue({
      url: "https://blob.vercel-storage.com/paper-assets/test-audio.webm",
    });

    vi.doMock("@vercel/blob", () => ({
      put,
      head: vi.fn(),
    }));

    vi.doMock("./_core/env", () => ({
      ENV: {
        appId: "",
        cookieSecret: "",
        databaseUrl: "",
        oAuthServerUrl: "",
        ownerOpenId: "",
        isProduction: true,
        forgeApiUrl: "https://forge.manus.im",
        forgeApiKey: "forge-token",
        blobReadWriteToken: "blob-token",
      },
      getForgeConfigStatus: () => ({
        isConfigured: true,
        missingVariables: [],
      }),
    }));

    vi.doMock("./_core/runtime", () => ({
      isVercelRuntime: () => true,
      getWritableDataPath: (...segments: string[]) => `/tmp/${segments.join("/")}`,
    }));

    const { storagePut } = await import("./storage");

    const result = await storagePut("paper-assets/test-audio.webm", "hello", "audio/webm");

    expect(result.url).toBe("/api/blob?key=paper-assets%2Ftest-audio.webm");
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      "paper-assets/test-audio.webm",
      expect.any(Buffer),
      expect.objectContaining({
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "audio/webm",
      })
    );
  });

  it("uses Vercel Blob when Forge storage is not configured", async () => {
    const put = vi.fn().mockResolvedValue({
      url: "https://blob.vercel-storage.com/paper-assets/test.txt",
    });

    vi.doMock("@vercel/blob", () => ({
      put,
      head: vi.fn(),
    }));

    vi.doMock("./_core/env", () => ({
      ENV: {
        appId: "",
        cookieSecret: "",
        databaseUrl: "",
        oAuthServerUrl: "",
        ownerOpenId: "",
        isProduction: true,
        forgeApiUrl: "",
        forgeApiKey: "",
        blobReadWriteToken: "blob-token",
      },
      getForgeConfigStatus: () => ({
        isConfigured: false,
        missingVariables: [
          "BUILT_IN_FORGE_API_URL",
          "BUILT_IN_FORGE_API_KEY",
        ],
      }),
    }));

    vi.doMock("./_core/runtime", () => ({
      isVercelRuntime: () => true,
      getWritableDataPath: (...segments: string[]) => `/tmp/${segments.join("/")}`,
    }));

    const { storagePut } = await import("./storage");

    const result = await storagePut("paper-assets/test.txt", "hello", "text/plain");

    expect(result.url).toBe("/api/blob?key=paper-assets%2Ftest.txt");
    expect(put).toHaveBeenCalledWith(
      "paper-assets/test.txt",
      expect.any(Buffer),
      expect.objectContaining({
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "text/plain",
      })
    );
  });

  it("falls back to public uploads when the Blob store does not support private access", async () => {
    const put = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Vercel Blob: Cannot use private access on a public store. The store is configured with public access.")
      )
      .mockResolvedValueOnce({
        url: "https://blob.vercel-storage.com/paper-assets/public-file.txt",
      });

    vi.doMock("@vercel/blob", () => ({
      put,
      head: vi.fn(),
    }));

    vi.doMock("./_core/env", () => ({
      ENV: {
        appId: "",
        cookieSecret: "",
        databaseUrl: "",
        oAuthServerUrl: "",
        ownerOpenId: "",
        isProduction: true,
        forgeApiUrl: "",
        forgeApiKey: "",
        blobReadWriteToken: "blob-token",
      },
      getForgeConfigStatus: () => ({
        isConfigured: false,
        missingVariables: [
          "BUILT_IN_FORGE_API_URL",
          "BUILT_IN_FORGE_API_KEY",
        ],
      }),
    }));

    vi.doMock("./_core/runtime", () => ({
      isVercelRuntime: () => true,
      getWritableDataPath: (...segments: string[]) => `/tmp/${segments.join("/")}`,
    }));

    const { storagePut } = await import("./storage");

    const result = await storagePut("paper-assets/public-file.txt", "hello", "text/plain");

    expect(result.url).toBe("https://blob.vercel-storage.com/paper-assets/public-file.txt");
    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenNthCalledWith(
      1,
      "paper-assets/public-file.txt",
      expect.any(Buffer),
      expect.objectContaining({ access: "private" })
    );
    expect(put).toHaveBeenNthCalledWith(
      2,
      "paper-assets/public-file.txt",
      expect.any(Buffer),
      expect.objectContaining({ access: "public" })
    );
  });

  it("fails fast on Vercel when no remote storage is configured", async () => {
    vi.doMock("@vercel/blob", () => ({
      put: vi.fn(),
      head: vi.fn(),
    }));

    vi.doMock("./_core/env", () => ({
      ENV: {
        appId: "",
        cookieSecret: "",
        databaseUrl: "",
        oAuthServerUrl: "",
        ownerOpenId: "",
        isProduction: true,
        forgeApiUrl: "",
        forgeApiKey: "",
        blobReadWriteToken: "",
      },
      getForgeConfigStatus: () => ({
        isConfigured: false,
        missingVariables: [
          "BUILT_IN_FORGE_API_URL",
          "BUILT_IN_FORGE_API_KEY",
        ],
      }),
    }));

    vi.doMock("./_core/runtime", () => ({
      isVercelRuntime: () => true,
      getWritableDataPath: (...segments: string[]) => `/tmp/${segments.join("/")}`,
    }));

    const { storagePut } = await import("./storage");

    await expect(
      storagePut("paper-assets/test.txt", "hello", "text/plain")
    ).rejects.toThrow(
      "Uploads on Vercel require BLOB_READ_WRITE_TOKEN or BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY."
    );
  });
});
