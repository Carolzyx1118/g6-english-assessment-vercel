import fs from "fs/promises";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const TEST_KEY = "paper-assets/local-fallback-audio.mp3";
const TEST_PATH = path.resolve(import.meta.dirname, "..", "local-paper-assets", TEST_KEY);

afterEach(async () => {
  vi.resetModules();
  vi.unmock("./_core/env");
  vi.unmock("./_core/runtime");
  vi.unmock("@vercel/blob");
  await fs.rm(TEST_PATH, { force: true });
});

describe("storage local fallback", () => {
  it("falls back to local storage when forge upload setup is invalid outside Vercel", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: {
        appId: "",
        cookieSecret: "",
        databaseUrl: "",
        oAuthServerUrl: "",
        ownerOpenId: "",
        isProduction: false,
        forgeApiUrl: "not-a-valid-url",
        forgeApiKey: "forge-token",
        blobReadWriteToken: "",
      },
      getForgeConfigStatus: () => ({
        isConfigured: true,
        missingVariables: [],
      }),
    }));

    vi.doMock("./_core/runtime", () => ({
      isVercelRuntime: () => false,
      getWritableDataPath: (...segments: string[]) => path.join("/tmp", ...segments),
    }));

    vi.doMock("@vercel/blob", () => ({
      put: vi.fn(),
      head: vi.fn(),
    }));

    const { storagePut } = await import("./storage");
    const result = await storagePut(TEST_KEY, "hello world", "audio/mpeg");

    expect(result.url).toBe(`/local-paper-assets/${TEST_KEY}`);
    expect(await fs.readFile(TEST_PATH, "utf8")).toBe("hello world");
  });
});
