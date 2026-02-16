import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock invokeLLM to avoid real API calls in tests
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockImplementation(async ({ messages }: any) => {
    const userMsg = messages.find((m: any) => m.role === "user")?.content || "";

    // Reading comprehension grading
    if (userMsg.includes("reading comprehension")) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              results: [
                { questionId: "31", isCorrect: true, score: 1, feedback: "Correct answer.", explanation: "The student correctly identified the main idea from paragraph 1." },
                { questionId: "32-a", isCorrect: false, score: 0, feedback: "Incorrect.", explanation: "The passage states the opposite. Re-read paragraph 2 carefully." },
              ],
            }),
          },
        }],
      };
    }

    // Writing evaluation
    if (userMsg.includes("composition") || userMsg.includes("evaluating")) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              score: 15,
              maxScore: 20,
              grade: "B",
              overallFeedback: "Good effort with clear ideas. Some grammar issues to address.",
              grammarErrors: [
                { original: "goed", correction: "went", explanation: "Past tense of 'go' is 'went'." },
              ],
              suggestions: ["Use more varied vocabulary.", "Check verb tenses."],
              correctedEssay: "I went to the park and saw a beautiful bird.",
              annotatedEssay: "I [[ERROR:goed||went||Past tense of 'go' is 'went'.]] to the park and [[ERROR:seen||saw||Use 'saw' instead of 'seen'.]] a beautiful bird.",
            }),
          },
        }],
      };
    }

    // Wrong answer explanations
    if (userMsg.includes("wrong answers") || userMsg.includes("explanations for")) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              explanations: [
                { questionId: 1, explanation: "The word 'benevolent' means kind and generous. Option B is correct because it matches this definition.", tip: "Remember: 'bene' = good, 'volent' = wishing." },
                { questionId: 5, explanation: "The correct tense here is past simple because the action happened yesterday.", tip: "Use past simple for completed actions in the past." },
              ],
            }),
          },
        }],
      };
    }

    // Proficiency report
    if (userMsg.includes("proficiency report") || userMsg.includes("assessment expert")) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              languageLevel: "A2",
              summary: "The student shows a developing understanding of English at the elementary level.",
              strengths: ["Good listening comprehension", "Adequate vocabulary range"],
              weaknesses: ["Grammar accuracy needs improvement", "Writing organization could be better"],
              recommendations: ["Practice past tense verb forms daily", "Read short stories to improve vocabulary"],
              timeAnalysis: "The student spent appropriate time on listening but rushed through grammar.",
            }),
          },
        }],
      };
    }

    return { choices: [{ message: { content: "{}" } }] };
  }),
}));

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("grading.checkReadingAnswers", () => {
  it("returns AI-graded results with explanations for reading answers", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.grading.checkReadingAnswers({
      answers: [
        { questionId: "31", questionType: "open-ended", questionText: "What is the main idea?", userAnswer: "The story is about friendship", correctAnswer: "friendship and loyalty" },
        { questionId: "32-a", questionType: "true-false-sub", questionText: "True or False: The narrator went in the morning.", userAnswer: "True", correctAnswer: "False" },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].questionId).toBe("31");
    expect(result[0].isCorrect).toBe(true);
    expect(result[0].score).toBe(1);
    expect(result[0].feedback).toBeTruthy();
    expect(result[0].explanation).toBeTruthy();
    expect(result[1].questionId).toBe("32-a");
    expect(result[1].isCorrect).toBe(false);
    expect(result[1].explanation).toBeTruthy();
  });
});

describe("grading.evaluateWriting", () => {
  it("returns writing evaluation with annotated essay", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.grading.evaluateWriting({
      essay: "I goed to the park and seen a beautiful bird. It was very nice day.",
      topic: "A Day at the Park",
      wordCountTarget: "80-120 words",
    });

    expect(result.score).toBe(15);
    expect(result.maxScore).toBe(20);
    expect(result.grade).toBe("B");
    expect(result.overallFeedback).toBeTruthy();
    expect(result.grammarErrors).toHaveLength(1);
    expect(result.grammarErrors[0].original).toBe("goed");
    expect(result.grammarErrors[0].correction).toBe("went");
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.correctedEssay).toBeTruthy();
    expect(result.annotatedEssay).toContain("[[ERROR:");
  });

  it("returns empty result for short essays", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.grading.evaluateWriting({
      essay: "Hi",
      topic: "A Day at the Park",
      wordCountTarget: "80-120 words",
    });

    expect(result.score).toBe(0);
    expect(result.grade).toBe("N/A");
    expect(result.annotatedEssay).toBe("");
  });

  it("returns empty result for empty essay", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.grading.evaluateWriting({
      essay: "",
      topic: "Test",
      wordCountTarget: "100 words",
    });

    expect(result.score).toBe(0);
    expect(result.grade).toBe("N/A");
  });
});

describe("grading.explainWrongAnswers", () => {
  it("returns detailed explanations for wrong answers", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.grading.explainWrongAnswers({
      wrongAnswers: [
        { questionId: 1, sectionType: "vocabulary", questionText: "What does 'benevolent' mean?", userAnswer: "angry", correctAnswer: "kind", context: "Vocabulary question" },
        { questionId: 5, sectionType: "grammar", questionText: "Fill in the blank", userAnswer: "go", correctAnswer: "went", context: "Grammar fill-in-the-blank" },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].questionId).toBe(1);
    expect(result[0].explanation).toBeTruthy();
    expect(result[0].tip).toBeTruthy();
    expect(result[1].questionId).toBe(5);
    expect(result[1].explanation).toBeTruthy();
    expect(result[1].tip).toBeTruthy();
  });

  it("returns empty array for no wrong answers", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.grading.explainWrongAnswers({
      wrongAnswers: [],
    });

    expect(result).toEqual([]);
  });
});

describe("grading.generateReport", () => {
  it("returns a comprehensive proficiency report", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.grading.generateReport({
      totalScore: 35,
      totalPossible: 56,
      percentage: 63,
      grade: "C",
      totalTimeSeconds: 1200,
      sectionResults: [
        { sectionId: "listening", sectionTitle: "Part 1: Listening", correct: 4, total: 6, timeSeconds: 180 },
        { sectionId: "vocabulary", sectionTitle: "Part 2: Vocabulary", correct: 14, total: 20, timeSeconds: 300 },
        { sectionId: "grammar", sectionTitle: "Part 3: Grammar", correct: 6, total: 10, timeSeconds: 240 },
        { sectionId: "reading", sectionTitle: "Part 4: Reading", correct: 7, total: 10, timeSeconds: 360 },
      ],
      writingScore: 12,
      writingMaxScore: 20,
      writingGrade: "C",
    });

    expect(result.languageLevel).toBe("A2");
    expect(result.summary).toBeTruthy();
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.weaknesses.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.timeAnalysis).toBeTruthy();
  });

  it("handles report without writing score", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.grading.generateReport({
      totalScore: 20,
      totalPossible: 36,
      percentage: 56,
      grade: "C",
      totalTimeSeconds: 600,
      sectionResults: [
        { sectionId: "listening", sectionTitle: "Part 1: Listening", correct: 3, total: 6, timeSeconds: 120 },
        { sectionId: "vocabulary", sectionTitle: "Part 2: Vocabulary", correct: 10, total: 20, timeSeconds: 200 },
      ],
    });

    expect(result.languageLevel).toBeTruthy();
    expect(result.summary).toBeTruthy();
  });
});
