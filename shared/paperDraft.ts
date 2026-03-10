import { z } from "zod";

export const paperDraftSubjectSchema = z.enum(["english", "math", "vocabulary"]);
export const paperDraftCategorySchema = z.enum(["assessment", "practice", "memorization"]);
export const paperDraftFileRoleSchema = z.enum([
  "question_pdf",
  "answer_pdf",
  "audio",
  "image",
  "reference",
]);
export const paperDraftSectionKeySchema = z.enum([
  "vocabulary",
  "grammar",
  "reading",
  "writing",
  "listening",
  "speaking",
  "math",
  "mixed",
]);
export const paperDraftParserModeSchema = z.enum(["local-scaffold", "llm-draft"]);

export const paperDraftUploadFileSchema = z.object({
  id: z.string().min(1),
  role: paperDraftFileRoleSchema,
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileBase64: z.string().min(1),
});

export const paperDraftSourceFileSchema = z.object({
  id: z.string().min(1),
  role: paperDraftFileRoleSchema,
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  url: z.string().optional(),
  key: z.string().optional(),
  extractedText: z.string().optional(),
});

export const paperDraftSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sectionKey: paperDraftSectionKeySchema,
  subtitle: z.string(),
  instructions: z.string(),
  sourceExcerpt: z.string(),
  answerExcerpt: z.string(),
  questionCountHint: z.number().int().nonnegative(),
  assetUrls: z.array(z.string()),
  notes: z.array(z.string()),
});

export const paperDraftSchema = z.object({
  id: z.string().min(1),
  suggestedPaperId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string(),
  description: z.string(),
  subject: paperDraftSubjectSchema,
  category: paperDraftCategorySchema,
  tags: z.array(z.string()),
  parserMode: paperDraftParserModeSchema,
  sourceFiles: z.array(paperDraftSourceFileSchema),
  rawQuestionText: z.string(),
  rawAnswerText: z.string(),
  sections: z.array(paperDraftSectionSchema),
  warnings: z.array(z.string()),
  nextSteps: z.array(z.string()),
  createdAt: z.string().min(1),
});

export const generatePaperDraftInputSchema = z.object({
  title: z.string().min(1, "Please enter a paper title"),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  subject: paperDraftSubjectSchema,
  category: paperDraftCategorySchema,
  tags: z.array(z.string()).default([]),
  files: z.array(paperDraftUploadFileSchema).min(1, "Upload at least one source file"),
});

export type PaperDraftSubject = z.infer<typeof paperDraftSubjectSchema>;
export type PaperDraftCategory = z.infer<typeof paperDraftCategorySchema>;
export type PaperDraftFileRole = z.infer<typeof paperDraftFileRoleSchema>;
export type PaperDraftSectionKey = z.infer<typeof paperDraftSectionKeySchema>;
export type PaperDraftParserMode = z.infer<typeof paperDraftParserModeSchema>;
export type PaperDraftUploadFile = z.infer<typeof paperDraftUploadFileSchema>;
export type PaperDraftSourceFile = z.infer<typeof paperDraftSourceFileSchema>;
export type PaperDraftSection = z.infer<typeof paperDraftSectionSchema>;
export type PaperDraft = z.infer<typeof paperDraftSchema>;
export type GeneratePaperDraftInput = z.infer<typeof generatePaperDraftInputSchema>;
