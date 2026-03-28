import { describe, expect, it } from "vitest";
import { createPaperAssetUploadConfig } from "./blobClientUpload";

describe("createPaperAssetUploadConfig", () => {
  it("creates token constraints for listening audio uploads", () => {
    expect(
      createPaperAssetUploadConfig(
        "paper-assets/audio-listening.mp3",
        JSON.stringify({
          contentType: "audio/mpeg",
          fileSize: 8 * 1024 * 1024,
        }),
      ),
    ).toEqual({
      allowedContentTypes: ["audio/mpeg"],
      maximumSizeInBytes: 8 * 1024 * 1024,
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  });

  it("normalizes recorder MIME types that include codec parameters", () => {
    expect(
      createPaperAssetUploadConfig(
        "paper-assets/speaking-response.webm",
        JSON.stringify({
          contentType: "audio/webm;codecs=opus",
          fileSize: 4 * 1024 * 1024,
        }),
      ),
    ).toEqual({
      allowedContentTypes: ["audio/webm"],
      maximumSizeInBytes: 4 * 1024 * 1024,
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  });

  it("rejects non-audio uploads", () => {
    expect(() =>
      createPaperAssetUploadConfig(
        "paper-assets/image.png",
        JSON.stringify({
          contentType: "image/png",
          fileSize: 1024,
        }),
      ),
    ).toThrow("Only audio uploads are supported.");
  });

  it("rejects missing upload payload", () => {
    expect(() =>
      createPaperAssetUploadConfig("paper-assets/audio-listening.mp3", null),
    ).toThrow("Missing upload payload.");
  });
});
