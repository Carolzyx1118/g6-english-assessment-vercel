import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerConfigured = false;

function ensureWorker() {
  if (!workerConfigured) {
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerConfigured = true;
  }
}

function normalizePageText(rawText: string): string {
  return rawText.replace(/\s+/g, " ").trim();
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to render PDF page to image blob"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
  imageFile: File;
}

export interface ExtractedPdfAssets {
  pageCount: number;
  combinedText: string;
  pages: ExtractedPdfPage[];
}

export async function extractPdfAssets(file: File): Promise<ExtractedPdfAssets> {
  ensureWorker();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const pages: ExtractedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = normalizePageText(
      textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ")
    );

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas 2D context is not available");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    const blob = await canvasToBlob(canvas);
    const safeBaseName = file.name.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const imageFile = new File([blob], `${safeBaseName}-page-${pageNumber}.png`, {
      type: "image/png",
    });

    pages.push({
      pageNumber,
      text,
      imageFile,
    });
  }

  return {
    pageCount: pdf.numPages,
    combinedText: pages
      .map((page) => `--- ${file.name} / Page ${page.pageNumber} ---\n${page.text}`)
      .join("\n\n"),
    pages,
  };
}
