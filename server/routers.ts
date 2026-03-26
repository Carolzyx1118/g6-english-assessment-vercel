import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { transcribeAudio } from "./_core/voiceTranscription";
import { z } from "zod";
import { saveTestResult, getAllTestResults, getTestResultById, updateTestResultAI, deleteTestResult } from "./db";
import { paperRouter } from "./paperRouter";
import { localAuthRouter } from "./localAuthRouter";
import { buildTemplateAssessmentReport } from "./reportTemplateBuilder";
import type {
  AssessmentReportResult,
  SpeakingEvaluationResult,
  SpeakingQuestionEvaluation,
} from "../shared/assessmentReport";
import type { TrpcContext } from "./_core/context";

type ResultPaperSubject = "english" | "math" | "vocabulary";
type WritingEvaluationResult = {
  score: number;
  maxScore: number;
  grade: string;
  overallFeedback_en: string;
  overallFeedback_cn: string;
  grammarErrors: Array<{
    original: string;
    correction: string;
    explanation_en: string;
    explanation_cn: string;
  }>;
  suggestions_en: string[];
  suggestions_cn: string[];
  correctedEssay: string;
  annotatedEssay: string;
  reviewMode?: "ai" | "manual";
  manualReviewRequired?: boolean;
};

type ReadingCheckResult = {
  questionId: string;
  isCorrect: boolean;
  score: number;
  feedback_en: string;
  feedback_cn: string;
  explanation_en: string;
  explanation_cn: string;
  referenceAnswer?: string;
};

const AI_WRITING_MAX_SCORE = 20;
const AI_SPEAKING_MAX_SCORE = 5;
const MAX_GATEWAY_AUDIO_BYTES = 16 * 1024 * 1024;
const EMBEDDED_DATA_URL_PREFIX = "data:";
type SpeakingResponseInput = {
  sectionId: string;
  sectionTitle: string;
  questionId: number;
  prompt: string;
  audioUrl: string;
};

function isPaperSubjectValue(value: unknown): value is ResultPaperSubject {
  return value === "english" || value === "math" || value === "vocabulary";
}

function getGeneratedPaperSubjectFromPaperId(paperId: string | null | undefined): ResultPaperSubject | null {
  if (!paperId) return null;
  const match = /^tag-system-(english|math|vocabulary)-/i.exec(paperId.trim());
  if (!match) return null;

  const subject = match[1]?.toLowerCase();
  return isPaperSubjectValue(subject) ? subject : null;
}

function extractStoredPaperSnapshot(raw: string | null | undefined) {
  if (!raw) {
    return {
      paperId: null as string | null,
      paperTitle: null as string | null,
      paperSubject: null as ResultPaperSubject | null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        paperId: null as string | null,
        paperTitle: null as string | null,
        paperSubject: null as ResultPaperSubject | null,
      };
    }

    const payload = parsed as { __format?: string; paperSnapshot?: unknown };
    if (payload.__format !== "assessment_payload_v2" || !payload.paperSnapshot || typeof payload.paperSnapshot !== "object") {
      return {
        paperId: null as string | null,
        paperTitle: null as string | null,
        paperSubject: null as ResultPaperSubject | null,
      };
    }

    const snapshot = payload.paperSnapshot as {
      id?: unknown;
      title?: unknown;
      subject?: unknown;
    };

    return {
      paperId: typeof snapshot.id === "string" && snapshot.id.trim().length > 0 ? snapshot.id.trim() : null,
      paperTitle: typeof snapshot.title === "string" && snapshot.title.trim().length > 0 ? snapshot.title.trim() : null,
      paperSubject: isPaperSubjectValue(snapshot.subject) ? snapshot.subject : null,
    };
  } catch {
    return {
      paperId: null as string | null,
      paperTitle: null as string | null,
      paperSubject: null as ResultPaperSubject | null,
    };
  }
}

function sanitizeValueForResultStorage(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim().toLowerCase().startsWith(EMBEDDED_DATA_URL_PREFIX) ? "" : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValueForResultStorage(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        sanitizeValueForResultStorage(nestedValue),
      ]),
    );
  }

  return value;
}

function sanitizeJsonStringForResultStorage(raw: string | undefined) {
  if (!raw) return raw;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(sanitizeValueForResultStorage(parsed));
  } catch {
    return raw;
  }
}

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
  context?: string;
}) {
  const userAnswer = answer.userAnswer.trim();
  const correctAnswer = answer.correctAnswer.trim();
  const acceptableAnswers = getReadingAcceptableAnswers(correctAnswer);
  const isAnswered = userAnswer.length > 0 && userAnswer.toLowerCase() !== "not answered";

  if ((answer.questionType === "open-ended" || answer.questionType === "open-ended-sub") && correctAnswer.length === 0) {
    return {
      questionId: answer.questionId,
      isCorrect: false,
      score: 0,
      feedback_en: isAnswered
        ? "Automatic grading needs an AI-generated reference answer for this response."
        : "No answer was submitted.",
      feedback_cn: isAnswered
        ? "这道开放题需要先由 AI 生成参考答案后再评分。"
        : "本题未作答。",
      explanation_en: isAnswered
        ? "A reference answer was not saved with this question, so fallback grading cannot judge the response without AI."
        : "No answer was submitted for this open-ended question.",
      explanation_cn: isAnswered
        ? "这道题没有保存参考答案，因此在没有 AI 参考答案的情况下，兜底评分无法判断作答是否正确。"
        : "这道开放题本次没有提交答案。",
      referenceAnswer: "AI reference answer unavailable.",
    } satisfies ReadingCheckResult;
  }

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
      : `Expected answer: ${correctAnswer}. The current response was not recognized as semantically equivalent to the reference answer.`,
    explanation_cn: isCorrect
      ? `参考答案：${correctAnswer}。`
      : `参考答案：${correctAnswer}。系统当前未识别该作答与参考答案语义等价。`,
    referenceAnswer: correctAnswer,
  } satisfies ReadingCheckResult;
}

function shouldUseAIForReadingAnswer(answer: {
  questionType: string;
  userAnswer: string;
  correctAnswer: string;
}) {
  return (
    (answer.questionType === "open-ended" || answer.questionType === "open-ended-sub")
    && (
      answer.userAnswer.trim().length > 0
      || answer.correctAnswer.trim().length === 0
    )
  );
}

