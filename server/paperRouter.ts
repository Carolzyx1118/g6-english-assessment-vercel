import { TRPCError } from "@trpc/server";
import { generatePaperDraftInputSchema } from "../shared/paperDraft";

import { router, publicProcedure } from "./_core/trpc";
import { buildPaperDraft } from "./paperDraftParser";
import { storagePut } from "./storage";
import {
  saveManualPaper,
  getAllManualPapers,
  getPublishedManualPapers,
  getManualPaperById,
  getManualPaperByPaperId,
  deleteManualPaper,
  updateManualPaper as persistManualPaperUpdate,
  getEnglishTagSystems,
  getMathTagSystems,
  getVocabularyTagSystems,
  saveEnglishTagSystems,
  saveMathTagSystems,
  saveVocabularyTagSystems,
} from "./db";
import {
  countBlueprintQuestions,
  blueprintHasListening,
  blueprintHasWriting,
} from "../shared/blueprintToPaper";
import { getBlueprintBuildMode, getBlueprintVisibilityMode } from "../shared/taggedPaperGenerator";
import type {
  ManualAudioFile,
  ManualOptionImage,
  ManualPaperBlueprint,
  ManualQuestion,
  ManualSection,
  ManualSubsection,
} from "../shared/manualPaperBlueprint";
import { z } from "zod";

function normalizePersistedAssetUrl(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const lowerValue = trimmed.toLowerCase();
  if (
    lowerValue.startsWith("http://")
    || lowerValue.startsWith("https://")
    || lowerValue.startsWith("data:")
    || trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("local-paper-assets/") || trimmed.startsWith("api/blob?")) {
    return `/${trimmed.replace(/^\/+/, "")}`;
  }

  return undefined;
}

function decodeDataUrl(value?: string) {
  const normalized = normalizePersistedAssetUrl(value);
  if (!normalized?.startsWith("data:")) return null;

  const match = normalized.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;

  const contentType = match[1]?.trim() || "application/octet-stream";
  const body = match[3] ?? "";
  if (!body) return null;

  if (match[2]) {
    return {
      contentType,
      buffer: Buffer.from(body, "base64"),
    };
  }

  try {
    return {
      contentType,
      buffer: Buffer.from(decodeURIComponent(body), "utf8"),
    };
  } catch {
    return null;
  }
}

function guessAssetExtension(contentType: string, kind: "image" | "audio") {
  const normalizedType = contentType.toLowerCase();

  if (kind === "audio") {
    if (normalizedType.includes("mpeg") || normalizedType.includes("mp3")) return "mp3";
    if (normalizedType.includes("wav")) return "wav";
    if (normalizedType.includes("ogg")) return "ogg";
    if (normalizedType.includes("webm")) return "webm";
    if (normalizedType.includes("mp4")) return "mp4";
    if (normalizedType.includes("m4a")) return "m4a";
    if (normalizedType.includes("aac")) return "aac";
    return "bin";
  }

  if (normalizedType.includes("png")) return "png";
  if (normalizedType.includes("webp")) return "webp";
  if (normalizedType.includes("gif")) return "gif";
  return "jpg";
}

function buildAssetStorageKey(kind: "image" | "audio", fileName: string | undefined, contentType: string) {
  const safeBaseName = (fileName?.trim() || `${kind}-${Date.now()}`)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
  const baseName = safeBaseName || `${kind}-${Date.now()}`;
  const fileWithExtension = baseName.includes(".")
    ? baseName
    : `${baseName}.${guessAssetExtension(contentType, kind)}`;
  const suffix = Math.random().toString(36).slice(2, 10);
  return `paper-assets/${kind}-${suffix}-${fileWithExtension}`;
}

