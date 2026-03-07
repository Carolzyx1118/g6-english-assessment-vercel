import { z } from "zod";
import { getForgeConfigStatus } from "./env";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  runtimeStatus: publicProcedure.query(() => {
    const forge = getForgeConfigStatus();
    return {
      aiConfigured: true,
      storageConfigured: true,
      aiProvider: forge.isConfigured ? "forge" : "local",
      storageProvider: forge.isConfigured ? "forge" : "local",
      usingLocalFallback: !forge.isConfigured,
      missingVariables: forge.missingVariables,
    };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