async function gradeReadingAnswers(
  answers: Array<{
    questionId: string;
    questionType: string;
    questionText: string;
    userAnswer: string;
    correctAnswer: string;
    context?: string;
  }>
) {
  const fallbackResults = answers.map(gradeReadingAnswer);
  const aiCandidates = answers.filter(shouldUseAIForReadingAnswer);

  if (aiCandidates.length === 0) {
    return fallbackResults;
  }

  try {
    const prompt = `You are grading short reading-comprehension answers for an English assessment.

Rules:
- Return 1 only when the student's answer is materially consistent with the reference answer.
- Accept paraphrases, concise wording, minor grammar mistakes, and semantically equivalent answers.
- Reject answers that miss a key fact, contradict the reference answer, or are too vague.
- Use the context passage when provided.
- Always return a concise referenceAnswer for each item.
- If a reference answer is missing, infer the best acceptable answer from the passage and question.
- If the student left the answer blank, mark it incorrect, but still provide the referenceAnswer and a short explanation.
- Keep feedback short and practical.

Answers to grade:
${aiCandidates.map((answer, index) => `
${index + 1}. questionId=${answer.questionId}
Question: ${answer.questionText}
${answer.context ? `Context: ${answer.context}` : ""}
Student answer: ${answer.userAnswer.trim() || "[No response submitted]"}
Reference answer: ${answer.correctAnswer.trim() || "[Not provided - infer it from the question and context]"}
`).join("\n")}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an English reading assessor. Grade answers carefully and return valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reading_open_ended_grades",
          strict: true,
          schema: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    questionId: { type: "string" },
                    isCorrect: { type: "boolean" },
                    referenceAnswer: { type: "string" },
                    feedback_en: { type: "string" },
                    feedback_cn: { type: "string" },
                    explanation_en: { type: "string" },
                    explanation_cn: { type: "string" },
                  },
                  required: [
                    "questionId",
                    "isCorrect",
                    "referenceAnswer",
                    "feedback_en",
                    "feedback_cn",
                    "explanation_en",
                    "explanation_cn",
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 2000,
    });

    const parsed = parseJsonMessage<{
      results: Array<{
        questionId: string;
        isCorrect: boolean;
        referenceAnswer: string;
        feedback_en: string;
        feedback_cn: string;
        explanation_en: string;
        explanation_cn: string;
      }>;
    }>(response.choices[0]?.message?.content);

    if (!parsed || !Array.isArray(parsed.results)) {
      throw new Error("Reading AI grading response was not valid JSON.");
    }

    const aiResults = new Map(
      parsed.results.map((item) => [
        item.questionId,
        {
          questionId: item.questionId,
          isCorrect: Boolean(item.isCorrect),
          score: item.isCorrect ? 1 : 0,
          referenceAnswer: item.referenceAnswer.trim(),
          feedback_en: item.feedback_en.trim(),
          feedback_cn: item.feedback_cn.trim(),
          explanation_en: item.explanation_en.trim(),
          explanation_cn: item.explanation_cn.trim(),
        },
      ])
    );

    return answers.map((answer, index) => {
      if (!shouldUseAIForReadingAnswer(answer)) {
        return fallbackResults[index];
      }
      return aiResults.get(answer.questionId) ?? fallbackResults[index];
    });
  } catch (error) {
    console.error("[grading.checkReadingAnswers] Falling back to rule-based grading:", error);
    return fallbackResults;
  }
}

function buildAutomaticWritingFallbackEvaluation(input: {
  essay: string;
  topic: string;
  wordCountTarget: string;
}): WritingEvaluationResult {
  const hasEssay = input.essay.trim().length > 0;

  if (!hasEssay) {
    return {
      score: 0,
      maxScore: 0,
      grade: "No Submission",
      overallFeedback_en:
        "No writing response was submitted, so this section currently has no automatic score.",
      overallFeedback_cn:
        "本次未提交作文作答，因此该部分目前没有自动评分结果。",
      grammarErrors: [],
      suggestions_en: [],
      suggestions_cn: [],
      correctedEssay: "",
      annotatedEssay: "",
      reviewMode: "ai" as const,
      manualReviewRequired: false,
    };
  }

  return {
    score: 0,
    maxScore: 0,
    grade: "AI Unavailable",
    overallFeedback_en:
      "Automatic writing scoring could not be completed this time. The essay is still saved, but no AI score has been assigned yet.",
    overallFeedback_cn:
      "本次写作自动评分暂时未能完成。作文内容已经保存，但目前还没有生成 AI 分数。",
    grammarErrors: [],
    suggestions_en: [
      `Retry AI scoring for the prompt: ${input.topic}.`,
      `Use the target length (${input.wordCountTarget}) to check whether the response is complete enough before retrying.`,
      "Keep the saved essay text unchanged so the system can analyze it again.",
    ],
    suggestions_cn: [
      `可针对题目“${input.topic}”重新触发一次 AI 评分。`,
      `再次评分前，可先对照目标字数（${input.wordCountTarget}）确认作答是否完整。`,
      "请保留当前作文原文，方便系统重新分析。",
    ],
    correctedEssay: input.essay.trim(),
    annotatedEssay: input.essay.trim(),
    reviewMode: "ai" as const,
    manualReviewRequired: false,
  };
}

function buildAutomaticSpeakingFallbackQuestionEvaluation(
  response: SpeakingResponseInput,
  reason?: string,
): SpeakingQuestionEvaluation {
  const detail = reason?.trim();

  return {
    sectionId: response.sectionId,
    sectionTitle: response.sectionTitle,
    questionId: response.questionId,
    prompt: response.prompt,
    audioUrl: response.audioUrl,
    transcript: "Automatic transcript unavailable for this recording.",
    score: 0,
    maxScore: 0,
    grade: "AI Unavailable",
    feedback_en:
      detail
        ? `Automatic speaking scoring could not be completed for this recording. ${detail}`
        : "Automatic speaking scoring could not be completed for this recording this time.",
    feedback_cn:
      "本次口语录音暂时未能完成自动评分。",
    taskCompletion_en: "The system could not complete automatic task analysis for this response yet.",
    taskCompletion_cn: "系统暂时还没能完成这道口语题的自动任务分析。",
    fluency_en: "Automatic fluency analysis is temporarily unavailable.",
    fluency_cn: "流利度自动分析暂时不可用。",
    vocabulary_en: "Automatic vocabulary analysis is temporarily unavailable.",
    vocabulary_cn: "词汇自动分析暂时不可用。",
    grammar_en: "Automatic grammar analysis is temporarily unavailable.",
    grammar_cn: "语法自动分析暂时不可用。",
    pronunciation_en: "Automatic pronunciation analysis is temporarily unavailable.",
    pronunciation_cn: "发音自动分析暂时不可用。",
    suggestions_en: [
      "Retry AI speaking scoring after confirming the recording uploaded correctly.",
      "If the response is very long, keep the saved audio in a compressed browser format so transcription can still run.",
    ],
    suggestions_cn: [
      "确认录音上传正常后，可重新触发一次 AI 口语评分。",
      "如果录音较长，尽量保留压缩后的浏览器音频格式，方便系统先完成转写。",
    ],
    reviewMode: "ai",
    manualReviewRequired: false,
  };
}

function summarizeSpeakingEvaluations(
  evaluations: SpeakingQuestionEvaluation[],
): SpeakingEvaluationResult {
  const scorableEvaluations = evaluations.filter((item) => item.maxScore > 0);
  const hasFailures = scorableEvaluations.length < evaluations.length;

  if (scorableEvaluations.length === 0) {
    return {
      totalScore: 0,
      totalPossible: 0,
      grade: "AI Unavailable",
      overallFeedback_en:
        evaluations.length > 0
          ? "Automatic speaking scoring could not be completed this time. The original recordings are still saved, but no AI score has been assigned yet."
          : "No speaking responses were submitted.",
      overallFeedback_cn:
        evaluations.length > 0
          ? "本次口语自动评分暂时未能完成。原始录音已经保存，但目前还没有生成 AI 分数。"
          : "未提交口语作答。",
      evaluations,
      reviewMode: "ai",
      manualReviewRequired: false,
    };
  }

  const totalScore = scorableEvaluations.reduce((sum, item) => sum + item.score, 0);
  const totalPossible = scorableEvaluations.reduce((sum, item) => sum + item.maxScore, 0);

  return {
    totalScore,
    totalPossible,
    grade: getLetterGrade(totalScore, totalPossible),
    overallFeedback_en: hasFailures
      ? "Automatic speaking scoring completed for the available recordings. A few recordings could not be processed automatically, so please re-record those prompts if needed."
      : "Automatic speaking scoring completed. Review the per-question feedback to strengthen task focus, fluency, and sentence accuracy.",
    overallFeedback_cn: hasFailures
      ? "系统已完成可用录音的口语自动评分。仍有少数录音暂时无法处理，如有需要可重新录制这些题目。"
      : "口语已完成自动评分。请结合每题反馈，继续加强回应切题度、表达流利度和句子准确性。",
    evaluations,
    reviewMode: "ai",
    manualReviewRequired: false,
  };
}

function getStringHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.trim().length > 0)?.trim();
  }
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getRequestOrigin(req: Pick<TrpcContext["req"], "headers" | "protocol">) {
  const proto = getStringHeaderValue(req.headers["x-forwarded-proto"] as string | string[] | undefined)
    || req.protocol
    || "https";
  const host = getStringHeaderValue(req.headers["x-forwarded-host"] as string | string[] | undefined)
    || getStringHeaderValue(req.headers.host as string | string[] | undefined);

  return host ? `${proto}://${host}` : null;
}

function resolveAssetUrl(
  req: Pick<TrpcContext["req"], "headers" | "protocol">,
  rawUrl: string,
) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    if (trimmed.startsWith("//")) {
      const proto = getStringHeaderValue(req.headers["x-forwarded-proto"] as string | string[] | undefined)
        || req.protocol
        || "https";
      return `${proto}:${trimmed}`;
    }
    return trimmed;
  }

  const origin = getRequestOrigin(req);
  if (!origin) return trimmed;

  try {
    return new URL(trimmed, `${origin}/`).toString();
  } catch {
    return trimmed;
  }
}

