import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("results CRUD", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);
  let savedId: number | null = null;

  it("saves a test result and returns an id", async () => {
    const result = await caller.results.save({
      studentName: "Test Student",
      studentGrade: "Grade 6",
      paperId: "test-paper-1",
      paperTitle: "Test Paper",
      totalCorrect: 15,
      totalQuestions: 20,
      totalTimeSeconds: 600,
      answersJson: JSON.stringify({ q1: "a", q2: "b" }),
      scoreBySectionJson: JSON.stringify({ vocab: { correct: 8, total: 10 }, grammar: { correct: 7, total: 10 } }),
      sectionTimingsJson: JSON.stringify({ vocab: 300, grammar: 300 }),
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    savedId = result.id!;
  });

  it("lists results including the saved one", async () => {
    const list = await caller.results.list();
    expect(Array.isArray(list)).toBe(true);
    const found = list.find((r) => r.id === savedId);
    expect(found).toBeDefined();
    expect(found!.studentName).toBe("Test Student");
    expect(found!.paperTitle).toBe("Test Paper");
    expect(found!.totalCorrect).toBe(15);
    expect(found!.totalQuestions).toBe(20);
  });

  it("retrieves a result by id with full details", async () => {
    const detail = await caller.results.getById({ id: savedId! });
    expect(detail).not.toBeNull();
    expect(detail!.studentName).toBe("Test Student");
    expect(detail!.studentGrade).toBe("Grade 6");
    expect(detail!.paperId).toBe("test-paper-1");
    expect(detail!.answersJson).toBe(JSON.stringify({ q1: "a", q2: "b" }));
  });

  it("updates AI results for a saved record", async () => {
    const readingResults = JSON.stringify([{ questionId: "1", isCorrect: true, score: 1 }]);
    const reportData = JSON.stringify({ languageLevel: "B1", summary_en: "Good progress" });

    const updateResult = await caller.results.updateAI({
      id: savedId!,
      readingResultsJson: readingResults,
      reportJson: reportData,
    });
    expect(updateResult).toEqual({ success: true });

    // Verify the update
    const detail = await caller.results.getById({ id: savedId! });
    expect(detail!.readingResultsJson).toBe(readingResults);
    expect(detail!.reportJson).toBe(reportData);
  });

  it("deletes a result", async () => {
    const deleteResult = await caller.results.delete({ id: savedId! });
    expect(deleteResult).toEqual({ success: true });

    // Verify deletion
    const detail = await caller.results.getById({ id: savedId! });
    expect(detail).toBeNull();
  });
});
