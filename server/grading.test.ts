import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
const mockInvokeLLM = vi.mocked(invokeLLM);
const mockTranscribeAudio = vi.mocked(transcribeAudio);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("grading.checkReadingAnswers", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("checks reading answers locally without calling the LLM", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.checkReadingAnswers({
      answers: [
        { questionId: "33", questionType: "wordbank-fill", questionText: "Fill in the blank with the correct word from the word bank.", userAnswer: "dentist", correctAnswer: "dentist" },
        { questionId: "34", questionType: "wordbank-fill", questionText: "Fill in the blank with the correct word.", userAnswer: "nurse", correctAnswer: "doctor" },
      ],
    });

    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].questionId).toBe("33");
    expect(result[0].isCorrect).toBe(true);
    expect(result[0].feedback_en).toBe("Answer accepted.");
    expect(result[0].feedback_cn).toBe("答案可接受。");
    expect(result[0].explanation_en).toBeTruthy();
    expect(result[0].explanation_cn).toBeTruthy();
    expect(result[1].isCorrect).toBe(false);
  });

  it("accepts slash-separated answer variants for reading comprehension", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.checkReadingAnswers({
      answers: [
        { questionId: "38", questionType: "reference-sub", questionText: "What does it refer to?", userAnswer: "the weather", correctAnswer: "the rain / the weather" },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].isCorrect).toBe(true);
    expect(result[0].score).toBe(1);
  });

  it("compares checkbox-style reading answers without AI", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.checkReadingAnswers({
      answers: [
        { questionId: "44", questionType: "checkbox", questionText: "Choose two items.", userAnswer: "dog, cat", correctAnswer: "cat, dog" },
      ],
    });

    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].isCorrect).toBe(true);
    expect(result[0].score).toBe(1);
  });
});

