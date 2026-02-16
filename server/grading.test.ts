import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
const mockInvokeLLM = vi.mocked(invokeLLM);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("grading.checkReadingAnswers", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns bilingual AI grading results for reading answers", async () => {
    const mockResponse = {
      results: [
        { questionId: "31", isCorrect: true, score: 1, feedback_en: "Correct!", feedback_cn: "正确！", explanation_en: "Good job identifying the main idea.", explanation_cn: "很好地识别了主旨。" },
        { questionId: "32-a", isCorrect: false, score: 0, feedback_en: "Incorrect.", feedback_cn: "不正确。", explanation_en: "The passage states the opposite.", explanation_cn: "文章表述相反。" },
      ],
    };
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.checkReadingAnswers({
      answers: [
        { questionId: "31", questionType: "open-ended", questionText: "What is the main idea?", userAnswer: "friendship", correctAnswer: "friendship and loyalty" },
        { questionId: "32-a", questionType: "true-false-sub", questionText: "True or False?", userAnswer: "True", correctAnswer: "False" },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].questionId).toBe("31");
    expect(result[0].isCorrect).toBe(true);
    expect(result[0].feedback_en).toBe("Correct!");
    expect(result[0].feedback_cn).toBe("正确！");
    expect(result[0].explanation_en).toBeTruthy();
    expect(result[0].explanation_cn).toBeTruthy();
    expect(result[1].isCorrect).toBe(false);
  });

  it("returns fallback bilingual results on LLM error", async () => {
    mockInvokeLLM.mockRejectedValueOnce(new Error("LLM unavailable"));

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.checkReadingAnswers({
      answers: [
        { questionId: "33-a", questionType: "open-ended", questionText: "What happened?", userAnswer: "Nothing", correctAnswer: "Something" },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].isCorrect).toBe(false);
    expect(result[0].feedback_en).toBeTruthy();
    expect(result[0].feedback_cn).toBeTruthy();
    expect(result[0].explanation_en).toBeTruthy();
    expect(result[0].explanation_cn).toBeTruthy();
  });
});

describe("grading.evaluateWriting", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns bilingual writing evaluation with annotations", async () => {
    const mockResponse = {
      score: 15, maxScore: 20, grade: "B",
      overallFeedback_en: "Good essay with clear ideas.", overallFeedback_cn: "作文不错，思路清晰。",
      grammarErrors: [{ original: "goed", correction: "went", explanation_en: "Past tense of go is went.", explanation_cn: "go的过去式是went。" }],
      suggestions_en: ["Use more varied vocabulary."], suggestions_cn: ["使用更丰富的词汇。"],
      correctedEssay: "I went to the park.", annotatedEssay: "I [[ERROR:goed||went||Past tense of go is went.]] to the park.",
    };
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateWriting({
      essay: "I goed to the park and played with my friends.", topic: "My Weekend", wordCountTarget: "80-120",
    });

    expect(result.score).toBe(15);
    expect(result.overallFeedback_en).toBe("Good essay with clear ideas.");
    expect(result.overallFeedback_cn).toBe("作文不错，思路清晰。");
    expect(result.grammarErrors).toHaveLength(1);
    expect(result.grammarErrors[0].explanation_en).toBeTruthy();
    expect(result.grammarErrors[0].explanation_cn).toBeTruthy();
    expect(result.suggestions_en).toHaveLength(1);
    expect(result.suggestions_cn).toHaveLength(1);
    expect(result.annotatedEssay).toContain("[[ERROR:");
  });

  it("returns empty bilingual result for too-short essay", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateWriting({
      essay: "Hi", topic: "My Weekend", wordCountTarget: "80-120",
    });
    expect(result.score).toBe(0);
    expect(result.grade).toBe("N/A");
    expect(result.overallFeedback_en).toBeTruthy();
    expect(result.overallFeedback_cn).toBeTruthy();
  });

  it("returns empty result for empty essay", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateWriting({
      essay: "", topic: "Test", wordCountTarget: "100",
    });
    expect(result.score).toBe(0);
    expect(result.grade).toBe("N/A");
  });
});

