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

const AI_WRITING_MAX_SCORE = 20;
const AI_SPEAKING_MAX_SCORE = 5;
const MAX_GATEWAY_AUDIO_BYTES = 16 * 1024 * 1024;
const EMBEDDED_AUDIO_DATA_URL_PREFIX = "data:audio/";

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
    return value.trim().toLowerCase().startsWith(EMBEDDED_AUDIO_DATA_URL_PREFIX) ? "" : value;
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

function shouldUseAIForReadingAnswer(answer: {
  questionType: string;
  userAnswer: string;
  correctAnswer: string;
}) {
  return (
    (answer.questionType === "open-ended" || answer.questionType === "open-ended-sub")
    && answer.userAnswer.trim().length > 0
    && answer.userAnswer.trim().toLowerCase() !== "not answered"
    && answer.correctAnswer.trim().length > 0
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
- Keep feedback short and practical.

Answers to grade:
${aiCandidates.map((answer, index) => `
${index + 1}. questionId=${answer.questionId}
Question: ${answer.questionText}
${answer.context ? `Context: ${answer.context}` : ""}
Student answer: ${answer.userAnswer}
Reference answer: ${answer.correctAnswer}
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
                    feedback_en: { type: "string" },
                    feedback_cn: { type: "string" },
                    explanation_en: { type: "string" },
                    explanation_cn: { type: "string" },
                  },
                  required: [
                    "questionId",
                    "isCorrect",
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

function buildManualWritingEvaluation(input: {
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
    console.error("[grading.evaluateWriting] Falling back to manual review:", error);
    return buildManualWritingEvaluation(input);
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

async function evaluateSpeakingWithGatewayAudio(
  req: Pick<TrpcContext["req"], "headers" | "protocol">,
  responses: Array<{
    sectionId: string;
    sectionTitle: string;
    questionId: number;
    prompt: string;
    audioUrl: string;
  }>,
): Promise<SpeakingEvaluationResult> {
  const evaluations = await Promise.all(
    responses.map((response) => evaluateSpeakingResponseWithGatewayAudio(req, response)),
  );
  const totalScore = evaluations.reduce((sum, item) => sum + item.score, 0);
  const totalPossible = evaluations.reduce((sum, item) => sum + item.maxScore, 0);
  const overallFeedback = await buildSpeakingOverallFeedback(evaluations);

  return {
    totalScore,
    totalPossible,
    grade: getLetterGrade(totalScore, totalPossible),
    overallFeedback_en: overallFeedback.overallFeedback_en,
    overallFeedback_cn: overallFeedback.overallFeedback_cn,
    evaluations,
    reviewMode: "ai",
    manualReviewRequired: false,
  };
}

async function evaluateSpeakingWithTranscriptAI(
  req: Pick<TrpcContext["req"], "headers" | "protocol">,
  responses: Array<{
    sectionId: string;
    sectionTitle: string;
    questionId: number;
    prompt: string;
    audioUrl: string;
  }>,
): Promise<SpeakingEvaluationResult> {
  const transcriptResults = await Promise.all(
    responses.map(async (response) => {
      const resolvedAudioUrl = resolveAssetUrl(req, response.audioUrl);
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

      return {
        ...response,
        transcript: transcript.text.trim(),
      };
    })
  );

  const prompt = `Evaluate these English speaking assessment responses using the prompt and transcript.

Scoring rules:
- Score each response from 0-${AI_SPEAKING_MAX_SCORE}.
- Judge task completion, fluency, vocabulary, grammar, and pronunciation/clarity.
- Be cautious and fair. Use only evidence available from the transcript and the fact that it came from a spoken response.
- Keep feedback concise, specific, and useful for a learner.
- Suggestions must be actionable.

Responses:
${transcriptResults.map((item, index) => `
${index + 1}. sectionId=${item.sectionId}; questionId=${item.questionId}; sectionTitle=${item.sectionTitle}
Prompt: ${item.prompt}
Transcript: ${item.transcript}
`).join("\n")}`;

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
        name: "speaking_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            overallFeedback_en: { type: "string" },
            overallFeedback_cn: { type: "string" },
            evaluations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sectionId: { type: "string" },
                  questionId: { type: "integer" },
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
                  "sectionId",
                  "questionId",
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
          required: ["overallFeedback_en", "overallFeedback_cn", "evaluations"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 3500,
  });

  const parsed = parseJsonMessage<{
    overallFeedback_en: string;
    overallFeedback_cn: string;
    evaluations: Array<{
      sectionId: string;
      questionId: number;
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
    }>;
  }>(response.choices[0]?.message?.content);

  if (!parsed) {
    throw new Error("Speaking evaluation response was not valid JSON.");
  }

  const normalizedEvaluations: SpeakingQuestionEvaluation[] = transcriptResults.map((source) => {
    const evaluation = parsed.evaluations.find(
      (item) => item.sectionId === source.sectionId && item.questionId === source.questionId,
    );
    const score = clampScore(evaluation?.score ?? 0, AI_SPEAKING_MAX_SCORE);

    return {
      sectionId: source.sectionId,
      sectionTitle: source.sectionTitle,
      questionId: source.questionId,
      prompt: source.prompt,
      audioUrl: source.audioUrl,
      transcript: typeof evaluation?.transcript === "string" && evaluation.transcript.trim().length > 0
        ? evaluation.transcript.trim()
        : source.transcript,
      score,
      maxScore: AI_SPEAKING_MAX_SCORE,
      grade: getLetterGrade(score, AI_SPEAKING_MAX_SCORE),
      feedback_en: evaluation?.feedback_en?.trim() || "The response was evaluated automatically.",
      feedback_cn: evaluation?.feedback_cn?.trim() || "该口语作答已完成自动评分。",
      taskCompletion_en: evaluation?.taskCompletion_en?.trim() || "Task completion was reviewed automatically.",
      taskCompletion_cn: evaluation?.taskCompletion_cn?.trim() || "任务完成度已完成自动评估。",
      fluency_en: evaluation?.fluency_en?.trim() || "Fluency was reviewed automatically.",
      fluency_cn: evaluation?.fluency_cn?.trim() || "流利度已完成自动评估。",
      vocabulary_en: evaluation?.vocabulary_en?.trim() || "Vocabulary use was reviewed automatically.",
      vocabulary_cn: evaluation?.vocabulary_cn?.trim() || "词汇使用已完成自动评估。",
      grammar_en: evaluation?.grammar_en?.trim() || "Grammar control was reviewed automatically.",
      grammar_cn: evaluation?.grammar_cn?.trim() || "语法使用已完成自动评估。",
      pronunciation_en: evaluation?.pronunciation_en?.trim() || "Pronunciation and clarity were reviewed automatically.",
      pronunciation_cn: evaluation?.pronunciation_cn?.trim() || "发音与清晰度已完成自动评估。",
      suggestions_en: toNonEmptyStringArray(evaluation?.suggestions_en, [
        "Answer the prompt more directly before adding extra details.",
        "Slow down slightly and aim for clearer sentence control.",
      ]),
      suggestions_cn: toNonEmptyStringArray(evaluation?.suggestions_cn, [
        "先更直接地回应题目，再补充细节。",
        "适当放慢速度，尽量让句子表达更清楚。",
      ]),
      reviewMode: "ai",
      manualReviewRequired: false,
    };
  });

  const totalScore = normalizedEvaluations.reduce((sum, item) => sum + item.score, 0);
  const totalPossible = normalizedEvaluations.reduce((sum, item) => sum + item.maxScore, 0);

  return {
    totalScore,
    totalPossible,
    grade: getLetterGrade(totalScore, totalPossible),
    overallFeedback_en: parsed.overallFeedback_en.trim(),
    overallFeedback_cn: parsed.overallFeedback_cn.trim(),
    evaluations: normalizedEvaluations,
    reviewMode: "ai",
    manualReviewRequired: false,
  };
}

async function evaluateSpeakingWithAI(
  req: Pick<TrpcContext["req"], "headers" | "protocol">,
  responses: Array<{
    sectionId: string;
    sectionTitle: string;
    questionId: number;
    prompt: string;
    audioUrl: string;
  }>,
): Promise<SpeakingEvaluationResult> {
  if (ENV.aiGatewayApiKey) {
    try {
      return await evaluateSpeakingWithGatewayAudio(req, responses);
    } catch (error) {
      console.error("[grading.evaluateSpeaking] Gateway audio scoring failed, trying transcription fallback:", error);
    }
  }

  try {
    return await evaluateSpeakingWithTranscriptAI(req, responses);
  } catch (error) {
    console.error("[grading.evaluateSpeaking] Falling back to manual review:", error);
    return buildManualSpeakingEvaluation(responses);
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