function clampScore(value: unknown, maxScore: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(maxScore, Math.round(numeric)));
}

function getLetterGrade(score: number, total: number) {
  if (total <= 0) return "D";
  const pct = Math.round((score / total) * 100);
  if (pct >= 90) return "A";
  if (pct >= 75) return "B";
  if (pct >= 60) return "C";
  return "D";
}

function toNonEmptyStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function parseJsonMessage<T>(content: unknown): T | null {
  if (typeof content !== "string") return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function normalizeGatewayModelId(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.includes("/") ? trimmed : `openai/${trimmed}`;
}

function normalizeOptionalString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[], maxItems = 5) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
  return items.length > 0 ? items : fallback;
}

type AiReportDraft = Omit<AssessmentReportResult, "speakingEvaluation">;

function mergeAIReportDraft(
  fallback: AssessmentReportResult,
  draft: Partial<AiReportDraft> | null | undefined,
): AssessmentReportResult {
  if (!draft) return fallback;

  const fallbackInsightMap = new Map(
    fallback.sectionInsights.map((item) => [item.sectionId, item]),
  );
  const nextSectionInsights = fallback.sectionInsights.map((item) => {
    const matched = Array.isArray(draft.sectionInsights)
      ? draft.sectionInsights.find((entry) => entry?.sectionId === item.sectionId)
      : undefined;

    return {
      sectionId: item.sectionId,
      sectionTitle: normalizeOptionalString(matched?.sectionTitle, item.sectionTitle),
      summary_en: normalizeOptionalString(matched?.summary_en, item.summary_en),
      summary_cn: normalizeOptionalString(matched?.summary_cn, item.summary_cn),
    };
  });

  const extraInsights = Array.isArray(draft.sectionInsights)
    ? draft.sectionInsights
        .filter((item): item is NonNullable<AiReportDraft["sectionInsights"][number]> => Boolean(item && typeof item.sectionId === "string" && item.sectionId.trim()))
        .filter((item) => !fallbackInsightMap.has(item.sectionId))
        .map((item) => ({
          sectionId: item.sectionId.trim(),
          sectionTitle: normalizeOptionalString(item.sectionTitle, item.sectionId.trim()),
          summary_en: normalizeOptionalString(item.summary_en, `${normalizeOptionalString(item.sectionTitle, item.sectionId.trim())} was completed.`),
          summary_cn: normalizeOptionalString(item.summary_cn, "该部分已完成。"),
        }))
    : [];

  const nextStudyPlan = Array.isArray(draft.studyPlan) && draft.studyPlan.length > 0
    ? draft.studyPlan.slice(0, 3).map((item, index) => {
        const fallbackStage = fallback.studyPlan[index] || fallback.studyPlan[fallback.studyPlan.length - 1];
        return {
          stage_en: normalizeOptionalString(item?.stage_en, fallbackStage?.stage_en || `Stage ${index + 1}`),
          stage_cn: normalizeOptionalString(item?.stage_cn, fallbackStage?.stage_cn || `阶段 ${index + 1}`),
          focus_en: normalizeOptionalString(item?.focus_en, fallbackStage?.focus_en || "Maintain progress"),
          focus_cn: normalizeOptionalString(item?.focus_cn, fallbackStage?.focus_cn || "保持进步"),
          actions_en: normalizeStringArray(item?.actions_en, fallbackStage?.actions_en || [], 4),
          actions_cn: normalizeStringArray(item?.actions_cn, fallbackStage?.actions_cn || [], 4),
        };
      })
    : fallback.studyPlan;

  return {
    ...fallback,
    reportTitle_en: normalizeOptionalString(draft.reportTitle_en, fallback.reportTitle_en),
    reportTitle_cn: normalizeOptionalString(draft.reportTitle_cn, fallback.reportTitle_cn),
    summary_en: normalizeOptionalString(draft.summary_en, fallback.summary_en),
    summary_cn: normalizeOptionalString(draft.summary_cn, fallback.summary_cn),
    overallSummary_en: normalizeOptionalString(draft.overallSummary_en, fallback.overallSummary_en),
    overallSummary_cn: normalizeOptionalString(draft.overallSummary_cn, fallback.overallSummary_cn),
    strengths_en: normalizeStringArray(draft.strengths_en, fallback.strengths_en, 4),
    strengths_cn: normalizeStringArray(draft.strengths_cn, fallback.strengths_cn, 4),
    weaknesses_en: normalizeStringArray(draft.weaknesses_en, fallback.weaknesses_en, 4),
    weaknesses_cn: normalizeStringArray(draft.weaknesses_cn, fallback.weaknesses_cn, 4),
    recommendations_en: normalizeStringArray(draft.recommendations_en, fallback.recommendations_en, 4),
    recommendations_cn: normalizeStringArray(draft.recommendations_cn, fallback.recommendations_cn, 4),
    timeAnalysis_en: normalizeOptionalString(draft.timeAnalysis_en, fallback.timeAnalysis_en),
    timeAnalysis_cn: normalizeOptionalString(draft.timeAnalysis_cn, fallback.timeAnalysis_cn),
    abilitySnapshot_en: normalizeStringArray(draft.abilitySnapshot_en, fallback.abilitySnapshot_en, 4),
    abilitySnapshot_cn: normalizeStringArray(draft.abilitySnapshot_cn, fallback.abilitySnapshot_cn, 4),
    sectionInsights: [...nextSectionInsights, ...extraInsights],
    studyPlan: nextStudyPlan,
    parentFeedback_en: normalizeOptionalString(draft.parentFeedback_en, fallback.parentFeedback_en),
    parentFeedback_cn: normalizeOptionalString(draft.parentFeedback_cn, fallback.parentFeedback_cn),
  };
}