describe("grading.explainWrongAnswers", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns bilingual explanations for wrong answers", async () => {
    const mockResponse = {
      explanations: [
        { questionId: 1, explanation_en: "The word means kind.", explanation_cn: "这个词的意思是善良。", tip_en: "Remember: bene = good.", tip_cn: "记住：bene = 好。" },
      ],
    };
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.explainWrongAnswers({
      wrongAnswers: [
        { questionId: 1, sectionType: "vocabulary", questionText: "What does 'benevolent' mean?", userAnswer: "angry", correctAnswer: "kind" },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].explanation_en).toBe("The word means kind.");
    expect(result[0].explanation_cn).toBe("这个词的意思是善良。");
    expect(result[0].tip_en).toBe("Remember: bene = good.");
    expect(result[0].tip_cn).toBe("记住：bene = 好。");
  });

  it("returns empty array for no wrong answers", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.explainWrongAnswers({ wrongAnswers: [] });
    expect(result).toEqual([]);
  });

  it("returns fallback bilingual explanations on LLM error", async () => {
    mockInvokeLLM.mockRejectedValueOnce(new Error("LLM error"));

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.explainWrongAnswers({
      wrongAnswers: [
        { questionId: 5, sectionType: "grammar", questionText: "Fill blank", userAnswer: "go", correctAnswer: "went" },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].explanation_en).toBeTruthy();
    expect(result[0].explanation_cn).toBeTruthy();
    expect(result[0].tip_en).toBeTruthy();
    expect(result[0].tip_cn).toBeTruthy();
  });
});

describe("grading.generateReport", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns bilingual proficiency report", async () => {
    const mockResponse = {
      languageLevel: "A2",
      summary_en: "The student shows basic proficiency.", summary_cn: "学生展现了基础水平。",
      strengths_en: ["Good vocabulary"], strengths_cn: ["词汇量不错"],
      weaknesses_en: ["Grammar needs work"], weaknesses_cn: ["语法需要加强"],
      recommendations_en: ["Practice daily"], recommendations_cn: ["每天练习"],
      timeAnalysis_en: "Good pace.", timeAnalysis_cn: "节奏不错。",
    };
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.generateReport({
      totalScore: 30, totalPossible: 50, percentage: 60, grade: "C", totalTimeSeconds: 1800,
      sectionResults: [
        { sectionId: "listening", sectionTitle: "Part 1: Listening", correct: 4, total: 6, timeSeconds: 300 },
      ],
    });

    expect(result.languageLevel).toBe("A2");
    expect(result.summary_en).toBeTruthy();
    expect(result.summary_cn).toBeTruthy();
    expect(result.strengths_en).toHaveLength(1);
    expect(result.strengths_cn).toHaveLength(1);
    expect(result.weaknesses_en).toHaveLength(1);
    expect(result.weaknesses_cn).toHaveLength(1);
    expect(result.recommendations_en).toHaveLength(1);
    expect(result.recommendations_cn).toHaveLength(1);
    expect(result.timeAnalysis_en).toBeTruthy();
    expect(result.timeAnalysis_cn).toBeTruthy();
  });

  it("returns fallback bilingual report on LLM error", async () => {
    mockInvokeLLM.mockRejectedValueOnce(new Error("LLM error"));

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.generateReport({
      totalScore: 20, totalPossible: 36, percentage: 56, grade: "C", totalTimeSeconds: 600,
      sectionResults: [
        { sectionId: "listening", sectionTitle: "Part 1: Listening", correct: 3, total: 6, timeSeconds: 120 },
      ],
    });

    expect(result.languageLevel).toBe("N/A");
    expect(result.summary_en).toBeTruthy();
    expect(result.summary_cn).toBeTruthy();
  });
});
