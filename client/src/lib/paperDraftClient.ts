import { nanoid } from "nanoid";
import type {
  GeneratePaperDraftInput,
  PaperDraft,
  PaperDraftFileRole,
  PaperDraftSourceFile,
} from "@shared/paperDraft";
import { createPaperDraft, normalizeExtractedText } from "@shared/paperDraftBuilder";

type BrowserDraftFile = {
  id: string;
  role: PaperDraftFileRole;
  fileName: string;
  contentType: string;
  file: File;
};

type BrowserDraftInput = Omit<GeneratePaperDraftInput, "files"> & {
  files: BrowserDraftFile[];
  onProgress?: (label: string) => void;
};

let pdfModulePromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function loadPdfJs() {
  pdfModulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfModulePromise;
}

async function extractPdfText(file: File): Promise<string> {
  const { getDocument } = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await getDocument({ data, disableWorker: true } as any).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pages.push(
      textContent.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
  }

  await document.destroy();
  return normalizeExtractedText(pages.join("\n\n"));
}

async function extractText(file: BrowserDraftFile): Promise<string | undefined> {
  if (file.contentType.startsWith("text/") || file.file.name.toLowerCase().endsWith(".txt")) {
    return normalizeExtractedText(await file.file.text());
  }

  if (file.contentType === "application/pdf" || file.file.name.toLowerCase().endsWith(".pdf")) {
    return extractPdfText(file.file);
  }

  return undefined;
}

function buildPreviewUrl(file: BrowserDraftFile): string | undefined {
  if (file.role === "audio" || file.role === "image") {
    return URL.createObjectURL(file.file);
  }

  return undefined;
}

export async function buildPaperDraftFromBrowser(input: BrowserDraftInput): Promise<PaperDraft> {
  const draftId = `draft_${nanoid(10)}`;
  const sourceFiles: PaperDraftSourceFile[] = [];
  const warnings: string[] = [];
  let rawQuestionText = "";
  let rawAnswerText = "";

  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    input.onProgress?.(`Reading ${index + 1}/${input.files.length}: ${file.fileName}`);

    let extractedText: string | undefined;
    try {
      extractedText = await extractText(file);
    } catch {
      warnings.push(`Failed to extract text from ${file.fileName}. This file may need OCR or manual cleanup.`);
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
      url: buildPreviewUrl(file),
      extractedText,
    });
  }

  input.onProgress?.("Building draft preview...");

  return createPaperDraft({
    draftId,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    subject: input.subject,
    category: input.category,
    tags: input.tags,
    sourceFiles,
    rawQuestionText,
    rawAnswerText,
    warnings,
  });
}

export function revokePaperDraftObjectUrls(draft: PaperDraft | null) {
  if (!draft) return;

  for (const sourceFile of draft.sourceFiles) {
    if (sourceFile.url?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceFile.url);
    }
  }
}