async function buildAssessmentReport(input: Parameters<typeof buildTemplateAssessmentReport>[0]) {
  const fallbackReport = buildTemplateAssessmentReport(input);

  if (!ENV.aiGatewayApiKey && !ENV.openaiApiKey && !ENV.forgeApiKey) {
    return fallbackReport;
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You write concise, high-signal bilingual assessment reports for K-12 English learners. Return valid JSON only. Do not invent scores, section names, or teacher-reviewed results.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Rewrite this assessment report using AI analysis while keeping the same overall structure.

Requirements:
- Keep the report practical, specific, and easy for parents and teachers to read.
- Keep bilingual alignment: English and Chinese should say the same thing.
- Preserve the exact section order from the input.
- Do not write generic advice that could fit any student. Tie comments to the current part titles and task mechanics whenever the input provides them.
- Avoid repeating the same sentence frame across strengths, weaknesses, recommendations, and section insights.
- When taskTypes are available, use them to mention concrete mechanics such as distractor control, evidence checking, collocation, sentence transformation, image-based recognition, short open-ended support, matching, or sequencing.
- Every recommendation should name what to practise, not just say "improve" or "keep practising".
- If a section has total=0, explicitly say whether there was no response or automatic scoring is currently unavailable. Do not invent a score.
- Keep each list concise:
  - strengths / weaknesses / recommendations / abilitySnapshot: 2-4 items
  - studyPlan: exactly 3 stages
- sectionInsights must cover the current sections in order and use the same sectionId / sectionTitle values when available.

Student assessment data:
${JSON.stringify({
  paperTitle: input.paperTitle,
  studentName: input.studentName || "",
  studentGrade: input.studentGrade || "",
  totalScore: input.totalScore,
  totalPossible: input.totalPossible,
  percentage: input.percentage,
  grade: input.grade,
  totalTimeSeconds: input.totalTimeSeconds,
  sectionResults: input.sectionResults,
  writingSummary: input.writingSummary || null,
  speakingSummary: input.speakingSummary
    ? {
        totalScore: input.speakingSummary.totalScore,
        totalPossible: input.speakingSummary.totalPossible,
        grade: input.speakingSummary.grade,
        overallFeedback_en: input.speakingSummary.overallFeedback_en,
        overallFeedback_cn: input.speakingSummary.overallFeedback_cn,
        reviewMode: input.speakingSummary.reviewMode || null,
        manualReviewRequired: input.speakingSummary.manualReviewRequired || false,
        evaluations: input.speakingSummary.evaluations.map((item) => ({
          sectionId: item.sectionId,
          sectionTitle: item.sectionTitle,
          questionId: item.questionId,
          score: item.score,
          maxScore: item.maxScore,
          feedback_en: item.feedback_en,
          feedback_cn: item.feedback_cn,
          suggestions_en: item.suggestions_en,
          suggestions_cn: item.suggestions_cn,
          reviewMode: item.reviewMode || null,
          manualReviewRequired: item.manualReviewRequired || false,
        })),
      }
    : null,
  fallbackReport,
}, null, 2)}

Return JSON only.`,
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "assessment_report",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary_en: { type: "string" },
              summary_cn: { type: "string" },
              strengths_en: { type: "array", items: { type: "string" } },
              strengths_cn: { type: "array", items: { type: "string" } },
              weaknesses_en: { type: "array", items: { type: "string" } },
              weaknesses_cn: { type: "array", items: { type: "string" } },
              recommendations_en: { type: "array", items: { type: "string" } },
              recommendations_cn: { type: "array", items: { type: "string" } },
              timeAnalysis_en: { type: "string" },
              timeAnalysis_cn: { type: "string" },
              reportTitle_en: { type: "string" },
              reportTitle_cn: { type: "string" },
              overallSummary_en: { type: "string" },
              overallSummary_cn: { type: "string" },
              abilitySnapshot_en: { type: "array", items: { type: "string" } },
              abilitySnapshot_cn: { type: "array", items: { type: "string" } },
              sectionInsights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sectionId: { type: "string" },
                    sectionTitle: { type: "string" },
                    summary_en: { type: "string" },
                    summary_cn: { type: "string" },
                  },
                  required: ["sectionId", "sectionTitle", "summary_en", "summary_cn"],
                  additionalProperties: false,
                },
              },
              studyPlan: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    stage_en: { type: "string" },
                    stage_cn: { type: "string" },
                    focus_en: { type: "string" },
                    focus_cn: { type: "string" },
                    actions_en: { type: "array", items: { type: "string" } },
                    actions_cn: { type: "array", items: { type: "string" } },
                  },
                  required: ["stage_en", "stage_cn", "focus_en", "focus_cn", "actions_en", "actions_cn"],
                  additionalProperties: false,
                },
              },
              parentFeedback_en: { type: "string" },
              parentFeedback_cn: { type: "string" },
            },
            required: [
              "summary_en",
              "summary_cn",
              "strengths_en",
              "strengths_cn",
              "weaknesses_en",
              "weaknesses_cn",
              "recommendations_en",
              "recommendations_cn",
              "timeAnalysis_en",
              "timeAnalysis_cn",
              "reportTitle_en",
              "reportTitle_cn",
              "overallSummary_en",
              "overallSummary_cn",
              "abilitySnapshot_en",
              "abilitySnapshot_cn",
              "sectionInsights",
              "studyPlan",
              "parentFeedback_en",
              "parentFeedback_cn",
            ],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 2500,
    });

    const parsed = parseJsonMessage<AiReportDraft>(response.choices[0]?.message?.content);
    if (!parsed) {
      throw new Error("Assessment report response was not valid JSON.");
    }

    return mergeAIReportDraft(fallbackReport, parsed);
  } catch (error) {
    console.error("[grading.generateReport] Falling back to template report:", error);
    return fallbackReport;
  }
}

function normalizeAudioMimeType(value: string | null | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() || "";
}

function inferAudioMimeTypeFromUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  if (/\.wav(?:$|[?#])/.test(normalized)) return "audio/wav";
  if (/\.mp3(?:$|[?#])/.test(normalized)) return "audio/mpeg";
  if (/\.m4a(?:$|[?#])/.test(normalized)) return "audio/mp4";
  if (/\.mp4(?:$|[?#])/.test(normalized)) return "audio/mp4";
  if (/\.ogg(?:$|[?#])/.test(normalized)) return "audio/ogg";
  if (/\.aac(?:$|[?#])/.test(normalized)) return "audio/aac";
  if (/\.webm(?:$|[?#])/.test(normalized)) return "audio/webm";
  return "";
}

function getGatewayAudioFormat(
  mimeType: string,
  audioUrl: string,
): "wav" | "mp3" | null {
  const normalizedMime = normalizeAudioMimeType(mimeType) || inferAudioMimeTypeFromUrl(audioUrl);

  if (
    normalizedMime === "audio/wav"
    || normalizedMime === "audio/wave"
    || normalizedMime === "audio/x-wav"
  ) {
    return "wav";
  }

  if (
    normalizedMime === "audio/mpeg"
    || normalizedMime === "audio/mp3"
  ) {
    return "mp3";
  }

  return null;
}

async function fetchGatewayAudioInput(
  req: Pick<TrpcContext["req"], "headers" | "protocol">,
  rawUrl: string,
) {
  const resolvedAudioUrl = resolveAssetUrl(req, rawUrl);
  const response = await fetch(resolvedAudioUrl);

  if (!response.ok) {
    throw new Error(`Failed to download speaking audio: ${response.status} ${response.statusText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (audioBuffer.length === 0) {
    throw new Error("Speaking audio file was empty.");
  }

  if (audioBuffer.length > MAX_GATEWAY_AUDIO_BYTES) {
    throw new Error("Speaking audio file exceeds the 16MB limit for Gateway scoring.");
  }

  const mimeType = normalizeAudioMimeType(response.headers.get("content-type"))
    || inferAudioMimeTypeFromUrl(resolvedAudioUrl)
    || "audio/mpeg";
  const format = getGatewayAudioFormat(mimeType, resolvedAudioUrl);

  if (!format) {
    throw new Error(
      `Gateway speaking scoring currently supports WAV or MP3 audio, but received ${mimeType || "an unknown audio type"}.`
    );
  }

  return {
    resolvedAudioUrl,
    format,
    mimeType,
    base64Data: audioBuffer.toString("base64"),
  };
}

async function evaluateWritingWithAI(input: {
  essay: string;
  topic: string;
  wordCountTarget: string;
}): Promise<WritingEvaluationResult> {
  try {
    const prompt = `Evaluate this student's English writing response for a school assessment.

Scoring rubric:
- Total score: 0-${AI_WRITING_MAX_SCORE}
- Consider task completion, organization/coherence, grammar accuracy, and vocabulary range/control.
- Be fair to a learner, but do not inflate the score.

Output requirements:
- Return concise but useful bilingual feedback in English and Chinese.
- "correctedEssay" should be a polished corrected version of the student's writing.
- "annotatedEssay" must keep the original wording and use this exact inline format for each marked error:
  [ERR:original text|COR:corrected text|EXP:short explanation]
- "grammarErrors" should list the most important issues only.
- Suggestions should be actionable and specific.

Prompt topic: ${input.topic}
Target length: ${input.wordCountTarget}

Student essay:
${input.essay}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a rigorous but supportive English writing examiner. Return valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "writing_evaluation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score: { type: "integer", minimum: 0, maximum: AI_WRITING_MAX_SCORE },
              overallFeedback_en: { type: "string" },
              overallFeedback_cn: { type: "string" },
              correctedEssay: { type: "string" },
              annotatedEssay: { type: "string" },
              grammarErrors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    original: { type: "string" },
                    correction: { type: "string" },
                    explanation_en: { type: "string" },
                    explanation_cn: { type: "string" },
                  },
                  required: ["original", "correction", "explanation_en", "explanation_cn"],
                  additionalProperties: false,
                },
              },
              suggestions_en: {
                type: "array",
                items: { type: "string" },
              },
              suggestions_cn: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "score",
              "overallFeedback_en",
              "overallFeedback_cn",
              "correctedEssay",
              "annotatedEssay",
              "grammarErrors",
              "suggestions_en",
              "suggestions_cn",
            ],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 2500,
    });

    const parsed = parseJsonMessage<{
      score: number;
      overallFeedback_en: string;
      overallFeedback_cn: string;
      correctedEssay: string;
      annotatedEssay: string;
      grammarErrors: WritingEvaluationResult["grammarErrors"];
      suggestions_en: string[];
      suggestions_cn: string[];
    }>(response.choices[0]?.message?.content);

    if (!parsed) {
      throw new Error("Writing evaluation response was not valid JSON.");
    }

    const score = clampScore(parsed.score, AI_WRITING_MAX_SCORE);
    return {
      score,
      maxScore: AI_WRITING_MAX_SCORE,
      grade: getLetterGrade(score, AI_WRITING_MAX_SCORE),
      overallFeedback_en: parsed.overallFeedback_en.trim(),
      overallFeedback_cn: parsed.overallFeedback_cn.trim(),
      grammarErrors: Array.isArray(parsed.grammarErrors)
        ? parsed.grammarErrors
            .filter((item) =>
              item
              && typeof item.original === "string"
              && typeof item.correction === "string"
              && typeof item.explanation_en === "string"
              && typeof item.explanation_cn === "string"
            )
            .slice(0, 8)
        : [],
      suggestions_en: toNonEmptyStringArray(parsed.suggestions_en, [
        "Keep your ideas organized with a clear beginning, middle, and ending.",
        "Check verb forms, sentence endings, and word choice before submitting.",
      ]),
      suggestions_cn: toNonEmptyStringArray(parsed.suggestions_cn, [
        "先把内容按开头、发展、结尾组织清楚。",
        "提交前再检查动词形式、句子结尾和用词准确性。",
      ]),
      correctedEssay: parsed.correctedEssay.trim(),
      annotatedEssay: parsed.annotatedEssay.trim(),
      reviewMode: "ai",
      manualReviewRequired: false,
    };
  } catch (error) {
    console.error("[grading.evaluateWriting] Falling back to automatic unavailable state:", error);
    return buildAutomaticWritingFallbackEvaluation(input);
  }
}

async function evaluateSpeakingResponseWithGatewayAudio(
  req: Pick<TrpcContext["req"], "headers" | "protocol">,
  responseInput: {
    sectionId: string;
    sectionTitle: string;
    questionId: number;
    prompt: string;
    audioUrl: string;
  },
): Promise<SpeakingQuestionEvaluation> {
  const audioInput = await fetchGatewayAudioInput(req, responseInput.audioUrl);
  const model = normalizeGatewayModelId(
    ENV.aiGatewaySpeakingModel,
    "openai/gpt-audio",
  );

  const prompt = `Listen to this student's English speaking assessment response and score it.

Scoring rules:
- Score from 0-${AI_SPEAKING_MAX_SCORE}.
- Evaluate task completion, fluency, vocabulary, grammar, and pronunciation/clarity.
- First provide a clean transcript of the student's response. If a short part is unclear, mark it as [inaudible].
- Keep feedback concise, specific, and useful for a learner.
- Suggestions must be practical next steps.

Question prompt: ${responseInput.prompt}
Section title: ${responseInput.sectionTitle}
Question id: ${responseInput.questionId}`;

  const response = await invokeLLM({
    model,
    modalities: ["text"],
    messages: [
      {
        role: "system",
        content:
          "You are an English speaking examiner for school assessments. Listen to the audio directly and return valid JSON only.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "input_audio",
            input_audio: {
              data: audioInput.base64Data,
              format: audioInput.format,
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "speaking_audio_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            transcript: { type: "string" },
            score: { type: "integer", minimum: 0, maximum: AI_SPEAKING_MAX_SCORE },
            feedback_en: { type: "string" },
            feedback_cn: { type: "string" },
            taskCompletion_en: { type: "string" },
            taskCompletion_cn: { type: "string" },
            fluency_en: { type: "string" },
            fluency_cn: { type: "string" },
            vocabulary_en: { type: "string" },
            vocabulary_cn: { type: "string" },
            grammar_en: { type: "string" },
            grammar_cn: { type: "string" },
            pronunciation_en: { type: "string" },
            pronunciation_cn: { type: "string" },
            suggestions_en: {
              type: "array",
              items: { type: "string" },
            },
            suggestions_cn: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: [
            "transcript",
            "score",
            "feedback_en",
            "feedback_cn",
            "taskCompletion_en",
            "taskCompletion_cn",
            "fluency_en",
            "fluency_cn",
            "vocabulary_en",
            "vocabulary_cn",
            "grammar_en",
            "grammar_cn",
            "pronunciation_en",
            "pronunciation_cn",
            "suggestions_en",
            "suggestions_cn",
          ],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 1800,
  });

  const parsed = parseJsonMessage<{
    transcript: string;
    score: number;
    feedback_en: string;
    feedback_cn: string;
    taskCompletion_en: string;
    taskCompletion_cn: string;
    fluency_en: string;
    fluency_cn: string;
    vocabulary_en: string;
    vocabulary_cn: string;
    grammar_en: string;
    grammar_cn: string;
    pronunciation_en: string;
    pronunciation_cn: string;
    suggestions_en: string[];
    suggestions_cn: string[];
  }>(response.choices[0]?.message?.content);

  if (!parsed) {
    throw new Error("Gateway speaking evaluation response was not valid JSON.");
  }

  const score = clampScore(parsed.score, AI_SPEAKING_MAX_SCORE);

  return {
    sectionId: responseInput.sectionId,
    sectionTitle: responseInput.sectionTitle,
    questionId: responseInput.questionId,
    prompt: responseInput.prompt,
    audioUrl: responseInput.audioUrl,
    transcript: parsed.transcript.trim(),
    score,
    maxScore: AI_SPEAKING_MAX_SCORE,
    grade: getLetterGrade(score, AI_SPEAKING_MAX_SCORE),
    feedback_en: parsed.feedback_en.trim() || "The response was evaluated automatically.",
    feedback_cn: parsed.feedback_cn.trim() || "该口语作答已完成自动评分。",
    taskCompletion_en: parsed.taskCompletion_en.trim() || "Task completion was reviewed automatically.",
    taskCompletion_cn: parsed.taskCompletion_cn.trim() || "任务完成度已完成自动评估。",
    fluency_en: parsed.fluency_en.trim() || "Fluency was reviewed automatically.",
    fluency_cn: parsed.fluency_cn.trim() || "流利度已完成自动评估。",
    vocabulary_en: parsed.vocabulary_en.trim() || "Vocabulary use was reviewed automatically.",
    vocabulary_cn: parsed.vocabulary_cn.trim() || "词汇使用已完成自动评估。",
    grammar_en: parsed.grammar_en.trim() || "Grammar control was reviewed automatically.",
    grammar_cn: parsed.grammar_cn.trim() || "语法使用已完成自动评估。",
    pronunciation_en: parsed.pronunciation_en.trim() || "Pronunciation and clarity were reviewed automatically.",
    pronunciation_cn: parsed.pronunciation_cn.trim() || "发音与清晰度已完成自动评估。",
    suggestions_en: toNonEmptyStringArray(parsed.suggestions_en, [
      "Answer the prompt more directly before adding extra details.",
      "Slow down slightly and aim for clearer sentence control.",
    ]),
    suggestions_cn: toNonEmptyStringArray(parsed.suggestions_cn, [
      "先更直接地回应题目，再补充细节。",
      "适当放慢速度，尽量让句子表达更清楚。",
    ]),
    reviewMode: "ai",
    manualReviewRequired: false,
  };
}

async function buildSpeakingOverallFeedback(
  evaluations: SpeakingQuestionEvaluation[],
) {
  try {
    const response = await invokeLLM({
      model: normalizeGatewayModelId(
        ENV.aiGatewayModel || ENV.aiGatewaySpeakingModel,
        "openai/gpt-audio",
      ),
      messages: [
        {
          role: "system",
          content:
            "You are summarizing speaking-assessment results. Return valid JSON only.",
        },
        {
          role: "user",
          content: `Write a short bilingual overall summary for these speaking assessment results.

Rules:
- Keep each summary to 2-3 concise sentences.
- Mention one or two strengths and the main improvement focus.
- Base the summary only on the evidence below.

Results:
${evaluations.map((item, index) => `
${index + 1}. ${item.sectionTitle} Q${item.questionId}
Prompt: ${item.prompt}
Transcript: ${item.transcript}
Score: ${item.score}/${item.maxScore}
Feedback EN: ${item.feedback_en}
Task completion EN: ${item.taskCompletion_en}
Fluency EN: ${item.fluency_en}
Vocabulary EN: ${item.vocabulary_en}
Grammar EN: ${item.grammar_en}
Pronunciation EN: ${item.pronunciation_en}
`).join("\n")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "speaking_overall_feedback",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallFeedback_en: { type: "string" },
              overallFeedback_cn: { type: "string" },
            },
            required: ["overallFeedback_en", "overallFeedback_cn"],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 800,
    });

    const parsed = parseJsonMessage<{
      overallFeedback_en: string;
      overallFeedback_cn: string;
    }>(response.choices[0]?.message?.content);

    if (parsed?.overallFeedback_en?.trim() && parsed?.overallFeedback_cn?.trim()) {
      return {
        overallFeedback_en: parsed.overallFeedback_en.trim(),
        overallFeedback_cn: parsed.overallFeedback_cn.trim(),
      };
    }
  } catch (error) {
    console.error("[grading.evaluateSpeaking] Failed to summarize Gateway speaking feedback:", error);
  }

  return {
    overallFeedback_en:
      "Automatic speaking scoring completed. Review the per-question feedback to strengthen task focus, fluency, and sentence accuracy.",
    overallFeedback_cn:
      "口语已完成自动评分。请结合每题反馈，继续加强回应切题度、表达流利度和句子准确性。",
  };
}

