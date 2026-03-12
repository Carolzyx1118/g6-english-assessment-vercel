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
} from "./db";
import {
  countBlueprintQuestions,
  blueprintHasListening,
  blueprintHasWriting,
} from "../shared/blueprintToPaper";
import { z } from "zod";

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
        const blueprint = JSON.parse(input.blueprintJson);
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
          blueprintJson: input.blueprintJson,
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
    const papers = await getPublishedManualPapers();
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
    const papers = await getAllManualPapers();
    return papers.map((p) => ({
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
        const blueprint = JSON.parse(input.blueprintJson);
        const totalQuestions = countBlueprintQuestions(blueprint);
        const hasListening = blueprintHasListening(blueprint);
        const hasWriting = blueprintHasWriting(blueprint);

        await persistManualPaperUpdate(input.id, {
          title: input.title,
          description: input.description || "",
          subject: input.subject,
          category: input.category,
          published: input.published === undefined ? undefined : (input.published ? 1 : 0),
          blueprintJson: input.blueprintJson,
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
