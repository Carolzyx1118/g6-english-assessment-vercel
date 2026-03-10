import { nanoid } from "nanoid";
import type {
  GeneratePaperDraftInput,
  PaperDraft,
  PaperDraftSection,
  PaperDraftSectionKey,
  PaperDraftSourceFile,
} from "@shared/paperDraft";
import {
  createPaperDraft,
  normalizeExtractedText,
} from "@shared/paperDraftBuilder";
import { invokeLLM, type FileContent, type ImageContent, type MessageContent } from "./_core/llm";
import { preparePaperSources } from "./paperSourceIngest";

const SECTION_KEY_ENUM: PaperDraftSectionKey[] = [
  "vocabulary",
  "grammar",
  "reading",
  "writing",
  "listening",
  "speaking",
  "math",
  "mixed",
];

type QuestionSectionBlueprint = {
  sectionRef: string;
  title: string;
  sectionKey: PaperDraftSectionKey;
  instructions: string;
  sourceExcerpt: string;
  questionCountHint: number;
  assetFileIds: string[];
  notes: string[];
};

type QuestionRoundResult = {
  overview: string;
  sections: QuestionSectionBlueprint[];
};

type AnswerRoundResult = {
  rawAnswerSummary: string;
  globalNotes: string[];
  sections: Array<{
    sectionRef: string;
    answerExcerpt: string;
    assetFileIds: string[];
    notes: string[];
  }>;
};

type ReviewRoundResult = {
  warnings: string[];
  nextSteps: string[];
};

