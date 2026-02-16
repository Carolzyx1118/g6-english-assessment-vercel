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

describe("grading.checkReadingAnswers", () => {
  it("accepts valid reading answer input and returns results", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      answers: [
        {
          questionId: 31,
          questionType: "open-ended",
          questionText: "What did the narrator do once a year?",
          userAnswer: "Go to the dentist",
          correctAnswer: "Visit the dentist for annual check-up",
        },
      ],
    };

    // This will call the actual LLM, so we just verify the shape
    const result = await caller.grading.checkReadingAnswers(input);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("questionId");
    expect(result[0]).toHaveProperty("isCorrect");
    expect(result[0]).toHaveProperty("score");
    expect(result[0]).toHaveProperty("feedback");
    expect(typeof result[0].questionId).toBe("number");
    expect(typeof result[0].isCorrect).toBe("boolean");
    expect(typeof result[0].score).toBe("number");
    expect(typeof result[0].feedback).toBe("string");
  }, 30000);
});

describe("grading.evaluateWriting", () => {
  it("returns evaluation for a valid essay", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      essay: "One day I was walking in the park when I met an old man sitting on a bench. He looked sad so I sat down next to him and asked if he was okay. He told me he had lost his dog and was very worried. I helped him look for the dog and we found it near the lake. The old man was so happy and thanked me many times. This encounter taught me that a small act of kindness can make a big difference in someone's life.",
      topic: "An Unexpected Encounter",
      wordCountTarget: "200-250 words",
    };

    const result = await caller.grading.evaluateWriting(input);

    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("maxScore");
    expect(result).toHaveProperty("grade");
    expect(result).toHaveProperty("overallFeedback");
    expect(result).toHaveProperty("grammarErrors");
    expect(result).toHaveProperty("suggestions");
    expect(result).toHaveProperty("correctedEssay");
    expect(typeof result.score).toBe("number");
    expect(result.maxScore).toBe(20);
    expect(typeof result.grade).toBe("string");
    expect(Array.isArray(result.grammarErrors)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  }, 30000);

  it("handles empty essay gracefully", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.grading.evaluateWriting({
      essay: "",
      topic: "An Unexpected Encounter",
      wordCountTarget: "200-250 words",
    });

    expect(result.score).toBe(0);
    expect(result.grade).toBe("N/A");
  });
});
