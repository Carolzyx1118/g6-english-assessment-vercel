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
      published: true,
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
      published: true,
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
      published: true,
      blueprintJson: JSON.stringify(makeBlueprint()),
    });

    await caller.papers.deleteManualPaper({ id: saved.id! });

    const listed = await caller.papers.listManualPapers();
    expect(listed).toHaveLength(0);
  });

  it("can unpublish a file-backed manual paper without deleting it", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const saved = await caller.papers.saveManualPaper({
      paperId: "manual-paper-hidden",
      title: "Hide Me",
      description: "Unpublish test",
      published: true,
      blueprintJson: JSON.stringify(makeBlueprint()),
    });

    await caller.papers.setManualPaperPublished({
      id: saved.id!,
      published: false,
    });

    const published = await caller.papers.listManualPapers();
    const allPapers = await caller.papers.listAllManualPapers();

    expect(published).toHaveLength(0);
    expect(allPapers).toHaveLength(1);
    expect(allPapers[0].published).toBe(false);
  });

  it("loads and updates a file-backed manual paper for editing", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const saved = await caller.papers.saveManualPaper({
      paperId: "manual-paper-edit",
      title: "Original Title",
      description: "Original description",
      published: true,
      blueprintJson: JSON.stringify(makeBlueprint()),
    });

    const loaded = await caller.papers.getManualPaperDetail({
      paperId: "manual-paper-edit",
    });

    expect(loaded.id).toBe(saved.id);
    expect(loaded.title).toBe("Original Title");

    const updatedBlueprint = {
      ...makeBlueprint(),
      title: "Updated Title",
      description: "Updated description",
    };

    await caller.papers.updateManualPaper({
      id: saved.id!,
      title: "Updated Title",
      description: "Updated description",
      published: true,
      blueprintJson: JSON.stringify(updatedBlueprint),
    });

    const reloaded = await caller.papers.getManualPaperDetail({
      paperId: "manual-paper-edit",
    });

    expect(reloaded.title).toBe("Updated Title");
    expect(reloaded.description).toBe("Updated description");

    const allPapers = await caller.papers.listAllManualPapers();
    expect(allPapers[0].title).toBe("Updated Title");
  });

  it("can save a manual paper as a draft without listing it publicly", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const saved = await caller.papers.saveManualPaper({
      paperId: "manual-paper-draft",
      title: "Draft Paper",
      description: "Draft mode",
      published: false,
      blueprintJson: JSON.stringify(makeBlueprint()),
    });

    const published = await caller.papers.listManualPapers();
    const allPapers = await caller.papers.listAllManualPapers();

    expect(saved.id).toBeTypeOf("number");
    expect(published).toHaveLength(0);
    expect(allPapers).toHaveLength(1);
    expect(allPapers[0].published).toBe(false);
  });

  it("duplicates a manual paper into an unpublished draft copy", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const source = await caller.papers.saveManualPaper({
      paperId: "manual-paper-source",
      title: "Source Paper",
      description: "Original",
      published: true,
      blueprintJson: JSON.stringify(makeBlueprint()),
    });

    const duplicate = await caller.papers.duplicateManualPaper({ id: source.id! });
    const allPapers = await caller.papers.listAllManualPapers();

    expect(duplicate.id).toBeTypeOf("number");
    expect(duplicate.paperId).toContain("manual-paper-source-copy-");
    expect(allPapers).toHaveLength(2);
    expect(allPapers.find((paper) => paper.id === duplicate.id)?.published).toBe(false);
    expect(allPapers.find((paper) => paper.id === duplicate.id)?.title).toBe("Source Paper (Copy)");
  });

  it("stores English tag systems without exposing them as normal papers", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await caller.papers.saveEnglishTagSystems({
      systems: [
        {
          id: "fce",
          label: "FCE / B2 First",
          units: ["Unit 1", "Unit 2"],
          examParts: ["阅读 Part 1", "写作 Part 2"],
          grammarByUnit: {},
        },
      ],
    });

    const systems = await caller.papers.getEnglishTagSystems();
    const allPapers = await caller.papers.listAllManualPapers();

    expect(systems).toHaveLength(1);
    expect(systems[0].label).toBe("FCE / B2 First");
    expect(allPapers).toHaveLength(0);
  });
});
