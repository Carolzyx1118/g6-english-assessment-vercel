import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { saveTestResult, getAllTestResults, getTestResultById, updateTestResultAI, deleteTestResult } from "./db";
import { paperRouter } from "./paperRouter";
import { localAuthRouter } from "./localAuthRouter";
import { buildTemplateAssessmentReport } from "./reportTemplateBuilder";
import type {
  SpeakingEvaluationResult,
  SpeakingQuestionEvaluation,
} from "../shared/assessmentReport";

function normalizeReadingText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingArticle(value: string) {
  return value.replace(/^(a|an|the)\s+/i, "").trim();
}

function getReadingAcceptableAnswers(correctAnswer: string) {
  return correctAnswer
    .split(/\s*\/\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compareReadingLists(userAnswer: string, correctAnswer: string) {
  const normalizeList = (value: string) =>
    value
      .split(",")
      .map((item) => normalizeReadingText(item))
      .filter(Boolean)
      .sort();

  const user = normalizeList(userAnswer);
  const correct = normalizeList(correctAnswer);
  return user.length > 0 && JSON.stringify(user) === JSON.stringify(correct);
}

function isEquivalentReadingPhrase(userAnswer: string, expectedAnswer: string) {
  const user = normalizeReadingText(userAnswer);
  const expected = normalizeReadingText(expectedAnswer);
  if (!user || !expected) return false;
  if (user === expected) return true;

  const userNoArticle = stripLeadingArticle(user);
  const expectedNoArticle = stripLeadingArticle(expected);
  if (userNoArticle === expectedNoArticle) return true;

  const userTokens = userNoArticle.split(" ").filter(Boolean);
  const expectedTokens = expectedNoArticle.split(" ").filter(Boolean);

  if (userTokens.length === 1 && userTokens[0].length >= 4 && expectedTokens.includes(userTokens[0])) {
    return true;
  }
  if (expectedTokens.length === 1 && expectedTokens[0].length >= 4 && userTokens.includes(expectedTokens[0])) {
    return true;
  }

  return false;
}

function gradeReadingAnswer(answer: {
  questionId: string;
  questionType: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
}) {
  const userAnswer = answer.userAnswer.trim();
  const correctAnswer = answer.correctAnswer.trim();
  const acceptableAnswers = getReadingAcceptableAnswers(correctAnswer);
  const isAnswered = userAnswer.length > 0 && userAnswer.toLowerCase() !== "not answered";

  let isCorrect = false;
  if (isAnswered) {
    if (answer.questionType === "checkbox") {
      isCorrect = compareReadingLists(userAnswer, correctAnswer);
    } else {
      isCorrect = acceptableAnswers.some((item) => isEquivalentReadingPhrase(userAnswer, item));
    }
  }

  return {
    questionId: answer.questionId,
    isCorrect,
    score: isCorrect ? 1 : 0,
    feedback_en: isCorrect ? "Answer accepted." : "Answer does not match the answer key.",
    feedback_cn: isCorrect ? "答案可接受。" : "答案与参考答案不一致。",
    explanation_en: isCorrect
      ? `Accepted answer: ${correctAnswer}.`
      : `Expected answer: ${correctAnswer}. If the wording is acceptable but different from the key, please review it manually.`,
    explanation_cn: isCorrect
      ? `参考答案：${correctAnswer}。`
      : `参考答案：${correctAnswer}。如果学生表达意思正确但与答案写法不同，请人工复核。`,
  };
}

function buildManualWritingEvaluation(input: {
  essay: string;
  topic: string;
  wordCountTarget: string;
}) {
  const hasEssay = input.essay.trim().length > 0;

  if (!hasEssay) {
    return {
      score: 0,
      maxScore: 0,
      grade: "No Submission",
      overallFeedback_en:
        "No writing response was submitted. This section is left for teacher review and is not included in the automatic score.",
      overallFeedback_cn:
        "本次未提交作文作答。该部分将留给老师人工批改，且不会计入自动分数。",
      grammarErrors: [],
      suggestions_en: [],
      suggestions_cn: [],
      correctedEssay: "",
      annotatedEssay: "",
      reviewMode: "manual" as const,
      manualReviewRequired: false,
    };
  }

  return {
    score: 0,
    maxScore: 0,
    grade: "Manual Review",
    overallFeedback_en:
      "Automatic writing scoring has been turned off for this site. A teacher should review this essay manually for content, language accuracy, organization, and vocabulary. This section is not included in the automatic score.",
    overallFeedback_cn:
      "本网站已关闭作文自动评分。该作文需要老师从内容完成度、语言准确性、结构组织和词汇使用等方面进行人工批改。本部分不会计入自动分数。",
    grammarErrors: [],
    suggestions_en: [
      `Review whether the response fully addresses the prompt: ${input.topic}.`,
      `Check organization, sentence accuracy, and vocabulary against the target length (${input.wordCountTarget}).`,
      "Add a teacher score and comments after manual review.",
    ],
    suggestions_cn: [
      `先检查学生是否完整回应了题目要求：${input.topic}。`,
      `再对照目标字数（${input.wordCountTarget}）检查结构、语法准确性和词汇使用。`,
      "老师人工批改后补充分数和评语。",
    ],
    correctedEssay: "",
    annotatedEssay: "",
    reviewMode: "manual" as const,
    manualReviewRequired: true,
  };
}

function buildManualSpeakingEvaluation(
  responses: Array<{
    sectionId: string;
    sectionTitle: string;
    questionId: number;
    prompt: string;
    audioUrl: string;
  }>
): SpeakingEvaluationResult {
  const evaluations: SpeakingQuestionEvaluation[] = responses.map((response) => ({
    sectionId: response.sectionId,
    sectionTitle: response.sectionTitle,
    questionId: response.questionId,
    prompt: response.prompt,
    audioUrl: response.audioUrl,
    transcript: "",
    score: 0,
    maxScore: 0,
    grade: "Manual Review",
    feedback_en:
      "Automatic speaking scoring has been turned off for this site. The teacher should review the original recording manually for task completion, fluency, vocabulary, grammar, and pronunciation.",
    feedback_cn:
      "本网站已关闭口语自动评分。老师需要结合原始录音，从任务完成度、流利度、词汇、语法和发音等方面进行人工批改。",
    taskCompletion_en: "Teacher review is required for this speaking response.",
    taskCompletion_cn: "这道口语题需要老师人工批改。",
    fluency_en: "Please judge fluency from the original recording.",
    fluency_cn: "请结合原始录音判断流利度。",
    vocabulary_en: "Please review vocabulary use manually.",
    vocabulary_cn: "请人工判断词汇使用情况。",
    grammar_en: "Please review grammar control manually.",
    grammar_cn: "请人工判断语法使用情况。",
    pronunciation_en: "Please review pronunciation from the original audio.",
    pronunciation_cn: "请结合原始录音判断发音情况。",
    suggestions_en: [
      "Listen to the original recording before scoring.",
      "Add a teacher score and comments after manual review.",
    ],
    suggestions_cn: [
      "评分前请先听原始录音。",
      "老师人工批改后补充分数和评语。",
    ],
    reviewMode: "manual",
    manualReviewRequired: true,
  }));

  return {
    totalScore: 0,
    totalPossible: 0,
    grade: "Manual Review",
    overallFeedback_en:
      evaluations.length > 0
        ? "Automatic speaking scoring has been turned off for this site. Teacher review is required for all submitted speaking recordings, and speaking is excluded from the automatic score."
        : "No speaking responses were submitted.",
    overallFeedback_cn:
      evaluations.length > 0
        ? "本网站已关闭口语自动评分。所有已提交的口语录音都需要老师人工批改，且口语部分不会计入自动总分。"
        : "未提交口语作答。",
    evaluations,
    reviewMode: "manual",
    manualReviewRequired: evaluations.length > 0,
  };
}

export const appRouter = router({
  system: systemRouter,
  papers: paperRouter,
  localAuth: localAuthRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      (ctx.res as any).clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),

  grading: router({
    // Rule-based reading comprehension checking without AI
    checkReadingAnswers: publicProcedure
      .input(z.object({
        answers: z.array(z.object({
          questionId: z.string(),
          questionType: z.string(),
          questionText: z.string(),
          userAnswer: z.string(),
          correctAnswer: z.string(),
        })),
      }))
      .mutation(async ({ input }) => input.answers.map(gradeReadingAnswer)),

    // AI-powered writing evaluation with bilingual inline annotations
    evaluateWriting: publicProcedure
      .input(z.object({
        essay: z.string(),
        topic: z.string(),
        wordCountTarget: z.string(),
      }))
      .mutation(async ({ input }) => {
        return buildManualWritingEvaluation(input);
      }),

    evaluateSpeaking: publicProcedure
      .input(z.object({
        responses: z.array(z.object({
          sectionId: z.string(),
          sectionTitle: z.string(),
          questionId: z.number(),
          prompt: z.string(),
          audioUrl: z.string().url(),
        })).min(1),
      }))
      .mutation(async ({ input }) => {
        return buildManualSpeakingEvaluation(input.responses);
      }),

    // Generate bilingual explanations for wrong answers
    explainWrongAnswers: publicProcedure
      .input(z.object({
        wrongAnswers: z.array(z.object({
          questionId: z.number(),
          sectionType: z.string(),
          questionText: z.string(),
          userAnswer: z.string(),
          correctAnswer: z.string(),
          context: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        if (input.wrongAnswers.length === 0) return [];

        const prompt = `You are an English teacher providing detailed explanations for a student's wrong answers on a WIDA English Proficiency Assessment.
For each wrong answer, provide explanations in BOTH English and Chinese:
- explanation_en: Why the answer is wrong and why the correct answer is right (English)
- explanation_cn: Same explanation in Chinese
- tip_en: A helpful tip or rule to remember (English)
- tip_cn: Same tip in Chinese

Questions:
${input.wrongAnswers.map((a, i) => `
${i + 1}. [Q${a.questionId}] Section: ${a.sectionType}
   Question: ${a.questionText}
   ${a.context ? `Context: ${a.context}` : ''}
   Student's Answer: ${a.userAnswer}
   Correct Answer: ${a.correctAnswer}
`).join('\n')}

Respond in JSON format:
{
  "explanations": [
    { "questionId": <number>, "explanation_en": "<string>", "explanation_cn": "<string>", "tip_en": "<string>", "tip_cn": "<string>" }
  ]
}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a patient and encouraging English teacher. Provide clear, educational explanations in both English and Chinese. Always respond with valid JSON." },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "answer_explanations",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    explanations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          questionId: { type: "number" },
                          explanation_en: { type: "string" },
                          explanation_cn: { type: "string" },
                          tip_en: { type: "string" },
                          tip_cn: { type: "string" },
                        },
                        required: ["questionId", "explanation_en", "explanation_cn", "tip_en", "tip_cn"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["explanations"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (typeof content === 'string') {
            const parsed = JSON.parse(content);
            return parsed.explanations as { questionId: number; explanation_en: string; explanation_cn: string; tip_en: string; tip_cn: string }[];
          }
        } catch (err) {
          console.error("AI explanation error:", err);
        }

        return input.wrongAnswers.map(a => ({
          questionId: a.questionId,
          explanation_en: "Unable to generate explanation.",
          explanation_cn: "无法生成解释。",
          tip_en: "Review the question carefully.",
          tip_cn: "请仔细复习这道题。",
        }));
      }),

    // Generate bilingual proficiency report
    generateReport: publicProcedure
      .input(z.object({
        paperTitle: z.string(),
        studentName: z.string().optional(),
        studentGrade: z.string().optional(),
        totalScore: z.number(),
        totalPossible: z.number(),
        percentage: z.number(),
        grade: z.string(),
        totalTimeSeconds: z.number(),
        sectionResults: z.array(z.object({
          sectionId: z.string(),
          sectionTitle: z.string(),
          correct: z.number(),
          total: z.number(),
          timeSeconds: z.number(),
        })),
        writingSummary: z.object({
          score: z.number(),
          maxScore: z.number(),
          grade: z.string(),
          overallFeedback_en: z.string().optional(),
          overallFeedback_cn: z.string().optional(),
          suggestions_en: z.array(z.string()).optional(),
          suggestions_cn: z.array(z.string()).optional(),
          manualReviewRequired: z.boolean().optional(),
        }).optional(),
        speakingSummary: z.object({
          totalScore: z.number(),
          totalPossible: z.number(),
          grade: z.string(),
          overallFeedback_en: z.string(),
          overallFeedback_cn: z.string(),
          reviewMode: z.enum(["ai", "manual"]).optional(),
          manualReviewRequired: z.boolean().optional(),
          evaluations: z.array(z.object({
            sectionId: z.string(),
            sectionTitle: z.string(),
            questionId: z.number(),
            prompt: z.string(),
            audioUrl: z.string(),
            transcript: z.string(),
            score: z.number(),
            maxScore: z.number(),
            grade: z.string(),
            feedback_en: z.string(),
            feedback_cn: z.string(),
            taskCompletion_en: z.string(),
            taskCompletion_cn: z.string(),
            fluency_en: z.string(),
            fluency_cn: z.string(),
            vocabulary_en: z.string(),
            vocabulary_cn: z.string(),
            grammar_en: z.string(),
            grammar_cn: z.string(),
            pronunciation_en: z.string(),
            pronunciation_cn: z.string(),
            suggestions_en: z.array(z.string()),
            suggestions_cn: z.array(z.string()),
            reviewMode: z.enum(["ai", "manual"]).optional(),
            manualReviewRequired: z.boolean().optional(),
          })),
        }).optional(),
      }))
      .mutation(({ input }) => buildTemplateAssessmentReport(input)),
   }),

  // Test results CRUD
  results: router({
    save: publicProcedure
      .input(z.object({
        studentName: z.string(),
        studentGrade: z.string().optional(),
        paperId: z.string(),
        paperTitle: z.string(),
        totalCorrect: z.number(),
        totalQuestions: z.number(),
        totalTimeSeconds: z.number().optional(),
        answersJson: z.string(),
        scoreBySectionJson: z.string().optional(),
        sectionTimingsJson: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await saveTestResult({
          studentName: input.studentName,
          studentGrade: input.studentGrade || null,
          paperId: input.paperId,
          paperTitle: input.paperTitle,
          totalCorrect: input.totalCorrect,
          totalQuestions: input.totalQuestions,
          totalTimeSeconds: input.totalTimeSeconds || null,
          answersJson: input.answersJson,
          scoreBySectionJson: input.scoreBySectionJson || null,
          sectionTimingsJson: input.sectionTimingsJson || null,
        });
        return { id };
      }),

    updateAI: publicProcedure
      .input(z.object({
        id: z.number(),
        readingResultsJson: z.string().optional(),
        writingResultJson: z.string().optional(),
        explanationsJson: z.string().optional(),
        reportJson: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const cleanUpdates: Record<string, string> = {};
        if (updates.readingResultsJson) cleanUpdates.readingResultsJson = updates.readingResultsJson;
        if (updates.writingResultJson) cleanUpdates.writingResultJson = updates.writingResultJson;
        if (updates.explanationsJson) cleanUpdates.explanationsJson = updates.explanationsJson;
        if (updates.reportJson) cleanUpdates.reportJson = updates.reportJson;
        await updateTestResultAI(id, cleanUpdates);
        return { success: true };
      }),

    list: publicProcedure.query(async () => {
      const results = await getAllTestResults();
      return results.map(r => ({
        id: r.id,
        studentName: r.studentName,
        studentGrade: r.studentGrade,
        paperId: r.paperId,
        paperTitle: r.paperTitle,
        totalCorrect: r.totalCorrect,
        totalQuestions: r.totalQuestions,
        totalTimeSeconds: r.totalTimeSeconds,
        createdAt: r.createdAt,
        hasReport: !!r.reportJson,
        hasReadingResults: !!r.readingResultsJson,
        hasWritingResult: !!r.writingResultJson,
      }));
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const result = await getTestResultById(input.id);
        if (!result) return null;
        return result;
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTestResult(input.id);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
