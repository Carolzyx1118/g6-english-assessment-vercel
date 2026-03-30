import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { uploadMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
}));

vi.mock("@vercel/blob/client", () => ({
  upload: uploadMock,
}));

import { uploadAudioBlob } from "./audioUpload";

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: Error | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer()
      .then((buffer) => {
        this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onloadend?.();
      })
      .catch((error) => {
        this.error = error instanceof Error ? error : new Error(String(error));
        this.onerror?.();
      });
  }
}

describe("uploadAudioBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("FileReader", MockFileReader);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("prefers the server upload on hosted small audio files", async () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "app.example.com",
      },
    });

    const uploadFileMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        url: "/api/blob?key=paper-assets%2Ffrom-server.mp3",
      }),
    };

    const result = await uploadAudioBlob({
      blob: new Blob(["hello"], { type: "audio/mpeg" }),
      contentType: "audio/mpeg",
      fileName: "listening.mp3",
      uploadFileMutation,
    });

    expect(result).toBe("/api/blob?key=paper-assets%2Ffrom-server.mp3");
    expect(uploadFileMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("falls back to direct upload when the hosted server upload fails", async () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "app.example.com",
      },
    });

    const uploadFileMutation = {
      mutateAsync: vi.fn().mockRejectedValue(new Error("server upload failed")),
    };
    uploadMock.mockResolvedValue({
      url: "https://blob.vercel-storage.com/paper-assets/listening.mp3",
    });

    const result = await uploadAudioBlob({
      blob: new Blob(["hello"], { type: "audio/mpeg" }),
      contentType: "audio/mpeg",
      fileName: "listening.mp3",
      uploadFileMutation,
    });

    expect(uploadFileMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(result).toBe("https://blob.vercel-storage.com/paper-assets/listening.mp3");
  });

  it("uses direct upload first for hosted large audio files", async () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "app.example.com",
      },
    });

    const uploadFileMutation = {
      mutateAsync: vi.fn(),
    };
    uploadMock.mockResolvedValue({
      url: "https://blob.vercel-storage.com/paper-assets/large-listening.mp3",
    });

    const result = await uploadAudioBlob({
      blob: new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], { type: "audio/mpeg" }),
      contentType: "audio/mpeg",
      fileName: "large-listening.mp3",
      uploadFileMutation,
    });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadFileMutation.mutateAsync).not.toHaveBeenCalled();
    expect(result).toBe("https://blob.vercel-storage.com/paper-assets/large-listening.mp3");
  });
});