async function persistAssetOnServer<T extends ManualOptionImage | ManualAudioFile>(
  asset: T | undefined,
  kind: "image" | "audio",
): Promise<T | undefined> {
  if (!asset) return undefined;

  const durableUrl = normalizePersistedAssetUrl(asset.previewUrl) || normalizePersistedAssetUrl(asset.dataUrl);
  if (durableUrl && !durableUrl.startsWith("data:")) {
    return {
      ...asset,
      dataUrl: durableUrl,
      previewUrl: durableUrl,
    };
  }

  const payload = decodeDataUrl(asset.dataUrl);
  if (!payload) {
    return {
      ...asset,
      dataUrl: normalizePersistedAssetUrl(asset.dataUrl) ?? asset.dataUrl,
      previewUrl: undefined,
    };
  }

  try {
    const { url } = await storagePut(
      buildAssetStorageKey(kind, asset.fileName, payload.contentType || asset.mimeType || "application/octet-stream"),
      payload.buffer,
      payload.contentType || asset.mimeType || "application/octet-stream",
    );
    const normalizedUrl = normalizePersistedAssetUrl(url) ?? url;

    return {
      ...asset,
      dataUrl: normalizedUrl,
      previewUrl: normalizedUrl,
      mimeType: payload.contentType || asset.mimeType,
      size: payload.buffer.byteLength || asset.size,
    };
  } catch (error) {
    console.error(`[papers] Failed to persist ${kind} asset on save:`, error);
    return {
      ...asset,
      dataUrl: asset.dataUrl,
      previewUrl: undefined,
    };
  }
}

async function persistQuestionAssetsOnServer(question: ManualQuestion): Promise<ManualQuestion> {
  if (question.type === "mcq" || question.type === "checkbox" || question.type === "passage-mcq") {
    return {
      ...question,
      options: await Promise.all(question.options.map(async (option) => (
        "image" in option
          ? {
              ...option,
              image: await persistAssetOnServer(option.image, "image"),
            }
          : option
      ))),
    };
  }

  if (
    question.type === "picture-spelling"
    || question.type === "word-completion"
    || question.type === "writing"
    || question.type === "speaking"
  ) {
    return {
      ...question,
      image: await persistAssetOnServer(question.image, "image"),
    };
  }

  return question;
}

async function persistSubsectionAssetsOnServer(subsection: ManualSubsection): Promise<ManualSubsection> {
  return {
    ...subsection,
    sceneImage: await persistAssetOnServer(subsection.sceneImage, "image"),
    audio: await persistAssetOnServer(subsection.audio, "audio"),
    questions: await Promise.all(subsection.questions.map((question) => persistQuestionAssetsOnServer(question))),
  };
}

async function persistBlueprintAssetsOnServer(blueprint: ManualPaperBlueprint): Promise<ManualPaperBlueprint> {
  return {
    ...blueprint,
    sections: await Promise.all(
      blueprint.sections.map(async (section: ManualSection & { partLabel: string }) => ({
        ...section,
        subsections: await Promise.all(section.subsections.map((subsection) => persistSubsectionAssetsOnServer(subsection))),
      })),
    ),
  };
}

const englishTagSystemInputSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  published: z.boolean().optional(),
  systemMode: z.enum(["assessment", "textbook-practice"]).default("assessment"),
  units: z.array(z.string()),
  examParts: z.array(z.string()),
  grammarByUnit: z.record(z.string(), z.array(z.string())).default({}),
  generatedPaper: z.object({
    title: z.string().default(""),
    description: z.string().default(""),
    practiceMode: z.enum(["unit", "question-type", "skill"]).default("unit"),
    parts: z.array(
      z.object({
        examPart: z.string().min(1),
        questionType: z.string().min(1),
        totalQuestions: z.number().int().min(0).default(0),
      }),
    ).default([]),
    practiceRules: z.array(
      z.object({
        id: z.string().default(""),
        filterValue: z.string().default(""),
        totalQuestions: z.number().int().min(0).default(0),
      }),
    ).default([]),
  }).optional(),
});

const basicTagSystemInputSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  published: z.boolean().optional(),
  systemMode: z.enum(["assessment", "textbook-practice"]).default("assessment"),
  units: z.array(z.string()),
  examParts: z.array(z.string()),
  generatedPaper: z.object({
    title: z.string().default(""),
    description: z.string().default(""),
    practiceMode: z.enum(["unit", "question-type", "skill"]).default("unit"),
    parts: z.array(
      z.object({
        examPart: z.string().min(1),
        questionType: z.string().min(1),
        totalQuestions: z.number().int().min(0).default(0),
      }),
    ).default([]),
    practiceRules: z.array(
      z.object({
        id: z.string().default(""),
        filterValue: z.string().default(""),
        totalQuestions: z.number().int().min(0).default(0),
      }),
    ).default([]),
  }).optional(),
});

