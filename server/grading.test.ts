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

  it("returns bilingual AI grading results for WIDA reading answers", async () => {
    const mockResponse = {
      results: [
        { questionId: "33", isCorrect: true, score: 1, feedback_en: "Correct!", feedback_cn: "正确！", explanation_en: "Good job selecting the right word.", explanation_cn: "很好地选择了正确的词。" },
        { questionId: "34", isCorrect: false, score: 0, feedback_en: "Incorrect.", feedback_cn: "不正确。", explanation_en: "The correct word from the bank is different.", explanation_cn: "词库中正确的词不同。" },
      ],
    };
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.checkReadingAnswers({
      answers: [
        { questionId: "33", questionType: "wordbank-fill", questionText: "Fill in the blank with the correct word from the word bank.", userAnswer: "dentist", correctAnswer: "dentist" },
        { questionId: "34", questionType: "wordbank-fill", questionText: "Fill in the blank with the correct word.", userAnswer: "nurse", correctAnswer: "doctor" },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].questionId).toBe("33");
    expect(result[0].isCorrect).toBe(true);
    expect(result[0].feedback_en).toBe("Correct!");
    expect(result[0].feedback_cn).toBe("正确！");
    expect(result[0].explanation_en).toBeTruthy();
    expect(result[0].explanation_cn).toBeTruthy();
    expect(result[1].isCorrect).toBe(false);
  });

  it("grades story-fill type questions correctly", async () => {
    const mockResponse = {
      results: [
        { questionId: "38", isCorrect: true, score: 1, feedback_en: "Well done!", feedback_cn: "做得好！", explanation_en: "Correct answer from the story.", explanation_cn: "从故事中选出了正确答案。" },
      ],
    };
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.checkReadingAnswers({
      answers: [
        { questionId: "38", questionType: "story-fill", questionText: "Complete the sentence based on the story.", userAnswer: "happy", correctAnswer: "happy" },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].isCorrect).toBe(true);
    expect(result[0].score).toBe(1);
  });

  it("returns fallback bilingual results on LLM error", async () => {
    mockInvokeLLM.mockRejectedValueOnce(new Error("LLM unavailable"));

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.checkReadingAnswers({
      answers: [
        { questionId: "33", questionType: "wordbank-fill", questionText: "Fill in the blank.", userAnswer: "Nothing", correctAnswer: "Something" },
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

  it("returns bilingual proficiency report for WIDA assessment", async () => {
    const mockResponse = {
      languageLevel: "A2",
      summary_en: "The student shows basic proficiency.", summary_cn: "学生展现了基础水平。",
      strengths_en: ["Good vocabulary recognition"], strengths_cn: ["词汇识别能力不错"],
      weaknesses_en: ["Grammar needs work"], weaknesses_cn: ["语法需要加强"],
      recommendations_en: ["Practice daily"], recommendations_cn: ["每天练习"],
      timeAnalysis_en: "Good pace.", timeAnalysis_cn: "节奏不错。",
      reportTitle_en: "Assessment Feedback Report",
      reportTitle_cn: "测评反馈报告",
      overallSummary_en: "The student has a workable base but still needs stronger grammar and output control.",
      overallSummary_cn: "学生目前有一定基础，但语法和输出能力还需要继续加强。",
      abilitySnapshot_en: ["Input is stronger than output"],
      abilitySnapshot_cn: ["输入能力强于输出能力"],
      sectionInsights: [
        {
          sectionId: "vocabulary",
          sectionTitle: "Part 1: Vocabulary",
          summary_en: "Vocabulary recognition is relatively stable.",
          summary_cn: "词汇识别相对稳定。",
        },
      ],
      studyPlan: [
        {
          stage_en: "Stage 1",
          stage_cn: "第一阶段",
          focus_en: "Build the basics",
          focus_cn: "补基础",
          actions_en: ["Review core grammar."],
          actions_cn: ["复习核心语法。"],
        },
        {
          stage_en: "Stage 2",
          stage_cn: "第二阶段",
          focus_en: "Target weak sections",
          focus_cn: "做专项",
          actions_en: ["Practice reading weekly."],
          actions_cn: ["每周练阅读专项。"],
        },
        {
          stage_en: "Stage 3",
          stage_cn: "第三阶段",
          focus_en: "Return to full papers",
          focus_cn: "整套题训练",
          actions_en: ["Complete timed papers."],
          actions_cn: ["完成限时整套题。"],
        },
      ],
      parentFeedback_en: "There is clear room for improvement with steady practice.",
      parentFeedback_cn: "只要训练方向清晰，后续还有明显提升空间。",
      speakingEvaluation: null,
    };
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    } as any);

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
    expect(result.reportTitle_cn).toBe("测评反馈报告");
    expect(result.overallSummary_cn).toBeTruthy();
    expect(result.abilitySnapshot_cn).toHaveLength(1);
    expect(result.sectionInsights).toHaveLength(1);
    expect(result.studyPlan).toHaveLength(3);
    expect(result.parentFeedback_cn).toBeTruthy();
  });

  it("returns fallback bilingual report on LLM error", async () => {
    mockInvokeLLM.mockRejectedValueOnce(new Error("LLM error"));

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.generateReport({
      paperTitle: "PET English Assessment",
      totalScore: 20, totalPossible: 46, percentage: 43, grade: "D", totalTimeSeconds: 600,
      sectionResults: [
        { sectionId: "vocabulary", sectionTitle: "Part 1: Vocabulary", correct: 8, total: 12, timeSeconds: 120 },
        { sectionId: "grammar", sectionTitle: "Part 2: Grammar", correct: 5, total: 13, timeSeconds: 150 },
        { sectionId: "listening", sectionTitle: "Part 3: Listening", correct: 3, total: 6, timeSeconds: 100 },
        { sectionId: "reading", sectionTitle: "Part 4: Reading", correct: 4, total: 15, timeSeconds: 230 },
      ],
    });

    expect(result.languageLevel).toBe("N/A");
    expect(result.summary_en).toBeTruthy();
    expect(result.summary_cn).toBeTruthy();
    expect(result.reportTitle_en).toBe("Assessment Feedback Report");
    expect(result.studyPlan).toHaveLength(3);
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