function isAbsoluteHttpUrl(value: string | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function isPdfFile(file: PaperDraftSourceFile) {
  return file.contentType === "application/pdf" || file.fileName.toLowerCase().endsWith(".pdf");
}

function isAudioFile(file: PaperDraftSourceFile) {
  return /^audio\//.test(file.contentType);
}

function isImageFile(file: PaperDraftSourceFile) {
  return /^image\//.test(file.contentType);
}

function toFilePart(url: string, mimeType: FileContent["file_url"]["mime_type"]): FileContent {
  return {
    type: "file_url",
    file_url: {
      url,
      mime_type: mimeType,
    },
  };
}

function toImagePart(url: string): ImageContent {
  return {
    type: "image_url",
    image_url: {
      url,
      detail: "high",
    },
  };
}

function truncateText(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n...[truncated]`;
}

function parseStructuredJson<T>(rawContent: unknown, label: string): T {
  if (typeof rawContent !== "string") {
    throw new Error(`${label} returned a non-text response.`);
  }

  try {
    return JSON.parse(rawContent) as T;
  } catch (error) {
    throw new Error(
      `${label} returned invalid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`,
    );
  }
}

function fallbackAssetUrls(sectionKey: PaperDraftSectionKey, sourceFiles: PaperDraftSourceFile[]): string[] {
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

function buildSectionNotes(
  sectionKey: PaperDraftSectionKey,
  answerExcerpt: string,
  inputNotes: string[],
): string[] {
  const notes = [...inputNotes];

  if (!answerExcerpt) {
    notes.push("No matching answer excerpt found for this section yet.");
  }

  if (sectionKey === "listening") {
    notes.push("Listening sections usually need option-image mapping and transcript review after extraction.");
  }

  if (sectionKey === "writing" || sectionKey === "speaking") {
    notes.push("Open-ended tasks often need manual cleanup before publishing.");
  }

  return Array.from(new Set(notes.filter(Boolean)));
}

function mapAssetUrls(
  preferredFileIds: string[],
  sectionKey: PaperDraftSectionKey,
  sourceFiles: PaperDraftSourceFile[],
): string[] {
  const mappedUrls = preferredFileIds
    .map((fileId) => sourceFiles.find((file) => file.id === fileId)?.url)
    .filter((url): url is string => Boolean(url));

  if (mappedUrls.length > 0) {
    return Array.from(new Set(mappedUrls));
  }

  return fallbackAssetUrls(sectionKey, sourceFiles);
}

function buildQuestionRoundSchema() {
  return {
    name: "paper_question_sections",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        overview: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              sectionRef: { type: "string" },
              title: { type: "string" },
              sectionKey: { type: "string", enum: SECTION_KEY_ENUM },
              instructions: { type: "string" },
              sourceExcerpt: { type: "string" },
              questionCountHint: { type: "number" },
              assetFileIds: { type: "array", items: { type: "string" } },
              notes: { type: "array", items: { type: "string" } },
            },
            required: [
              "sectionRef",
              "title",
              "sectionKey",
              "instructions",
              "sourceExcerpt",
              "questionCountHint",
              "assetFileIds",
              "notes",
            ],
          },
        },
      },
      required: ["overview", "sections"],
    },
  } as const;
}

function buildAnswerRoundSchema() {
  return {
    name: "paper_answer_support",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        rawAnswerSummary: { type: "string" },
        globalNotes: { type: "array", items: { type: "string" } },
        sections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              sectionRef: { type: "string" },
              answerExcerpt: { type: "string" },
              assetFileIds: { type: "array", items: { type: "string" } },
              notes: { type: "array", items: { type: "string" } },
            },
            required: ["sectionRef", "answerExcerpt", "assetFileIds", "notes"],
          },
        },
      },
      required: ["rawAnswerSummary", "globalNotes", "sections"],
    },
  } as const;
}

function buildReviewRoundSchema() {
  return {
    name: "paper_draft_review",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        warnings: { type: "array", items: { type: "string" } },
        nextSteps: { type: "array", items: { type: "string" } },
      },
      required: ["warnings", "nextSteps"],
    },
  } as const;
}

function buildSharedInventoryText(sourceFiles: PaperDraftSourceFile[]) {
  return JSON.stringify(
    sourceFiles.map((file) => ({
      id: file.id,
      role: file.role,
      fileName: file.fileName,
      contentType: file.contentType,
      hasUrl: Boolean(file.url),
      extractedTextPreview: file.extractedText ? truncateText(file.extractedText, 500) : "",
    })),
    null,
    2,
  );
}

function buildQuestionRoundContent(
  input: GeneratePaperDraftInput,
  sourceFiles: PaperDraftSourceFile[],
  rawQuestionText: string,
): MessageContent[] {
  const content: MessageContent[] = [
    {
      type: "text",
      text: [
        "Create a section-by-section blueprint for this assessment.",
        `Paper title: ${input.title}`,
        `Subject: ${input.subject}`,
        `Category: ${input.category}`,
        `Subtitle: ${input.subtitle || "(none)"}`,
        `Description: ${input.description || "(none)"}`,
        `Tags: ${input.tags.join(", ") || "(none)"}`,
        "",
        "Source file inventory:",
        buildSharedInventoryText(sourceFiles),
        "",
        "Use the PDFs and images as the primary truth. The extracted text below is only a fallback hint.",
        "Return a clean section list in the same order as the original paper.",
        "Preserve instructions whenever possible. Do not invent answers.",
        "If a section should use audio or image assets, attach source file ids in assetFileIds.",
        "",
        "Extracted question text fallback:",
        truncateText(rawQuestionText || "(none)", 24000),
      ].join("\n"),
    },
  ];

  for (const file of sourceFiles) {
    if (!file.url || !isAbsoluteHttpUrl(file.url)) continue;
    if (file.role === "question_pdf" && isPdfFile(file)) {
      content.push(toFilePart(file.url, "application/pdf"));
    } else if (file.role === "image" && isImageFile(file)) {
      content.push(toImagePart(file.url));
    }
  }

  return content;
}

function buildAnswerRoundContent(
  sourceFiles: PaperDraftSourceFile[],
  sections: QuestionSectionBlueprint[],
  rawQuestionText: string,
  rawAnswerText: string,
): MessageContent[] {
  const content: MessageContent[] = [
    {
      type: "text",
      text: [
        "Map answers and supporting assets onto the existing section blueprint.",
        "Use the provided sectionRef values exactly.",
        "Do not create or remove sections.",
        "If a section has no clear answer content, return an empty answerExcerpt and explain why in notes.",
        "",
        "Section blueprint:",
        JSON.stringify(sections, null, 2),
        "",
        "Source file inventory:",
        buildSharedInventoryText(sourceFiles),
        "",
        "Extracted question text fallback:",
        truncateText(rawQuestionText || "(none)", 12000),
        "",
        "Extracted answer text fallback:",
        truncateText(rawAnswerText || "(none)", 16000),
      ].join("\n"),
    },
  ];

  for (const file of sourceFiles) {
    if (!file.url || !isAbsoluteHttpUrl(file.url)) continue;
    if (file.role === "answer_pdf" && isPdfFile(file)) {
      content.push(toFilePart(file.url, "application/pdf"));
    } else if (file.role === "audio" && isAudioFile(file)) {
      const mimeType = file.contentType === "audio/wav" ? "audio/wav" : "audio/mpeg";
      content.push(toFilePart(file.url, mimeType));
    } else if (file.role === "image" && isImageFile(file)) {
      content.push(toImagePart(file.url));
    }
  }

  return content;
}

async function runQuestionRound(
  input: GeneratePaperDraftInput,
  sourceFiles: PaperDraftSourceFile[],
  rawQuestionText: string,
): Promise<QuestionRoundResult> {
  const response = await invokeLLM({
    model: "gemini-2.5-pro",
    messages: [
      {
        role: "system",
        content:
          "You are an assessment-ingestion engine. Extract a precise section blueprint from exam source materials. Return valid JSON only.",
      },
      {
        role: "user",
        content: buildQuestionRoundContent(input, sourceFiles, rawQuestionText),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: buildQuestionRoundSchema(),
    },
  });

  return parseStructuredJson<QuestionRoundResult>(
    response.choices[0]?.message?.content,
    "Question extraction round",
  );
}

async function runAnswerRound(
  sourceFiles: PaperDraftSourceFile[],
  sections: QuestionSectionBlueprint[],
  rawQuestionText: string,
  rawAnswerText: string,
): Promise<AnswerRoundResult> {
  const response = await invokeLLM({
    model: "gemini-2.5-pro",
    messages: [
      {
        role: "system",
        content:
          "You map answers, audio, and images onto an existing assessment blueprint. Keep sectionRef values exact and return valid JSON only.",
      },
      {
        role: "user",
        content: buildAnswerRoundContent(sourceFiles, sections, rawQuestionText, rawAnswerText),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: buildAnswerRoundSchema(),
    },
  });

  return parseStructuredJson<AnswerRoundResult>(
    response.choices[0]?.message?.content,
    "Answer extraction round",
  );
}

async function runReviewRound(
  draft: PaperDraft,
  warnings: string[],
): Promise<ReviewRoundResult> {
  const response = await invokeLLM({
    model: "gemini-2.5-pro",
    messages: [
      {
        role: "system",
        content:
          "You review AI-generated assessment drafts. Return concise warnings and next steps in valid JSON only.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Review this draft for likely extraction gaps.",
              "Focus on missing answers, weak instructions, unclear asset mapping, and OCR risk.",
              "",
              "Existing warnings:",
              JSON.stringify(warnings, null, 2),
              "",
              "Draft JSON:",
              truncateText(JSON.stringify(draft, null, 2), 24000),
            ].join("\n"),
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: buildReviewRoundSchema(),
    },
  });

  return parseStructuredJson<ReviewRoundResult>(
    response.choices[0]?.message?.content,
    "Draft review round",
  );
}

function buildFinalSections(
  questionRound: QuestionRoundResult,
  answerRound: AnswerRoundResult,
  sourceFiles: PaperDraftSourceFile[],
): PaperDraftSection[] {
  return questionRound.sections.map((section, index) => {
    const answerSection = answerRound.sections.find((candidate) => candidate.sectionRef === section.sectionRef);
    const answerExcerpt = normalizeExtractedText(answerSection?.answerExcerpt || "");
    const notes = buildSectionNotes(
      section.sectionKey,
      answerExcerpt,
      [...section.notes, ...(answerSection?.notes ?? [])],
    );

    return {
      id: section.sectionRef || `${section.sectionKey}-${index + 1}`,
      title: normalizeExtractedText(section.title) || `Section ${index + 1}`,
      sectionKey: SECTION_KEY_ENUM.includes(section.sectionKey) ? section.sectionKey : "mixed",
      subtitle: "",
      instructions: normalizeExtractedText(section.instructions || ""),
      sourceExcerpt: normalizeExtractedText(section.sourceExcerpt || ""),
      answerExcerpt,
      questionCountHint: Math.max(0, Math.round(section.questionCountHint || 0)),
      assetUrls: mapAssetUrls(
        [...section.assetFileIds, ...(answerSection?.assetFileIds ?? [])],
        section.sectionKey,
        sourceFiles,
      ),
      notes,
    };
  });
}

export async function buildAIPaperDraft(input: GeneratePaperDraftInput): Promise<PaperDraft> {
  const draftId = `draft_${nanoid(10)}`;
  const prepared = await preparePaperSources(draftId, input.files);

  const questionRound = await runQuestionRound(input, prepared.sourceFiles, prepared.rawQuestionText);
  const answerRound = await runAnswerRound(
    prepared.sourceFiles,
    questionRound.sections,
    prepared.rawQuestionText,
    prepared.rawAnswerText,
  );

  const sections = buildFinalSections(questionRound, answerRound, prepared.sourceFiles);

  const preliminaryDraft = createPaperDraft({
    draftId,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    subject: input.subject,
    category: input.category,
    tags: input.tags,
    parserMode: "llm-draft",
    sourceFiles: prepared.sourceFiles,
    rawQuestionText: prepared.rawQuestionText,
    rawAnswerText: prepared.rawAnswerText || answerRound.rawAnswerSummary,
    warnings: prepared.warnings,
    sections,
    nextSteps: [
      "Review the AI-generated section list and adjust wording before publishing.",
      "Verify asset-to-question mapping for listening and writing tasks.",
      "Confirm answers against the official answer key before finalizing the paper.",
    ],
  });

  const reviewRound = await runReviewRound(preliminaryDraft, prepared.warnings);

  return createPaperDraft({
    draftId,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    subject: input.subject,
    category: input.category,
    tags: input.tags,
    parserMode: "llm-draft",
    sourceFiles: prepared.sourceFiles,
    rawQuestionText: prepared.rawQuestionText,
    rawAnswerText: prepared.rawAnswerText || answerRound.rawAnswerSummary,
    warnings: [...prepared.warnings, ...reviewRound.warnings, ...answerRound.globalNotes],
    sections,
    nextSteps:
      reviewRound.nextSteps.length > 0
        ? reviewRound.nextSteps
        : preliminaryDraft.nextSteps,
  });
}