async function evaluateSpeakingResponseWithTranscriptAI(
  req: Pick<TrpcContext["req"], "headers" | "protocol">,
  responseInput: SpeakingResponseInput,
): Promise<SpeakingQuestionEvaluation> {
  const resolvedAudioUrl = resolveAssetUrl(req, responseInput.audioUrl);
  const transcript = await transcribeAudio({
    audioUrl: resolvedAudioUrl,
    language: "en",
    prompt:
      "Transcribe a student's English speaking assessment response. Preserve hesitations, repeated words, and incomplete phrases when they affect fluency.",
  });

  if ("error" in transcript || !transcript.text.trim()) {
    throw new Error(
      "error" in transcript
        ? `${transcript.error}${transcript.details ? `: ${transcript.details}` : ""}`
        : "Empty transcript returned from speech service."
    );
  }

  const prompt = `Evaluate this English speaking assessment response using the prompt and transcript.

Scoring rules:
- Score the response from 0-${AI_SPEAKING_MAX_SCORE}.
- Judge task completion, fluency, vocabulary, grammar, and pronunciation/clarity.
- Be cautious and fair. Use only evidence available from the transcript and the fact that it came from a spoken response.
- Keep feedback concise, specific, and useful for a learner.
- Suggestions must be actionable.

Response:
sectionId=${responseInput.sectionId}; questionId=${responseInput.questionId}; sectionTitle=${responseInput.sectionTitle}
Prompt: ${responseInput.prompt}
Transcript: ${transcript.text.trim()}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are an English speaking examiner for school assessments. Return valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "speaking_transcript_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            transcript: { type: "string" },
            score: { type: "integer", minimum: 0, maximum: AI_SPEAKING_MAX_SCORE },
            feedback_en: { type: "string" },
            feedback_cn: { type: "string" },
            taskCompletion_en: { type: "string" },
            taskCompletion_cn: { type: "string" },
            fluency_en: { type: "string" },
            fluency_cn: { type: "string" },
            vocabulary_en: { type: "string" },
            vocabulary_cn: { type: "string" },
            grammar_en: { type: "string" },
            grammar_cn: { type: "string" },
            pronunciation_en: { type: "string" },
            pronunciation_cn: { type: "string" },
            suggestions_en: {
              type: "array",
              items: { type: "string" },
            },
            suggestions_cn: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: [
            "transcript",
            "score",
            "feedback_en",
            "feedback_cn",
            "taskCompletion_en",
            "taskCompletion_cn",
            "fluency_en",
            "fluency_cn",
            "vocabulary_en",
            "vocabulary_cn",
            "grammar_en",
            "grammar_cn",
            "pronunciation_en",
            "pronunciation_cn",
            "suggestions_en",
            "suggestions_cn",
          ],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 1800,
  });

  const parsed = parseJsonMessage<{
    transcript: string;
    score: number;
    feedback_en: string;
    feedback_cn: string;
    taskCompletion_en: string;
    taskCompletion_cn: string;
    fluency_en: string;
    fluency_cn: string;
    vocabulary_en: string;
    vocabulary_cn: string;
    grammar_en: string;
    grammar_cn: string;
    pronunciation_en: string;
    pronunciation_cn: string;
    suggestions_en: string[];
    suggestions_cn: string[];
    evaluations?: Array<{
      sectionId?: string;
      questionId?: number;
      transcript?: string;
      score?: number;
      feedback_en?: string;
      feedback_cn?: string;
      taskCompletion_en?: string;
      taskCompletion_cn?: string;
      fluency_en?: string;
      fluency_cn?: string;
      vocabulary_en?: string;
      vocabulary_cn?: string;
      grammar_en?: string;
      grammar_cn?: string;
      pronunciation_en?: string;
      pronunciation_cn?: string;
      suggestions_en?: string[];
      suggestions_cn?: string[];
    }>;
  }>(response.choices[0]?.message?.content);

  if (!parsed) {
    throw new Error("Speaking evaluation response was not valid JSON.");
  }

  const parsedEvaluation = Array.isArray(parsed.evaluations)
    ? parsed.evaluations.find(
        (item) => item.sectionId === responseInput.sectionId && item.questionId === responseInput.questionId,
      ) || parsed.evaluations[0]
    : parsed;
  const score = clampScore(parsedEvaluation?.score ?? parsed.score, AI_SPEAKING_MAX_SCORE);

  return {
    sectionId: responseInput.sectionId,
    sectionTitle: responseInput.sectionTitle,
    questionId: responseInput.questionId,
    prompt: responseInput.prompt,
    audioUrl: responseInput.audioUrl,
    transcript:
      (typeof parsedEvaluation?.transcript === "string" && parsedEvaluation.transcript.trim().length > 0
        ? parsedEvaluation.transcript.trim()
        : parsed.transcript?.trim()) || transcript.text.trim(),
    score,
    maxScore: AI_SPEAKING_MAX_SCORE,
    grade: getLetterGrade(score, AI_SPEAKING_MAX_SCORE),
    feedback_en: normalizeOptionalString(parsedEvaluation?.feedback_en, "The response was evaluated automatically."),
    feedback_cn: normalizeOptionalString(parsedEvaluation?.feedback_cn, "该口语作答已完成自动评分。"),
    taskCompletion_en: normalizeOptionalString(parsedEvaluation?.taskCompletion_en, "Task completion was reviewed automatically."),
    taskCompletion_cn: normalizeOptionalString(parsedEvaluation?.taskCompletion_cn, "任务完成度已完成自动评估。"),
    fluency_en: normalizeOptionalString(parsedEvaluation?.fluency_en, "Fluency was reviewed automatically."),
    fluency_cn: normalizeOptionalString(parsedEvaluation?.fluency_cn, "流利度已完成自动评估。"),
    vocabulary_en: normalizeOptionalString(parsedEvaluation?.vocabulary_en, "Vocabulary use was reviewed automatically."),
    vocabulary_cn: normalizeOptionalString(parsedEvaluation?.vocabulary_cn, "词汇使用已完成自动评估。"),
    grammar_en: normalizeOptionalString(parsedEvaluation?.grammar_en, "Grammar control was reviewed automatically."),
    grammar_cn: normalizeOptionalString(parsedEvaluation?.grammar_cn, "语法使用已完成自动评估。"),
    pronunciation_en: normalizeOptionalString(parsedEvaluation?.pronunciation_en, "Pronunciation and clarity were reviewed automatically."),
    pronunciation_cn: normalizeOptionalString(parsedEvaluation?.pronunciation_cn, "发音与清晰度已完成自动评估。"),
    suggestions_en: normalizeStringArray(parsedEvaluation?.suggestions_en, [
      "Answer the prompt more directly before adding extra details.",
      "Slow down slightly and aim for clearer sentence control.",
    ]),
    suggestions_cn: normalizeStringArray(parsedEvaluation?.suggestions_cn, [
      "先更直接地回应题目，再补充细节。",
      "适当放慢速度，尽量让句子表达更清楚。",
    ]),
    reviewMode: "ai",
    manualReviewRequired: false,
  };
}

async function evaluateSpeakingWithAI(
  req: Pick<TrpcContext["req"], "headers" | "protocol">,
  responses: SpeakingResponseInput[],
): Promise<SpeakingEvaluationResult> {
  const evaluations = await Promise.all(
    responses.map(async (response) => {
      if (ENV.aiGatewayApiKey) {
        try {
          return await evaluateSpeakingResponseWithGatewayAudio(req, response);
        } catch (error) {
          console.error(
            `[grading.evaluateSpeaking] Gateway audio scoring failed for ${response.sectionId}#${response.questionId}, trying transcription fallback:`,
            error,
          );
        }
      }

      try {
        return await evaluateSpeakingResponseWithTranscriptAI(req, response);
      } catch (error) {
        console.error(
          `[grading.evaluateSpeaking] Automatic speaking scoring failed for ${response.sectionId}#${response.questionId}:`,
          error,
        );
        return buildAutomaticSpeakingFallbackQuestionEvaluation(
          response,
          error instanceof Error ? error.message : "Unknown automatic scoring error.",
        );
      }
    }),
  );

  const result = summarizeSpeakingEvaluations(evaluations);
  const scorableEvaluations = evaluations.filter((item) => item.maxScore > 0);

  if (scorableEvaluations.length === 0) {
    return result;
  }

  if (scorableEvaluations.length === 1) {
    const [singleEvaluation] = scorableEvaluations;
    return {
      ...result,
      overallFeedback_en:
        result.overallFeedback_en.includes("could not be processed automatically")
          ? `${singleEvaluation.feedback_en} ${result.overallFeedback_en}`.trim()
          : singleEvaluation.feedback_en,
      overallFeedback_cn:
        result.overallFeedback_cn.includes("暂时无法处理")
          ? `${singleEvaluation.feedback_cn} ${result.overallFeedback_cn}`.trim()
          : singleEvaluation.feedback_cn,
    };
  }

  try {
    const overallFeedback = await buildSpeakingOverallFeedback(scorableEvaluations);
    return {
      ...result,
      overallFeedback_en:
        result.overallFeedback_en.trim().length > 0
          ? `${overallFeedback.overallFeedback_en} ${result.overallFeedback_en}`.trim()
          : overallFeedback.overallFeedback_en,
      overallFeedback_cn:
        result.overallFeedback_cn.trim().length > 0
          ? `${overallFeedback.overallFeedback_cn} ${result.overallFeedback_cn}`.trim()
          : overallFeedback.overallFeedback_cn,
    };
  } catch (error) {
    console.error("[grading.evaluateSpeaking] Failed to summarize speaking feedback:", error);
    return result;
  }
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
          context: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => gradeReadingAnswers(input.answers)),

    // AI-powered writing evaluation with bilingual inline annotations
    evaluateWriting: publicProcedure
      .input(z.object({
        essay: z.string(),
        topic: z.string(),
        wordCountTarget: z.string(),
      }))
      .mutation(async ({ input }) => {
        return evaluateWritingWithAI(input);
      }),

    evaluateSpeaking: publicProcedure
      .input(z.object({
        responses: z.array(z.object({
          sectionId: z.string(),
          sectionTitle: z.string(),
          questionId: z.number(),
          prompt: z.string(),
          audioUrl: z.string().min(1),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        return evaluateSpeakingWithAI(ctx.req, input.responses);
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
          taskTypes: z.array(z.string()).optional(),
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
      .mutation(async ({ input }) => buildAssessmentReport(input)),
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
          answersJson: sanitizeJsonStringForResultStorage(input.answersJson) ?? input.answersJson,
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
        if (updates.reportJson) {
          cleanUpdates.reportJson = sanitizeJsonStringForResultStorage(updates.reportJson) ?? updates.reportJson;
        }
        await updateTestResultAI(id, cleanUpdates);
        return { success: true };
      }),

    list: publicProcedure.query(async () => {
      const results = await getAllTestResults();
      return results.map((r) => {
        const snapshot = extractStoredPaperSnapshot(r.answersJson);
        const normalizedPaperId = r.paperId === "unknown" && snapshot.paperId
          ? snapshot.paperId
          : r.paperId;
        const normalizedPaperTitle = (!r.paperTitle || r.paperTitle === "Assessment") && snapshot.paperTitle
          ? snapshot.paperTitle
          : r.paperTitle;
        const paperSubject = snapshot.paperSubject ?? getGeneratedPaperSubjectFromPaperId(normalizedPaperId);

        return {
          id: r.id,
          studentName: r.studentName,
          studentGrade: r.studentGrade,
          paperId: normalizedPaperId,
          paperTitle: normalizedPaperTitle,
          paperSubject,
          totalCorrect: r.totalCorrect,
          totalQuestions: r.totalQuestions,
          totalTimeSeconds: r.totalTimeSeconds,
          createdAt: r.createdAt,
          hasReport: !!r.reportJson,
          hasReadingResults: !!r.readingResultsJson,
          hasWritingResult: !!r.writingResultJson,
        };
      });
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
