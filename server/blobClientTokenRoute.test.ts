import { beforeEach, describe, expect, it, vi } from "vitest";

const generateClientTokenFromReadWriteToken = vi.fn();

vi.mock("@vercel/blob/client", () => ({
  generateClientTokenFromReadWriteToken,
}));

describe("createPaperAssetClientToken", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
  });

  it("issues a token for listening audio uploads", async () => {
    generateClientTokenFromReadWriteToken.mockResolvedValue("client-token");
    const { createPaperAssetClientToken } = await import("./blobClientTokenRoute");

    const token = await createPaperAssetClientToken({
      pathname: "paper-assets/audio-listening.mp3",
      contentType: "audio/mpeg",
      fileSize: 8 * 1024 * 1024,
    });

    expect(token).toBe("client-token");
    expect(generateClientTokenFromReadWriteToken).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "vercel_blob_rw_test",
        pathname: "paper-assets/audio-listening.mp3",
        allowedContentTypes: ["audio/mpeg"],
        allowOverwrite: true,
        addRandomSuffix: false,
      }),
    );
  });

  it("rejects non-audio uploads", async () => {
    const { createPaperAssetClientToken } = await import("./blobClientTokenRoute");

    await expect(
      createPaperAssetClientToken({
        pathname: "paper-assets/image.png",
        contentType: "image/png",
        fileSize: 1024,
      }),
    ).rejects.toThrow("Only audio uploads are supported.");
  });
});
