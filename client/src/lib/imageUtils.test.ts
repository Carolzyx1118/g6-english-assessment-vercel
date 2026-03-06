import { describe, expect, it } from "vitest";
import { validateImageFile, formatFileSize } from "./imageUtils";

// Note: compressImage and fileToBase64 use browser APIs (Image, canvas, URL.createObjectURL)
// which are not available in Node.js test environment. We test the pure utility functions here.

describe("validateImageFile", () => {
  function makeFile(name: string, type: string, size: number): File {
    const buffer = new ArrayBuffer(size);
    return new File([buffer], name, { type });
  }

  it("accepts valid PNG files", () => {
    const file = makeFile("test.png", "image/png", 1024);
    expect(validateImageFile(file)).toBeNull();
  });

  it("accepts valid JPEG files", () => {
    const file = makeFile("photo.jpg", "image/jpeg", 5000);
    expect(validateImageFile(file)).toBeNull();
  });

  it("accepts valid GIF files", () => {
    const file = makeFile("anim.gif", "image/gif", 2000);
    expect(validateImageFile(file)).toBeNull();
  });

  it("accepts valid WebP files", () => {
    const file = makeFile("image.webp", "image/webp", 3000);
    expect(validateImageFile(file)).toBeNull();
  });

  it("rejects non-image files", () => {
    const file = makeFile("doc.pdf", "application/pdf", 1024);
    expect(validateImageFile(file)).toBe(
      "Please select an image file (PNG, JPG, GIF, WebP)"
    );
  });

  it("rejects SVG files", () => {
    const file = makeFile("icon.svg", "image/svg+xml", 500);
    expect(validateImageFile(file)).toBe(
      "Please select an image file (PNG, JPG, GIF, WebP)"
    );
  });

  it("rejects files over 10MB", () => {
    const file = makeFile("huge.png", "image/png", 11 * 1024 * 1024);
    expect(validateImageFile(file)).toBe("Image file size must be under 10MB");
  });

  it("accepts files exactly at 10MB", () => {
    const file = makeFile("big.png", "image/png", 10 * 1024 * 1024);
    expect(validateImageFile(file)).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("formats zero bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });
});
