import { TRPCError } from "@trpc/server";
import { generatePaperDraftInputSchema } from "@shared/paperDraft";

import { router, publicProcedure } from "./_core/trpc";
import { buildPaperDraft } from "./paperDraftParser";
import { storagePut } from "./storage";
import { saveManualPaper, getPublishedManualPapers, getManualPaperByPaperId, deleteManualPaper } from "./db";
import { countBlueprintQuestions, blueprintHasListening, blueprintHasWriting } from "@shared/blueprintToPaper";
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

  /** Delete a manual paper */
  deleteManualPaper: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteManualPaper(input.id);
      return { success: true };
    }),
});
