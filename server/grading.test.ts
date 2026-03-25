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

vi.mock("./_core/env", async () => {
  const actual = await vi.importActual<typeof import("./_core/env")>("./_core/env");
  return {
    ...actual,
    ENV: {
      ...actual.ENV,
      aiGatewayApiKey: "",
      aiGatewayBaseUrl: "",
      aiGatewayModel: "",
      aiGatewaySpeakingModel: "",
      openaiApiBaseUrl: "",
      openaiApiKey: "",
      openaiChatModel: "",
      openaiTranscriptionModel: "",
      forgeApiUrl: "",
      forgeApiKey: "",
      blobReadWriteToken: "",
    },
  };
});

import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { ENV } from "./_core/env";
const mockInvokeLLM = vi.mocked(invokeLLM);
const mockTranscribeAudio = vi.mocked(transcribeAudio);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: { host: "example.com" } } as TrpcContext["req"],
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

  it("uses AI grading for open-ended reading answers such as passage open-ended items", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              results: [
                {
                  questionId: "52",
                  isCorrect: true,
                  feedback_en: "The answer matches the main idea.",
                  feedback_cn: "答案抓住了主要意思。",
                  explanation_en: "The student's wording is different, but it conveys the same meaning as the reference answer.",
                  explanation_cn: "学生的表述虽然不同，但意思和参考答案一致。",
                },
              ],
            }),
          },
        },
      ],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.checkReadingAnswers({
      answers: [
        {
          questionId: "52",
          questionType: "open-ended",
          questionText: "What is the passage mainly about?",
          userAnswer: "It talks about why daily exercise is important.",
          correctAnswer: "The passage is about the importance of exercise.",
          context: "Passage: Exercise helps children stay healthy and energetic.",
        },
      ],
    });

    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].isCorrect).toBe(true);
    expect(result[0].score).toBe(1);
    expect(result[0].feedback_en).toContain("main idea");
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
  beforeEach(() => {
    vi.clearAllMocks();
    ENV.aiGatewayApiKey = "";
    ENV.openaiApiKey = "";
    ENV.forgeApiKey = "";
  });

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
    expect(result.reportTitle_en).toBe("Assessment Feedback Report");
    expect(result.abilitySnapshot_en).toContain("Writing and speaking should be finalized together with teacher review.");
    expect(result.overallSummary_en).toContain("teacher scoring notes");
    expect(result.sectionInsights.find((item) => item.sectionId === "writing")?.summary_en).toContain("teacher review");
    expect(result.sectionInsights.find((item) => item.sectionId === "speaking-part-1")?.summary_en).toContain("teacher review");
    expect(result.studyPlan).toHaveLength(3);
    expect(result.speakingEvaluation?.reviewMode).toBe("manual");
  });

  it("uses AI to rewrite the report when an LLM provider is configured", async () => {
    ENV.aiGatewayApiKey = "test-gateway-key";
    mockInvokeLLM.mockResolvedValueOnce({
      id: "chatcmpl-report",
      created: 123,
      model: "openai/gpt-4o-mini",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify({
              summary_en: "The student can manage core tasks but still needs steadier control in weaker sections.",
              summary_cn: "学生已经能完成核心任务，但薄弱部分仍需要更稳定的控制能力。",
              strengths_en: ["Reading accuracy is the clearest current strength.", "The student can already follow familiar task patterns."],
              strengths_cn: ["阅读正确率是目前最明显的优势。", "学生已经能跟上熟悉的题型要求。"],
              weaknesses_en: ["Grammar accuracy still breaks down under pressure.", "Output tasks need more structure and control."],
              weaknesses_cn: ["在压力下语法准确性仍会下降。", "输出类任务还需要更好的结构和控制。"],
              recommendations_en: ["Review sentence control daily.", "Practice short timed output tasks.", "Keep reading correction focused and consistent."],
              recommendations_cn: ["每天复习句子控制。", "练习限时的短输出任务。", "保持阅读订正的针对性和连续性。"],
              timeAnalysis_en: "The paper took 30 minutes in total. Reading used the most time, which suggests the student needs faster locating and checking.",
              timeAnalysis_cn: "整套试卷共用时 30 分钟。阅读部分耗时最多，说明学生需要更快的定位和检查能力。",
              reportTitle_en: "Assessment Feedback Report",
              reportTitle_cn: "测评反馈报告",
              overallSummary_en: "This result shows a workable foundation. The student is not starting from zero, but stronger and weaker parts are still clearly separated.",
              overallSummary_cn: "这次结果说明学生已经有可用基础，但强项和弱项之间的差距仍然比较明显。",
              abilitySnapshot_en: ["The foundation is usable.", "Reading is ahead of output.", "Consistency is the next target."],
              abilitySnapshot_cn: ["基础可以使用。", "阅读强于输出。", "下一步目标是稳定性。"],
              sectionInsights: [
                {
                  sectionId: "vocabulary",
                  sectionTitle: "Part 1: Vocabulary",
                  summary_en: "Vocabulary was handled with reasonable confidence, but precision should still be strengthened.",
                  summary_cn: "词汇部分完成得比较有把握，但准确度还需要继续加强。",
                },
                {
                  sectionId: "reading",
                  sectionTitle: "Part 2: Reading",
                  summary_en: "Reading is the strongest current section, although speed and checking can still improve.",
                  summary_cn: "阅读是当前表现最好的部分，但速度和检查习惯还可以继续提升。",
                },
              ],
              studyPlan: [
                {
                  stage_en: "Stage 1",
                  stage_cn: "第一阶段",
                  focus_en: "Stabilize accuracy",
                  focus_cn: "先稳定准确率",
                  actions_en: ["Correct 5 mistakes daily", "Review key grammar patterns"],
                  actions_cn: ["每天订正 5 个错误", "复习核心语法模式"],
                },
                {
                  stage_en: "Stage 2",
                  stage_cn: "第二阶段",
                  focus_en: "Improve output",
                  focus_cn: "加强输出能力",
                  actions_en: ["Practice short writing responses", "Answer speaking prompts in full sentences"],
                  actions_cn: ["练习简短写作回应", "用完整句回答口语题"],
                },
                {
                  stage_en: "Stage 3",
                  stage_cn: "第三阶段",
                  focus_en: "Build speed and consistency",
                  focus_cn: "建立速度与稳定性",
                  actions_en: ["Use timed mixed practice", "Track repeated error types"],
                  actions_cn: ["做限时混合练习", "记录重复错误类型"],
                },
              ],
              parentFeedback_en: "The student has a real base to build on. Progress now depends on targeted correction instead of broad repetitive practice.",
              parentFeedback_cn: "孩子已经有真实基础，后续提升更依赖有针对性的纠正训练，而不是泛泛地重复刷题。",
            }),
          },
        },
      ],
    });

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.generateReport({
      paperTitle: "KET Unit 1 Practice",
      studentName: "Amy",
      studentGrade: "Grade 6",
      totalScore: 22,
      totalPossible: 32,
      percentage: 69,
      grade: "C",
      totalTimeSeconds: 1800,
      sectionResults: [
        { sectionId: "vocabulary", sectionTitle: "Part 1: Vocabulary", correct: 8, total: 10, timeSeconds: 300 },
        { sectionId: "reading", sectionTitle: "Part 2: Reading", correct: 14, total: 22, timeSeconds: 900 },
      ],
    });

    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(result.overallSummary_en).toContain("workable foundation");
    expect(result.timeAnalysis_cn).toContain("30 分钟");
    expect(result.sectionInsights).toHaveLength(2);
    expect(result.sectionInsights[0].sectionId).toBe("vocabulary");
    expect(result.sectionInsights[1].sectionId).toBe("reading");
    expect(result.parentFeedback_en).toContain("targeted correction");
    expect(result.speakingEvaluation).toBeNull();
  });
});

