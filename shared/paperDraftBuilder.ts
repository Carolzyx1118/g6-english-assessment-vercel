import type {
  PaperDraft,
  PaperDraftCategory,
  PaperDraftParserMode,
  PaperDraftSection,
  PaperDraftSectionKey,
  PaperDraftSourceFile,
  PaperDraftSubject,
} from "./paperDraft";

type DraftTextBlock = {
  title: string;
  sectionKey: PaperDraftSectionKey;
  body: string;
};

type CreatePaperDraftInput = {
  draftId: string;
  title: string;
  subtitle: string;
  description: string;
  subject: PaperDraftSubject;
  category: PaperDraftCategory;
  tags: string[];
  parserMode?: PaperDraftParserMode;
  sourceFiles: PaperDraftSourceFile[];
  rawQuestionText: string;
  rawAnswerText: string;
  warnings?: string[];
  createdAt?: string;
};

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function inferSectionKey(title: string, subject: PaperDraftSubject): PaperDraftSectionKey {
  const normalized = title.trim().toLowerCase();

  if (/(^|\b)vocabulary\b|word list|spelling|memor/.test(normalized)) return "vocabulary";
  if (/(^|\b)grammar\b/.test(normalized)) return "grammar";
  if (/(^|\b)reading\b/.test(normalized)) return "reading";
  if (/(^|\b)writing\b|composition|essay|article/.test(normalized)) return "writing";
  if (/(^|\b)listening\b|audio/.test(normalized)) return "listening";
  if (/(^|\b)speaking\b|dialogue|discussion/.test(normalized)) return "speaking";
  if (subject === "math" || /algebra|geometry|mathematics|problem solving|number/.test(normalized)) return "math";
  if (subject === "vocabulary") return "vocabulary";

  return "mixed";
}

function isHeadingLine(line: string, subject: PaperDraftSubject): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 120) return false;

  if (/^(part|section)\s+\d+[a-z]?(?::|-)?/i.test(trimmed)) return true;

  if (subject === "english" && /^(vocabulary|grammar|reading|writing|listening|speaking)\b/i.test(trimmed)) {
    return true;
  }

  if (subject === "math" && /^(math|mathematics|algebra|geometry|statistics|number|problem solving)\b/i.test(trimmed)) {
    return true;
  }

  if (subject === "vocabulary" && /^(vocabulary|word list|memorization|unit|lesson|spelling)\b/i.test(trimmed)) {
    return true;
  }

  const words = trimmed.split(/\s+/);
  if (words.length <= 8 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return true;
  }

  return false;
}

