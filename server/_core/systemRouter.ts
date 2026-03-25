import { sql } from "drizzle-orm";
import { z } from "zod";
import { testResults } from "../../drizzle/schema";
import { getDb } from "../db";
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

  runtimeStatus: publicProcedure.query(async () => {
    const forge = getForgeConfigStatus();
    const storage = getStorageConfigStatus();
    const db = await getDb();

    let databaseReachable = false;
    let testResultsQueryable = false;
    let testResultsCount: number | null = null;
    let databaseError: string | null = null;

    if (db) {
      try {
        await db.execute(sql`select 1`);
        databaseReachable = true;

        const countRows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(testResults);
        testResultsQueryable = true;
        testResultsCount = countRows[0]?.count ?? 0;
      } catch (error) {
        databaseError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      aiConfigured: forge.isConfigured,
      storageConfigured: storage.isConfigured,
      aiProvider: forge.isConfigured ? "forge" : "local",
      storageProvider: storage.provider,
      usingLocalFallback: !storage.isConfigured,
      missingVariables: storage.missingVariables,
      runtime: isVercelRuntime() ? "vercel" : "node",
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      databaseReachable,
      testResultsQueryable,
      testResultsCount,
      databaseError,
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
