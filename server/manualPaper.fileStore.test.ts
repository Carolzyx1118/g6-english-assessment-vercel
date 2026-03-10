import fs from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const TEST_STORE_PATH = path.resolve(import.meta.dirname, "..", "tmp", "manual-papers.test.json");

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

function makeBlueprint() {
  return {
    id: "manual-paper-1",
    title: "Manual Paper 1",
    description: "Stored without a database",
    createdAt: "2026-03-11T00:00:00.000Z",
    sections: [
      {
        id: "section-1",
        partLabel: "Part 1",
        sectionType: "reading",
        subsections: [
          {
            id: "sub-1",
            title: "MCQ",
            instructions: "Choose one answer.",
            questionType: "mcq",
            questions: [
              {
                id: "q-1",
                type: "mcq",
                prompt: "What is 1 + 1?",
                options: [
                  { id: "o-1", label: "A", text: "1" },
                  { id: "o-2", label: "B", text: "2" },
                  { id: "o-3", label: "C", text: "3" },
                ],
                correctAnswer: "B",
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("manual paper file fallback", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "";
    process.env.LOCAL_MANUAL_PAPERS_FILE = TEST_STORE_PATH;
    await fs.rm(TEST_STORE_PATH, { force: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_STORE_PATH, { force: true });
    delete process.env.LOCAL_MANUAL_PAPERS_FILE;
  });

  it("saves and lists manual papers without a database", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const result = await caller.papers.saveManualPaper({
      paperId: "manual-paper-1",
      title: "Manual Paper 1",
      description: "Stored without a database",
      blueprintJson: JSON.stringify(makeBlueprint()),
    });

    expect(result.id).toBeTypeOf("number");

    const fileContents = JSON.parse(await fs.readFile(TEST_STORE_PATH, "utf8"));
    expect(fileContents.papers).toHaveLength(1);
    expect(fileContents.papers[0].paperId).toBe("manual-paper-1");

    const listed = await caller.papers.listManualPapers();
    expect(listed).toHaveLength(1);
    expect(listed[0].paperId).toBe("manual-paper-1");
    expect(listed[0].title).toBe("Manual Paper 1");
  });

  it("rejects duplicate paper ids in file-backed storage", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const payload = {
      paperId: "manual-paper-dup",
      title: "Duplicate",
      description: "Duplicate test",
      blueprintJson: JSON.stringify(makeBlueprint()),
    };

    await caller.papers.saveManualPaper(payload);

    await expect(caller.papers.saveManualPaper(payload)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("deletes file-backed manual papers", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const saved = await caller.papers.saveManualPaper({
      paperId: "manual-paper-delete",
      title: "Delete Me",
      description: "Delete test",
      blueprintJson: JSON.stringify(makeBlueprint()),
    });

    await caller.papers.deleteManualPaper({ id: saved.id! });

    const listed = await caller.papers.listManualPapers();
    expect(listed).toHaveLength(0);
  });
});