describe("grading.evaluateWriting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an AI writing evaluation when the gateway responds", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 16,
              overallFeedback_en: "The essay answers the prompt clearly with a logical structure.",
              overallFeedback_cn: "这篇作文能够回应题目，结构也比较清楚。",
              correctedEssay: "I went to the park with my sister, and we played on the swings after lunch.",
              annotatedEssay: "I [ERR:goed|COR:went|EXP:Use the past tense form of go] to the park.",
              grammarErrors: [
                {
                  original: "goed",
                  correction: "went",
                  explanation_en: "Use the irregular past tense form.",
                  explanation_cn: "这里要用 go 的不规则过去式。",
                },
              ],
              suggestions_en: ["Add more supporting details.", "Check verb tense carefully."],
              suggestions_cn: ["补充更多细节。", "注意检查动词时态。"],
            }),
          },
        },
      ],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateWriting({
      essay: "I went to the park with my sister and we played on the swings after lunch.",
      topic: "A day at the park",
      wordCountTarget: "80-100 words",
    });

    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(result.score).toBe(16);
    expect(result.maxScore).toBe(20);
    expect(result.grade).toBe("B");
    expect(result.reviewMode).toBe("ai");
    expect(result.manualReviewRequired).toBe(false);
    expect(result.correctedEssay).toContain("went to the park");
    expect(result.grammarErrors).toHaveLength(1);
    expect(result.suggestions_en).toContain("Add more supporting details.");
  });

  it("falls back to an automatic unavailable state when writing evaluation fails", async () => {
    mockInvokeLLM.mockRejectedValueOnce(new Error("LLM unavailable"));

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateWriting({
      essay: "I went to the park with my sister and we played on the swings after lunch.",
      topic: "A day at the park",
      wordCountTarget: "80-100 words",
    });

    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(result.grade).toBe("AI Unavailable");
    expect(result.maxScore).toBe(0);
    expect(result.reviewMode).toBe("ai");
    expect(result.manualReviewRequired).toBe(false);
    expect(result.overallFeedback_en).toContain("could not be completed");
  });
});