describe("grading.explainWrongAnswers", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns bilingual explanations for wrong answers", async () => {
    const mockResponse = {
      explanations: [
        { questionId: 1, explanation_en: "The picture shows five items.", explanation_cn: "图片显示了五个物品。", tip_en: "Count the items carefully.", tip_cn: "仔细数物品。" },
      ],
    };
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.explainWrongAnswers({
      wrongAnswers: [
        { questionId: 1, sectionType: "vocabulary", questionText: "How many items are shown?", userAnswer: "four", correctAnswer: "five" },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].explanation_en).toBe("The picture shows five items.");
    expect(result[0].explanation_cn).toBe("图片显示了五个物品。");
    expect(result[0].tip_en).toBe("Count the items carefully.");
    expect(result[0].tip_cn).toBe("仔细数物品。");
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
        { questionId: 5, sectionType: "grammar", questionText: "Choose the correct option", userAnswer: "a", correctAnswer: "b" },
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

  it("builds a deterministic template report without calling the LLM", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.generateReport({
      paperTitle: "PET English Assessment",
      studentName: "Test Student",
      studentGrade: "Grade 6",
      totalScore: 30, totalPossible: 46, percentage: 65, grade: "C", totalTimeSeconds: 1800,
      sectionResults: [
        { sectionId: "vocabulary", sectionTitle: "Part 1: Vocabulary", correct: 10, total: 12, timeSeconds: 300 },
        { sectionId: "grammar", sectionTitle: "Part 2: Grammar", correct: 7, total: 13, timeSeconds: 400 },
        { sectionId: "listening", sectionTitle: "Part 3: Listening", correct: 4, total: 6, timeSeconds: 200 },
        { sectionId: "reading", sectionTitle: "Part 4: Reading", correct: 9, total: 15, timeSeconds: 900 },
      ],
    });

    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(result.languageLevel).toBe("A2");
    expect(result.summary_en).toContain("some English foundation");
    expect(result.summary_cn).toContain("有一定英语基础");
    expect(result.strengths_en.length).toBeGreaterThan(0);
    expect(result.weaknesses_en.length).toBeGreaterThan(0);
    expect(result.recommendations_en).toHaveLength(3);
    expect(result.recommendations_cn).toHaveLength(3);
    expect(result.timeAnalysis_en).toContain("The full assessment took 30 minutes");
    expect(result.timeAnalysis_cn).toContain("本次整套测评总用时 30 分 0 秒");
    expect(result.reportTitle_cn).toBe("测评反馈报告");
    expect(result.overallSummary_cn).toContain("综合等级为 C");
    expect(result.abilitySnapshot_cn.length).toBeGreaterThanOrEqual(3);
    expect(result.sectionInsights).toHaveLength(4);
    expect(result.sectionInsights[0].summary_en).toContain("Vocabulary");
    expect(result.studyPlan).toHaveLength(3);
    expect(result.parentFeedback_cn).toBeTruthy();
    expect(result.speakingEvaluation).toBeNull();
  });

  it("marks writing and speaking as manual review in the template report", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.generateReport({
      paperTitle: "G6 English Assessment",
      studentName: "Manual Student",
      totalScore: 22,
      totalPossible: 40,
      percentage: 55,
      grade: "C",
      totalTimeSeconds: 1200,
      sectionResults: [
        { sectionId: "vocabulary", sectionTitle: "Part 1: Vocabulary", correct: 8, total: 12, timeSeconds: 180 },
        { sectionId: "reading", sectionTitle: "Part 2: Reading", correct: 6, total: 10, timeSeconds: 420 },
        { sectionId: "writing", sectionTitle: "Part 3: Writing", correct: 0, total: 0, timeSeconds: 300 },
        { sectionId: "speaking-part-1", sectionTitle: "Part 4: Speaking", correct: 0, total: 0, timeSeconds: 300 },
      ],
      writingSummary: {
        score: 0,
        maxScore: 0,
        grade: "Manual Review",
        manualReviewRequired: true,
      },
      speakingSummary: {
        totalScore: 0,
        totalPossible: 0,
        grade: "Manual Review",
        overallFeedback_en: "Teacher review required.",
        overallFeedback_cn: "需要老师人工批改。",
        reviewMode: "manual",
        manualReviewRequired: true,
        evaluations: [],
      },
    });

    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(result.languageLevel).toBe("A2");
    expect(result.reportTitle_en).toBe("Assessment Feedback Report");
    expect(result.abilitySnapshot_en).toContain("Writing and speaking should be finalized together with teacher review.");
    expect(result.overallSummary_en).toContain("teacher scoring notes");
    expect(result.sectionInsights.find((item) => item.sectionId === "writing")?.summary_en).toContain("teacher review");
    expect(result.sectionInsights.find((item) => item.sectionId === "speaking-part-1")?.summary_en).toContain("teacher review");
    expect(result.studyPlan).toHaveLength(3);
    expect(result.speakingEvaluation?.reviewMode).toBe("manual");
  });
});

describe("grading.evaluateWriting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a manual-review placeholder without calling the LLM", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateWriting({
      essay: "I went to the park with my sister and we played on the swings after lunch.",
      topic: "A day at the park",
      wordCountTarget: "80-100 words",
    });

    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(result.grade).toBe("Manual Review");
    expect(result.maxScore).toBe(0);
    expect(result.reviewMode).toBe("manual");
    expect(result.manualReviewRequired).toBe(true);
    expect(result.overallFeedback_en).toContain("Automatic writing scoring has been turned off");
  });
});

describe("grading.evaluateSpeaking", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns a manual-review placeholder without calling transcription or the LLM", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateSpeaking({
      responses: [
        {
          sectionId: "speaking-part-4",
          sectionTitle: "Speaking Part 4",
          questionId: 104,
          prompt: "Talk about the special meal in more detail.",
          audioUrl: "https://example.com/audio.webm",
        },
      ],
    });

    expect(mockTranscribeAudio).not.toHaveBeenCalled();
    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(result.totalScore).toBe(0);
    expect(result.totalPossible).toBe(0);
    expect(result.grade).toBe("Manual Review");
    expect(result.reviewMode).toBe("manual");
    expect(result.manualReviewRequired).toBe(true);
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0].reviewMode).toBe("manual");
    expect(result.evaluations[0].manualReviewRequired).toBe(true);
    expect(result.evaluations[0].feedback_en).toContain("Automatic speaking scoring has been turned off");
  });
});
