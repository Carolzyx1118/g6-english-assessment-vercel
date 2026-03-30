import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(
  headers: Record<string, string> = {},
): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers,
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
  let generatedSavedId: number | null = null;
  let dedupedSavedId: number | null = null;
  let mineSavedId: number | null = null;
  let otherSavedId: number | null = null;

  it("saves a test result and returns an id", async () => {
    const result = await caller.results.save({
      studentName: "Test Student",
      studentGrade: "Grade 6",
      paperId: "test-paper-1",
      paperTitle: "Test Paper",
      totalCorrect: 15,
      totalQuestions: 20,
      totalTimeSeconds: 600,
      answersJson: JSON.stringify({
        q1: "a",
        q2: "b",
        speaking: "data:audio/webm;base64,AAAA",
      }),
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
    expect(found!.reportStatus).toBe("raw");
  });

  it("retrieves a result by id with full details", async () => {
    const detail = await caller.results.getById({ id: savedId! });
    expect(detail).not.toBeNull();
    expect(detail!.studentName).toBe("Test Student");
    expect(detail!.studentGrade).toBe("Grade 6");
    expect(detail!.paperId).toBe("test-paper-1");
    expect(detail!.answersJson).toBe(JSON.stringify({
      q1: "a",
      q2: "b",
      speaking: "",
    }));
  });

  it("updates AI results for a saved record", async () => {
    const readingResults = JSON.stringify([{ questionId: "1", isCorrect: true, score: 1 }]);
    const reportData = JSON.stringify({
      summary_en: "Good progress",
      speakingEvaluation: {
        evaluations: [
          {
            audioUrl: "data:audio/wav;base64,BBBB",
          },
        ],
      },
    });

    const updateResult = await caller.results.updateAI({
      id: savedId!,
      readingResultsJson: readingResults,
      reportJson: reportData,
    });
    expect(updateResult).toEqual({ success: true });

    // Verify the update
    const detail = await caller.results.getById({ id: savedId! });
    expect(detail!.readingResultsJson).toBe(readingResults);
    expect(detail!.reportJson).toBe(JSON.stringify({
      summary_en: "Good progress",
      speakingEvaluation: {
        evaluations: [
          {
            audioUrl: "",
          },
        ],
      },
    }));

    const list = await caller.results.list();
    expect(list.find((r) => r.id === savedId)?.reportStatus).toBe("completed");
  });

  it("recovers generated paper metadata from stored assessment payload", async () => {
    const generatedAnswersJson = JSON.stringify({
      __format: "assessment_payload_v2",
      answers: { q1: "A" },
      paperSnapshot: {
        id: "tag-system-english-ket-unit-1",
        title: "KET Unit 1 Practice",
        subject: "english",
      },
    });

    const saveResult = await caller.results.save({
      studentName: "Generated Student",
      paperId: "unknown",
      paperTitle: "Assessment",
      totalCorrect: 1,
      totalQuestions: 1,
      answersJson: generatedAnswersJson,
    });

    generatedSavedId = saveResult.id!;

    const list = await caller.results.list();
    const found = list.find((result) => result.id === generatedSavedId);
    expect(found).toBeDefined();
    expect(found!.paperId).toBe("tag-system-english-ket-unit-1");
    expect(found!.paperTitle).toBe("KET Unit 1 Practice");
    expect(found!.paperSubject).toBe("english");
  });

  it("deduplicates identical pending result retries", async () => {
    const duplicatedAnswersJson = JSON.stringify({ q1: "retry" });

    const firstSave = await caller.results.save({
      studentName: "Retry Student",
      paperId: "retry-paper",
      paperTitle: "Retry Paper",
      totalCorrect: 2,
      totalQuestions: 3,
      totalTimeSeconds: 90,
      answersJson: duplicatedAnswersJson,
      scoreBySectionJson: JSON.stringify({ reading: { correct: 2, total: 3 } }),
      sectionTimingsJson: JSON.stringify({ reading: 90 }),
    });

    const secondSave = await caller.results.save({
      studentName: "Retry Student",
      paperId: "retry-paper",
      paperTitle: "Retry Paper",
      totalCorrect: 2,
      totalQuestions: 3,
      totalTimeSeconds: 90,
      answersJson: duplicatedAnswersJson,
      scoreBySectionJson: JSON.stringify({ reading: { correct: 2, total: 3 } }),
      sectionTimingsJson: JSON.stringify({ reading: 90 }),
    });

    dedupedSavedId = firstSave.id!;
    expect(secondSave.id).toBe(firstSave.id);
  });

  it("lists only the current student's owned results", async () => {
    const username = `mistake_student_${Date.now()}`;
    const password = "test123456";

    await caller.localAuth.register({
      username,
      password,
      inviteCode: "ENGVOC2026",
    });

    const login = await caller.localAuth.login({
      username,
      password,
    });
    const authCtx = createPublicContext({
      authorization: `Bearer ${login.token}`,
    });
    const authCaller = appRouter.createCaller(authCtx);

    mineSavedId = (
      await caller.results.save({
        studentName: username,
        paperId: "mine-paper",
        paperTitle: "Mine Paper",
        totalCorrect: 1,
        totalQuestions: 2,
        answersJson: JSON.stringify({
          __format: "assessment_payload_v2",
          answers: { q1: "A" },
          owner: {
            username,
            displayName: username,
          },
        }),
      })
    ).id!;

    otherSavedId = (
      await caller.results.save({
        studentName: "Someone Else",
        paperId: "other-paper",
        paperTitle: "Other Paper",
        totalCorrect: 0,
        totalQuestions: 2,
        answersJson: JSON.stringify({
          __format: "assessment_payload_v2",
          answers: { q1: "B" },
          owner: {
            username: "different_user",
            displayName: "Different User",
          },
        }),
      })
    ).id!;

    const mine = await authCaller.results.listMine();

    expect(mine.map((item) => item.id)).toContain(mineSavedId);
    expect(mine.map((item) => item.id)).not.toContain(otherSavedId);
  });

  it("deletes a result", async () => {
    const deleteResult = await caller.results.delete({ id: savedId! });
    expect(deleteResult).toEqual({ success: true });

    // Verify deletion
    const detail = await caller.results.getById({ id: savedId! });
    expect(detail).toBeNull();
  });

  it("deletes the generated metadata fixture", async () => {
    const deleteResult = await caller.results.delete({ id: generatedSavedId! });
    expect(deleteResult).toEqual({ success: true });
  });

  it("deletes the deduped retry fixture", async () => {
    const deleteResult = await caller.results.delete({ id: dedupedSavedId! });
    expect(deleteResult).toEqual({ success: true });
  });

  it("deletes the listMine fixtures", async () => {
    const firstDelete = await caller.results.delete({ id: mineSavedId! });
    const secondDelete = await caller.results.delete({ id: otherSavedId! });

    expect(firstDelete).toEqual({ success: true });
    expect(secondDelete).toEqual({ success: true });
  });
});
