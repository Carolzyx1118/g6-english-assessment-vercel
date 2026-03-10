import { TRPCError } from "@trpc/server";
import { generatePaperDraftInputSchema } from "@shared/paperDraft";

import { router, publicProcedure } from "./_core/trpc";
import { getForgeConfigStatus } from "./_core/env";
import { buildAIPaperDraft } from "./paperAIDraftParser";
import { buildPaperDraft } from "./paperDraftParser";
import { storagePut } from "./storage";
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

  generateAiDraft: publicProcedure
    .input(generatePaperDraftInputSchema)
    .mutation(async ({ input }) => {
      const forge = getForgeConfigStatus();
      if (!forge.isConfigured) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message:
            "AI draft extraction requires BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY on the server.",
        });
      }

      try {
        return await buildAIPaperDraft(input);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error ? err.message : "AI paper draft generation failed unexpectedly.",
        });
      }
    }),
});
