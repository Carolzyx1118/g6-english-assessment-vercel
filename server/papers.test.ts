import { describe, expect, it, beforeAll, afterAll } from "vitest";
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

describe("papers router", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);
  let createdPaperId: number;
  let createdPaperSlug: string;

  const sampleSections = JSON.stringify([
    {
      id: "vocabulary",
      title: "Part 1: Vocabulary",
      subtitle: "Choose the correct answer",
      icon: "📖",
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "Test vocabulary knowledge",
      questions: [
        {
          id: 1,
          type: "mcq",
          question: "What is the opposite of 'hot'?",
          options: ["warm", "cold", "cool", "freezing"],
          correctAnswer: 1,
        },
        {
          id: 2,
          type: "mcq",
          question: "Choose the synonym of 'happy'",
          options: ["sad", "joyful", "angry", "tired"],
          correctAnswer: 1,
        },
      ],
    },
  ]);

  it("creates a new paper as draft", async () => {
    const result = await caller.papers.create({
      title: "Test Paper for Vitest",
      subtitle: "Unit Test",
      description: "A paper created by automated tests",
      totalQuestions: 2,
      hasListening: false,
      hasWriting: false,
      sectionsJson: sampleSections,
      status: "draft",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    expect(result.paperId).toContain("custom-");
    createdPaperId = result.id;
    createdPaperSlug = result.paperId;
  });

  it("lists all papers including the newly created one", async () => {
    const papers = await caller.papers.list();
    expect(Array.isArray(papers)).toBe(true);
    const found = papers.find((p) => p.id === createdPaperId);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Test Paper for Vitest");
    expect(found!.status).toBe("draft");
    expect(found!.totalQuestions).toBe(2);
    expect(found!.hasListening).toBe(false);
    expect(found!.hasWriting).toBe(false);
  });

  it("does NOT list draft papers in listPublished", async () => {
    const published = await caller.papers.listPublished();
    const found = published.find((p) => p.paperId === createdPaperSlug);
    expect(found).toBeUndefined();
  });

  it("updates paper status to published", async () => {
    const result = await caller.papers.update({
      id: createdPaperId,
      status: "published",
    });
    expect(result).toEqual({ success: true });
  });

  it("lists published papers including the updated one", async () => {
    const published = await caller.papers.listPublished();
    const found = published.find((p) => p.paperId === createdPaperSlug);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Test Paper for Vitest");
    expect(found!.sectionsJson).toBeDefined();
    // Verify sections can be parsed
    const sections = JSON.parse(found!.sectionsJson);
    expect(sections).toHaveLength(1);
    expect(sections[0].questions).toHaveLength(2);
  });

  it("gets paper by ID with full details", async () => {
    const paper = await caller.papers.getById({ id: createdPaperId });
    expect(paper).toBeDefined();
    expect(paper!.title).toBe("Test Paper for Vitest");
    expect(paper!.hasListening).toBe(false);
    expect(paper!.hasWriting).toBe(false);
    expect(paper!.status).toBe("published");
  });

  it("updates paper title and metadata", async () => {
    const result = await caller.papers.update({
      id: createdPaperId,
      title: "Updated Test Paper",
      totalQuestions: 5,
      hasListening: true,
    });
    expect(result).toEqual({ success: true });

    const paper = await caller.papers.getById({ id: createdPaperId });
    expect(paper!.title).toBe("Updated Test Paper");
    expect(paper!.totalQuestions).toBe(5);
    expect(paper!.hasListening).toBe(true);
  });

  it("deletes the paper", async () => {
    const result = await caller.papers.delete({ id: createdPaperId });
    expect(result).toEqual({ success: true });

    // Verify it's gone
    const paper = await caller.papers.getById({ id: createdPaperId });
    expect(paper).toBeNull();
  });

  it("list no longer includes deleted paper", async () => {
    const papers = await caller.papers.list();
    const found = papers.find((p) => p.id === createdPaperId);
    expect(found).toBeUndefined();
  });
});
