import type {
  PaperDraftSourceFile,
  PaperDraftUploadFile,
} from "../shared/paperDraft";
import { normalizeExtractedText } from "../shared/paperDraftBuilder";
import { storagePut } from "./storage";

export type PreparedPaperSources = {
  sourceFiles: PaperDraftSourceFile[];
  warnings: string[];
  rawQuestionText: string;
  rawAnswerText: string;
};

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= document.numPages; pageNum += 1) {
    const page = await document.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return normalizeExtractedText(pages.join("\n\n"));
}

function extractPlainText(file: PaperDraftUploadFile, buffer: Buffer): string | undefined {
  if (file.contentType.startsWith("text/")) {
    return normalizeExtractedText(buffer.toString("utf8"));
  }

  if (file.fileName.toLowerCase().endsWith(".txt")) {
    return normalizeExtractedText(buffer.toString("utf8"));
  }

  return undefined;
}

async function uploadSourceFile(draftId: string, file: PaperDraftUploadFile, buffer: Buffer) {
  const key = `paper-intake/${draftId}/${file.role}-${sanitizeFileName(file.fileName)}`;
  const uploaded = await storagePut(key, buffer, file.contentType);
  return {
    key: uploaded.key,
    url: uploaded.url,
  };
}

export async function preparePaperSources(
  draftId: string,
  files: PaperDraftUploadFile[],
): Promise<PreparedPaperSources> {
  const sourceFiles: PaperDraftSourceFile[] = [];
  const warnings: string[] = [];
  let rawQuestionText = "";
  let rawAnswerText = "";

  for (const file of files) {
    const buffer = Buffer.from(file.fileBase64, "base64");
    const uploaded = await uploadSourceFile(draftId, file, buffer);
    let extractedText = extractPlainText(file, buffer);

    if (!extractedText && file.contentType === "application/pdf") {
      try {
        extractedText = await extractPdfText(buffer);
      } catch {
        warnings.push(`Failed to extract text from ${file.fileName}. You may need OCR or manual cleanup.`);
      }
    }

    if (file.role === "question_pdf" && extractedText) {
      rawQuestionText += `${rawQuestionText ? "\n\n" : ""}${extractedText}`;
    }

    if (file.role === "answer_pdf" && extractedText) {
      rawAnswerText += `${rawAnswerText ? "\n\n" : ""}${extractedText}`;
    }

    sourceFiles.push({
      id: file.id,
      role: file.role,
      fileName: file.fileName,
      contentType: file.contentType,
      key: uploaded.key,
      url: uploaded.url,
      extractedText,
    });
  }

  return {
    sourceFiles,
    warnings,
    rawQuestionText,
    rawAnswerText,
  };
}
