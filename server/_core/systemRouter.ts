import { z } from "zod";
import { getForgeConfigStatus, getStorageConfigStatus } from "./env";
import { notifyOwner } from "./notification";
import { isVercelRuntime } from "./runtime";
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
    const storage = getStorageConfigStatus();
    return {
      aiConfigured: forge.isConfigured,
      storageConfigured: storage.isConfigured,
      aiProvider: forge.isConfigured ? "forge" : "local",
      storageProvider: storage.provider,
      usingLocalFallback: !storage.isConfigured,
      missingVariables: storage.missingVariables,
      runtime: isVercelRuntime() ? "vercel" : "node",
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