export const paperRouter = router({
  // Shared upload endpoint used by speaking audio recording.
  uploadFile: publicProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        contentType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const suffix = Math.random().toString(36).slice(2, 10);
      const key = `paper-assets/${suffix}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const buffer = Buffer.from(input.fileBase64, "base64");

      try {
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url, key };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error ? err.message : "File upload failed unexpectedly.",
        });
      }
    }),

  generateDraft: publicProcedure
    .input(generatePaperDraftInputSchema)
    .mutation(async ({ input }) => {
      try {
        return await buildPaperDraft(input);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error ? err.message : "Paper draft generation failed unexpectedly.",
        });
      }
    }),

  /** Save a manually created paper to the database */
  saveManualPaper: publicProcedure
    .input(
      z.object({
        paperId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        subject: z.string().default("english"),
        category: z.string().default("assessment"),
        published: z.boolean().default(true),
        blueprintJson: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const parsedBlueprint = JSON.parse(input.blueprintJson) as ManualPaperBlueprint;
        const blueprint = await persistBlueprintAssetsOnServer(parsedBlueprint);
        const blueprintJson = JSON.stringify(blueprint);
        const totalQuestions = countBlueprintQuestions(blueprint);
        const hasListening = blueprintHasListening(blueprint);
        const hasWriting = blueprintHasWriting(blueprint);

        // Check if paperId already exists
        const existing = await getManualPaperByPaperId(input.paperId);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A paper with ID "${input.paperId}" already exists. Please use a different title.`,
          });
        }

        const id = await saveManualPaper({
          paperId: input.paperId,
          title: input.title,
          description: input.description || "",
          subject: input.subject,
          category: input.category,
          published: input.published ? 1 : 0,
          blueprintJson,
          totalQuestions,
          hasListening: hasListening ? 1 : 0,
          hasWriting: hasWriting ? 1 : 0,
        });

        if (id === null) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Manual paper could not be persisted.",
          });
        }

        return { id, paperId: input.paperId };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to save paper.",
        });
      }
    }),

  /** List all published manual papers (for the home page) */
  listManualPapers: publicProcedure.query(async () => {
    const papers = (await getPublishedManualPapers()).filter((paper) => {
      try {
        return getBlueprintBuildMode(JSON.parse(paper.blueprintJson)) !== "generated";
      } catch {
        return true;
      }
    });
    return papers.map((p) => ({
      id: p.id,
      paperId: p.paperId,
      title: p.title,
      description: p.description,
      subject: p.subject,
      category: p.category,
      totalQuestions: p.totalQuestions,
      hasListening: p.hasListening === 1,
      hasWriting: p.hasWriting === 1,
      blueprintJson: p.blueprintJson,
      createdAt: p.createdAt,
    }));
  }),

  /** List all manual papers for the management page */
  listAllManualPapers: publicProcedure.query(async () => {
    const papers = (await getAllManualPapers()).filter((paper) => {
      try {
        return getBlueprintBuildMode(JSON.parse(paper.blueprintJson)) !== "generated";
      } catch {
        return true;
      }
    });
    return papers.map((p) => ({
      ...(() => {
        try {
          const parsedBlueprint = JSON.parse(p.blueprintJson);
          return {
            buildMode: getBlueprintBuildMode(parsedBlueprint),
            visibilityMode: getBlueprintVisibilityMode(parsedBlueprint),
          };
        } catch {
          return {
            buildMode: "fixed" as const,
            visibilityMode: "student" as const,
          };
        }
      })(),
      id: p.id,
      paperId: p.paperId,
      title: p.title,
      description: p.description,
      subject: p.subject,
      category: p.category,
      published: p.published === 1,
      totalQuestions: p.totalQuestions,
      hasListening: p.hasListening === 1,
      hasWriting: p.hasWriting === 1,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }),

  listQuestionBankPapers: publicProcedure.query(async () => {
    const papers = await getAllManualPapers();
    return papers.flatMap((p) => {
      try {
        const parsedBlueprint = JSON.parse(p.blueprintJson);
        if (
          getBlueprintBuildMode(parsedBlueprint) !== "fixed"
          || getBlueprintVisibilityMode(parsedBlueprint) !== "question-bank"
        ) {
          return [];
        }

        return [{
          id: p.id,
          paperId: p.paperId,
          title: p.title,
          description: p.description,
          subject: p.subject,
          category: p.category,
          published: p.published === 1,
          totalQuestions: p.totalQuestions,
          itemCount: Array.isArray(parsedBlueprint.sections) ? parsedBlueprint.sections.length : 0,
          blueprintJson: p.blueprintJson,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }];
      } catch {
        return [];
      }
    });
  }),

  getEnglishTagSystems: publicProcedure.query(async () => {
    return getEnglishTagSystems();
  }),

  getMathTagSystems: publicProcedure.query(async () => {
    return getMathTagSystems();
  }),

  getVocabularyTagSystems: publicProcedure.query(async () => {
    return getVocabularyTagSystems();
  }),

  saveEnglishTagSystems: publicProcedure
    .input(z.object({ systems: z.array(englishTagSystemInputSchema) }))
    .mutation(async ({ input }) => {
      try {
        await saveEnglishTagSystems(input.systems);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to save English tag systems.",
        });
      }
    }),

  saveMathTagSystems: publicProcedure
    .input(z.object({ systems: z.array(basicTagSystemInputSchema) }))
    .mutation(async ({ input }) => {
      try {
        await saveMathTagSystems(input.systems);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to save Math tag systems.",
        });
      }
    }),

  saveVocabularyTagSystems: publicProcedure
    .input(z.object({ systems: z.array(basicTagSystemInputSchema) }))
    .mutation(async ({ input }) => {
      try {
        await saveVocabularyTagSystems(input.systems);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to save Vocabulary tag systems.",
        });
      }
    }),

  /** Fetch one manual paper with its blueprint for editing */
  getManualPaperDetail: publicProcedure
    .input(z.object({ paperId: z.string().min(1) }))
    .query(async ({ input }) => {
      const paper = await getManualPaperByPaperId(input.paperId);
      if (!paper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Manual paper "${input.paperId}" was not found.`,
        });
      }

      return {
        id: paper.id,
        paperId: paper.paperId,
        title: paper.title,
        description: paper.description,
        subject: paper.subject,
        category: paper.category,
        published: paper.published === 1,
        totalQuestions: paper.totalQuestions,
        hasListening: paper.hasListening === 1,
        hasWriting: paper.hasWriting === 1,
        blueprintJson: paper.blueprintJson,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
      };
    }),

  /** Update an existing manual paper while keeping its paperId stable */
  updateManualPaper: publicProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        subject: z.string().optional(),
        category: z.string().optional(),
        published: z.boolean().optional(),
        blueprintJson: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const parsedBlueprint = JSON.parse(input.blueprintJson) as ManualPaperBlueprint;
        const blueprint = await persistBlueprintAssetsOnServer(parsedBlueprint);
        const blueprintJson = JSON.stringify(blueprint);
        const totalQuestions = countBlueprintQuestions(blueprint);
        const hasListening = blueprintHasListening(blueprint);
        const hasWriting = blueprintHasWriting(blueprint);

        await persistManualPaperUpdate(input.id, {
          title: input.title,
          description: input.description || "",
          subject: input.subject,
          category: input.category,
          published: input.published === undefined ? undefined : (input.published ? 1 : 0),
          blueprintJson,
          totalQuestions,
          hasListening: hasListening ? 1 : 0,
          hasWriting: hasWriting ? 1 : 0,
        });

        return { success: true, id: input.id };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to update paper.",
        });
      }
    }),

  /** Toggle whether a manual paper is published and visible to students */
  setManualPaperPublished: publicProcedure
    .input(z.object({ id: z.number(), published: z.boolean() }))
    .mutation(async ({ input }) => {
      await persistManualPaperUpdate(input.id, {
        published: input.published ? 1 : 0,
      });
      return { success: true };
    }),

  /** Duplicate a manual paper as a new draft copy */
  duplicateManualPaper: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const paper = await getManualPaperById(input.id);
      if (!paper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Manual paper not found.",
        });
      }

      const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const paperId = `${paper.paperId}-copy-${suffix}`;
      const title = `${paper.title} (Copy)`;

      let blueprintJson = paper.blueprintJson;
      try {
        const parsed = JSON.parse(paper.blueprintJson) as Record<string, unknown>;
        const nextBlueprint = {
          ...parsed,
          id: paperId,
          title,
        };
        blueprintJson = JSON.stringify(nextBlueprint);
      } catch {
        // Keep the source blueprint if it cannot be parsed cleanly.
      }

      const createdId = await saveManualPaper({
        paperId,
        title,
        description: paper.description ?? "",
        subject: paper.subject,
        category: paper.category,
        published: 0,
        blueprintJson,
        totalQuestions: paper.totalQuestions,
        hasListening: paper.hasListening,
        hasWriting: paper.hasWriting,
      });

      if (createdId === null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Manual paper could not be duplicated.",
        });
      }

      return {
        id: createdId,
        paperId,
        title,
      };
    }),

  /** Delete a manual paper */
  deleteManualPaper: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteManualPaper(input.id);
      return { success: true };
    }),
});
