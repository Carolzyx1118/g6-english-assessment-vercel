import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router, publicProcedure } from "./_core/trpc";
import { storagePut } from "./storage";

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
});