function splitTextIntoBlocks(text: string, subject: PaperDraftSubject, fallbackTitle: string): DraftTextBlock[] {
  const normalized = normalizeExtractedText(text);
  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const sections: DraftTextBlock[] = [];
  let currentTitle = fallbackTitle;
  let currentBody: string[] = [];

  const flush = () => {
    const body = normalizeExtractedText(currentBody.join("\n"));
    if (!body) return;
    sections.push({
      title: currentTitle,
      sectionKey: inferSectionKey(currentTitle, subject),
      body,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (isHeadingLine(trimmed, subject)) {
      if (currentBody.length > 0) {
        flush();
        currentBody = [];
      }
      currentTitle = trimmed;
      continue;
    }
    currentBody.push(line);
  }

  flush();

  if (sections.length === 0) {
    return [
      {
        title: fallbackTitle,
        sectionKey: inferSectionKey(fallbackTitle, subject),
        body: normalized,
      },
    ];
  }

  return sections;
}

function countQuestionHints(text: string): number {
  const numberedMatches = Array.from(text.matchAll(/(?:^|\s)(\d{1,3})(?:[.)]|(?=\s))/gm)).map((match) => match[1]);
  const uniqueQuestionNumbers = new Set(numberedMatches);
  if (uniqueQuestionNumbers.size > 0) {
    return uniqueQuestionNumbers.size;
  }

  const blankMatches = text.match(/\(\d{1,3}\)/g) ?? [];
  return blankMatches.length;
}

function inferInstructions(body: string): string {
  const paragraphs = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const instructionParagraph = paragraphs.find((part) =>
    part.length <= 280 &&
    /(choose|read|write|listen|complete|answer|match|record|look at|fill in|tick|circle|discuss|talk about)/i.test(part),
  );

  return instructionParagraph || "";
}

function inferSubtitle(title: string): string {
  const splitByColon = title.split(":");
  if (splitByColon.length > 1) {
    return splitByColon.slice(1).join(":").trim();
  }
  return "";
}

function createSectionNotes(sectionKey: PaperDraftSectionKey, answerExcerpt: string): string[] {
  const notes: string[] = [];

  if (!answerExcerpt) {
    notes.push("No matching answer excerpt found for this section yet.");
  }

  if (sectionKey === "listening") {
    notes.push("Listening sections usually need option-image mapping and audio alignment after parsing.");
  }

  if (sectionKey === "writing" || sectionKey === "speaking") {
    notes.push("Open-ended tasks often need manual cleanup before publishing.");
  }

  return notes;
}

function assignAssetUrls(sectionKey: PaperDraftSectionKey, sourceFiles: PaperDraftSourceFile[]): string[] {
  const audioUrls = sourceFiles.filter((file) => file.role === "audio" && file.url).map((file) => file.url!);
  const imageUrls = sourceFiles.filter((file) => file.role === "image" && file.url).map((file) => file.url!);

  if (sectionKey === "listening") {
    return [...audioUrls, ...imageUrls];
  }

  if (sectionKey === "writing") {
    return imageUrls;
  }

  if (sectionKey === "speaking") {
    return audioUrls;
  }

  return [];
}

function buildSectionDrafts(
  questionBlocks: DraftTextBlock[],
  answerBlocks: DraftTextBlock[],
  sourceFiles: PaperDraftSourceFile[],
): PaperDraftSection[] {
  return questionBlocks.map((block, index) => {
    const matchedAnswer =
      answerBlocks[index] ||
      answerBlocks.find((answerBlock) => answerBlock.sectionKey === block.sectionKey);
    const sourceExcerpt = block.body.slice(0, 2000);
    const answerExcerpt = matchedAnswer?.body.slice(0, 1200) || "";

    return {
      id: `${block.sectionKey}-${index + 1}`,
      title: block.title,
      sectionKey: block.sectionKey,
      subtitle: inferSubtitle(block.title),
      instructions: inferInstructions(block.body),
      sourceExcerpt,
      answerExcerpt,
      questionCountHint: countQuestionHints(block.body),
      assetUrls: assignAssetUrls(block.sectionKey, sourceFiles),
      notes: createSectionNotes(block.sectionKey, answerExcerpt),
    };
  });
}

export function createPaperDraft(input: CreatePaperDraftInput): PaperDraft {
  const warnings = [...(input.warnings ?? [])];

  if (!input.rawQuestionText) {
    warnings.push("No extractable question PDF text was found. The draft will be mostly metadata until text extraction is added.");
  }

  if (!input.rawAnswerText) {
    warnings.push("No answer PDF text was found. Correct-answer mapping will need manual work later.");
  }

  const questionBlocks = splitTextIntoBlocks(input.rawQuestionText, input.subject, input.title || "Imported Section");
  const answerBlocks = splitTextIntoBlocks(input.rawAnswerText, input.subject, "Answer Key");
  const sections = buildSectionDrafts(questionBlocks, answerBlocks, input.sourceFiles);

  if (sections.length === 0) {
    warnings.push("No section blocks could be identified. Check whether the PDF is text-based or needs OCR.");
  }

  return {
    id: input.draftId,
    suggestedPaperId: slugify(input.title) || `paper-${input.draftId}`,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    subject: input.subject,
    category: input.category,
    tags: input.tags,
    parserMode: input.parserMode ?? "local-scaffold",
    sourceFiles: input.sourceFiles,
    rawQuestionText: input.rawQuestionText,
    rawAnswerText: input.rawAnswerText,
    sections,
    warnings,
    nextSteps: [
      "Review each section title and instructions before publishing.",
      "Map uploaded audio and image assets to the exact listening or writing questions.",
      "Replace session-local blob asset URLs before publishing a final paper definition.",
    ],
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