describe("grading.evaluateSpeaking", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("transcribes and evaluates speaking with AI", async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      text: "I like this meal because it is healthy and my family cooks it every weekend.",
    } as any);
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              overallFeedback_en: "The student gave a relevant and mostly clear response.",
              overallFeedback_cn: "学生的回答切题，整体比较清楚。",
              evaluations: [
                {
                  sectionId: "speaking-part-4",
                  questionId: 104,
                  transcript: "I like this meal because it is healthy and my family cooks it every weekend.",
                  score: 4,
                  feedback_en: "The answer is relevant and easy to follow.",
                  feedback_cn: "回答切题，也比较容易理解。",
                  taskCompletion_en: "The prompt was answered directly.",
                  taskCompletion_cn: "能够直接回应题目。",
                  fluency_en: "The response flows fairly smoothly.",
                  fluency_cn: "整体表达比较流畅。",
                  vocabulary_en: "Vocabulary is simple but appropriate.",
                  vocabulary_cn: "词汇较基础，但使用恰当。",
                  grammar_en: "Most sentence patterns are controlled well.",
                  grammar_cn: "大部分句子结构控制得不错。",
                  pronunciation_en: "Clarity appears generally good from the transcript evidence.",
                  pronunciation_cn: "从转写结果看，表达清晰度整体较好。",
                  suggestions_en: ["Add one more supporting detail."],
                  suggestions_cn: ["可以再补充一个支持细节。"],
                },
              ],
            }),
          },
        },
      ],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateSpeaking({
      responses: [
        {
          sectionId: "speaking-part-4",
          sectionTitle: "Speaking Part 4",
          questionId: 104,
          prompt: "Talk about the special meal in more detail.",
          audioUrl: "/api/blob?key=sample-speaking",
        },
      ],
    });

    expect(mockTranscribeAudio).toHaveBeenCalledTimes(1);
    expect(mockTranscribeAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        audioUrl: "https://example.com/api/blob?key=sample-speaking",
        language: "en",
      }),
    );
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(result.totalScore).toBe(4);
    expect(result.totalPossible).toBe(5);
    expect(result.grade).toBe("B");
    expect(result.reviewMode).toBe("ai");
    expect(result.manualReviewRequired).toBe(false);
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0].reviewMode).toBe("ai");
    expect(result.evaluations[0].manualReviewRequired).toBe(false);
    expect(result.evaluations[0].feedback_en).toContain("easy to follow");
    expect(result.evaluations[0].audioUrl).toBe("/api/blob?key=sample-speaking");
  });

  it("falls back to an automatic unavailable state when transcription fails", async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      error: "Voice transcription failed",
      code: "TRANSCRIPTION_FAILED",
      details: "temporary outage",
    } as any);

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

    expect(mockTranscribeAudio).toHaveBeenCalledTimes(1);
    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(result.totalScore).toBe(0);
    expect(result.totalPossible).toBe(0);
    expect(result.grade).toBe("AI Unavailable");
    expect(result.reviewMode).toBe("ai");
    expect(result.manualReviewRequired).toBe(false);
    expect(result.overallFeedback_en).toContain("could not be completed");
  });
});
