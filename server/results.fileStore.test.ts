import fs from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const TEST_RESULTS_PATH = path.resolve(import.meta.dirname, "..", "tmp", "test-results.file-store.test.json");

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

describe("results file fallback", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "";
    process.env.LOCAL_TEST_RESULTS_FILE = TEST_RESULTS_PATH;
    await fs.rm(TEST_RESULTS_PATH, { force: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_RESULTS_PATH, { force: true });
    delete process.env.LOCAL_TEST_RESULTS_FILE;
  });

  it("deduplicates identical pending result retries", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const payload = {
      studentName: "ccc123",
      studentGrade: "Grade 6",
      paperId: "tag-system-english-ket",
      paperTitle: "KET Unit1 Practice",
      totalCorrect: 12,
      totalQuestions: 20,
      totalTimeSeconds: 600,
      answersJson: JSON.stringify({
        __format: "assessment_payload_v2",
        answers: { "reading:1": "A" },
        paperSnapshot: { id: "tag-system-english-ket", title: "KET Unit1 Practice" },
      }),
      scoreBySectionJson: JSON.stringify({ reading: { correct: 12, total: 20 } }),
      sectionTimingsJson: JSON.stringify({ reading: 600 }),
    };

    const first = await caller.results.save(payload);
    const second = await caller.results.save(payload);

    expect(second.id).toBe(first.id);

    const listed = await caller.results.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].paperTitle).toBe("KET Unit1 Practice");
  });
});
