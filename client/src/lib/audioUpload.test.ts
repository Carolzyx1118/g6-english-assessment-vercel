import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { uploadMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
}));

vi.mock("@vercel/blob/client", () => ({
  upload: uploadMock,
}));

import { normalizeAudioContentType, uploadAudioBlob } from "./audioUpload";

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
    expect(result).toBe("/api/blob?key=paper-assets%2Flistening.mp3");
    expect(uploadMock).toHaveBeenCalledWith(
      "paper-assets/listening.mp3",
      expect.any(Blob),
      expect.objectContaining({
        access: "private",
      }),
    );
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
    expect(result).toBe("/api/blob?key=paper-assets%2Flarge-listening.mp3");
    expect(uploadMock).toHaveBeenCalledWith(
      "paper-assets/large-listening.mp3",
      expect.any(Blob),
      expect.objectContaining({
        access: "private",
      }),
    );
  });

  it("normalizes legacy MP3 content types before uploading", async () => {
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

    await uploadAudioBlob({
      blob: new Blob(["hello"], { type: "audio/x-mp3" }),
      contentType: "audio/x-mp3",
      fileName: "listening.mp3",
      uploadFileMutation,
    });

    expect(uploadFileMutation.mutateAsync).toHaveBeenCalledWith({
      fileName: "listening.mp3",
      fileBase64: Buffer.from("hello").toString("base64"),
      contentType: "audio/mpeg",
    });
  });
});

describe("normalizeAudioContentType", () => {
  it("maps common MP3 aliases to audio/mpeg", () => {
    expect(normalizeAudioContentType("audio/x-mp3")).toBe("audio/mpeg");
    expect(normalizeAudioContentType("audio/mpg")).toBe("audio/mpeg");
    expect(normalizeAudioContentType("audio/mpeg")).toBe("audio/mpeg");
  });

  it("maps common WAV aliases to audio/wav", () => {
    expect(normalizeAudioContentType("audio/x-wav")).toBe("audio/wav");
    expect(normalizeAudioContentType("audio/wave")).toBe("audio/wav");
  });
});

describe("uploadAudioBlob direct access fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("FileReader", MockFileReader);
    vi.stubGlobal("window", {
      location: {
        hostname: "app.example.com",
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back to public direct upload when private access is rejected", async () => {
    const uploadFileMutation = {
      mutateAsync: vi.fn(),
    };

    uploadMock
      .mockRejectedValueOnce(new Error("Cannot use private access on a public store"))
      .mockResolvedValueOnce({
        url: "https://blob.vercel-storage.com/paper-assets/public-large-listening.mp3",
      });

    const result = await uploadAudioBlob({
      blob: new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], { type: "audio/mpeg" }),
      contentType: "audio/mpeg",
      fileName: "public-large-listening.mp3",
      uploadFileMutation,
    });

    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(uploadMock.mock.calls[0]?.[2]).toMatchObject({ access: "private" });
    expect(uploadMock.mock.calls[1]?.[2]).toMatchObject({ access: "public" });
    expect(result).toBe("https://blob.vercel-storage.com/paper-assets/public-large-listening.mp3");
  });
});
