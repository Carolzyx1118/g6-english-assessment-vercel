import {
  getPaperById,
  type Paper,
  type Question,
  type Section,
  type WritingQuestion,
} from "@/data/papers";
import { isAudioAnswerValue } from "@/lib/audioStorage";
import { normalizeVocabularyAnswer } from "@/lib/vocabularyWordHelpers";
import { parseStoredAssessmentPayload } from "@/lib/storedAssessmentPayload";
import type {
  AssessmentReportResult,
  SpeakingEvaluationResult,
  SpeakingQuestionEvaluation,
} from "@shared/assessmentReport";

export const DEFAULT_MANUAL_SPEAKING_MAX_SCORE = 5;

export type ReviewLocale = "cn" | "en";
export type ReviewSectionKind =
  | "vocabulary"
  | "grammar"
  | "listening"
  | "reading"
  | "writing"
  | "speaking"
  | "other";

export type ReadingGradingResult = {
  questionId: string;
  isCorrect: boolean;
  score: number;
  referenceAnswer?: string;
  feedback_en: string;
  feedback_cn: string;
  explanation_en: string;
  explanation_cn: string;
};

export type WritingEvaluationResult = {
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
  correctedEssay: string;
  annotatedEssay: string;
  suggestions_en: string[];
  suggestions_cn: string[];
  reviewMode?: "ai" | "manual";
  manualReviewRequired?: boolean;
};

export type ExplanationResult = {
  questionId: number;
  explanation_en: string;
  explanation_cn: string;
  tip_en: string;
  tip_cn: string;
};

export interface AssessmentReviewRecord {
  id?: number;
  studentName: string;
  studentGrade: string | null;
  paperId: string;
  paperTitle: string;
  totalCorrect: number;
  totalQuestions: number;
  totalTimeSeconds: number | null;
  answersJson: string;
  scoreBySectionJson: string | null;
  sectionTimingsJson: string | null;
  readingResultsJson: string | null;
  writingResultJson: string | null;
  explanationsJson: string | null;
  reportJson: string | null;
  createdAt: string | Date;
}

export interface QuestionReviewOption {
  label: string;
  text: string;
  imageUrl?: string;
  isCorrect: boolean;
  isSelected: boolean;
}

export interface QuestionReviewDetail {
  id: string;
  sectionId: string;
  sectionTitle: string;
  sectionKind: ReviewSectionKind;
  sourceQuestionId: number;
  questionType: Question["type"] | "open-ended-sub";
  sourceQuestion: Question;
  questionNum: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isAnswered: boolean;
  taskDescription?: string;
  sectionDescription?: string;
  sectionPassage?: string;
  sectionGrammarPassage?: string;
  sectionImageUrl?: string;
  questionImageUrl?: string;
  sceneImageUrl?: string;
  matchingDescriptions?: NonNullable<Section["matchingDescriptions"]>;
  wordBank?: NonNullable<Section["wordBank"]>;
  focusItemKey?: string;
  context?: string;
  options?: QuestionReviewOption[];
  explanationEn?: string;
  explanationCn?: string;
  tipEn?: string;
  tipCn?: string;
}

export interface SectionReviewSummary {
  sectionId: string;
  sectionTitle: string;
  kind: ReviewSectionKind;
  correct: number;
  total: number;
  percentage: number;
  timeSeconds: number;
  manualReview: boolean;
  details: QuestionReviewDetail[];
}

export interface WritingReviewData {
  sectionId: string;
  sectionTitle: string;
  question: WritingQuestion;
  essay: string;
  evaluation: WritingEvaluationResult | null;
  manualReview: boolean;
}

export interface SpeakingReviewData {
  evaluation: SpeakingEvaluationResult | null;
  manualReview: boolean;
}

export interface AssessmentReviewModel {
  paper: Paper | null;
  answers: Record<string, unknown>;
  report: AssessmentReportResult | null;
  readingResults: ReadingGradingResult[];
  writingResult: WritingEvaluationResult | null;
  explanations: ExplanationResult[];
  speakingEvaluation: SpeakingEvaluationResult | null;
  sections: SectionReviewSummary[];
  writing: WritingReviewData | null;
  speaking: SpeakingReviewData;
  totalScore: number;
  totalPossible: number;
  percentage: number;
  grade: string;
  totalTimeSeconds: number;
}

export interface ReadingInputCandidate {
  questionId: string;
  sectionId: string;
  sectionTitle: string;
  questionType: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  context?: string;
}

export interface WrongAnswerExplanationCandidate {
  questionId: number;
  sectionType: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  context?: string;
}

export interface WritingTaskCandidate {
  sectionId: string;
  sectionTitle: string;
  question: WritingQuestion;
  essay: string;
}

export interface SpeakingResponseCandidate {
  sectionId: string;
  sectionTitle: string;
  questionId: number;
  prompt: string;
  audioUrl: string;
}

function buildPendingSpeakingQuestionEvaluation(
  response: SpeakingResponseCandidate,
): SpeakingQuestionEvaluation {
  return {
    sectionId: response.sectionId,
    sectionTitle: response.sectionTitle,
    questionId: response.questionId,
    prompt: response.prompt,
    audioUrl: response.audioUrl,
    transcript: "",
    score: 0,
    maxScore: DEFAULT_MANUAL_SPEAKING_MAX_SCORE,
    grade: "Manual Review",
    feedback_en: "The recording was saved successfully. Teacher speaking review is pending.",
    feedback_cn: "录音已保存，等待老师完成口语评分。",
    taskCompletion_en: "",
    taskCompletion_cn: "",
    fluency_en: "",
    fluency_cn: "",
    vocabulary_en: "",
    vocabulary_cn: "",
    grammar_en: "",
    grammar_cn: "",
    pronunciation_en: "",
    pronunciation_cn: "",
    suggestions_en: [],
    suggestions_cn: [],
    reviewMode: "manual",
    manualReviewRequired: true,
  };
}

export function createPendingSpeakingEvaluation(
  responses: SpeakingResponseCandidate[],
): SpeakingEvaluationResult {
  return {
    totalScore: 0,
    totalPossible: 0,
    grade: "Manual Review",
    overallFeedback_en:
      responses.length > 0
        ? "Student recordings were saved successfully. Teacher speaking review is pending in Test History."
        : "No speaking responses were submitted.",
    overallFeedback_cn:
      responses.length > 0
        ? "学生录音已成功保存，等待老师在 Test History 中完成口语评分。"
        : "未提交口语作答。",
    evaluations: responses.map(buildPendingSpeakingQuestionEvaluation),
    reviewMode: "manual",
    manualReviewRequired: true,
  };
}

export function finalizeManualSpeakingEvaluation(input: {
  evaluations: SpeakingQuestionEvaluation[];
  overallFeedback_en?: string;
  overallFeedback_cn?: string;
}): SpeakingEvaluationResult {
  const evaluations = input.evaluations.map((item) => {
    const maxScore = item.maxScore > 0 ? item.maxScore : DEFAULT_MANUAL_SPEAKING_MAX_SCORE;
    const score = Math.max(0, Math.min(maxScore, Number.isFinite(item.score) ? item.score : 0));
    return {
      ...item,
      score,
      maxScore,
      grade: getLetterGrade(score, maxScore),
      reviewMode: "manual" as const,
      manualReviewRequired: false,
    };
  });

  const totalScore = evaluations.reduce((sum, item) => sum + item.score, 0);
  const totalPossible = evaluations.reduce((sum, item) => sum + item.maxScore, 0);

  return {
    totalScore,
    totalPossible,
    grade: totalPossible > 0 ? getLetterGrade(totalScore, totalPossible) : "Manual Review",
    overallFeedback_en: input.overallFeedback_en?.trim() || "Teacher speaking review has been saved.",
    overallFeedback_cn: input.overallFeedback_cn?.trim() || "老师口语评分已保存。",
    evaluations,
    reviewMode: "manual",
    manualReviewRequired: false,
  };
}

export interface SubmissionArtifacts {
  objectiveTotals: { correct: number; total: number };
  objectiveBySection: Record<string, { correct: number; total: number }>;
  readingInputs: ReadingInputCandidate[];
  wrongObjectiveAnswers: WrongAnswerExplanationCandidate[];
  writingTask: WritingTaskCandidate | null;
  speakingResponses: SpeakingResponseCandidate[];
}

const SECTION_LABELS: Record<string, { en: string; cn: string }> = {
  vocabulary: { en: "Vocabulary", cn: "词汇" },
  grammar: { en: "Grammar", cn: "语法" },
  listening: { en: "Listening", cn: "听力" },
  reading: { en: "Reading", cn: "阅读" },
  writing: { en: "Writing", cn: "写作" },
  speaking: { en: "Speaking", cn: "口语" },
};

function normalizeSimpleText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+([?.!,;:])/g, "$1");
}

function normalizeSentenceAnswer(value: string) {
  return normalizeSimpleText(value);
}

function parseSerializedRecord(value: unknown): Record<string, unknown> {
  try {
    if (typeof value === "string") {
      return JSON.parse(value) as Record<string, unknown>;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed data and fall back to an empty record.
  }

  return {};
}

function getChoiceIndex(record: Record<string, unknown>, label: string) {
  const raw = record[label];
  const selectedIndex = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(selectedIndex) ? selectedIndex : undefined;
}

function sortUniqueNumbers(values: number[]) {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

function getSelectedIndexes(answer: unknown) {
  if (Array.isArray(answer)) {
    return sortUniqueNumbers(
      answer.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    );
  }
  if (typeof answer === "number" && Number.isFinite(answer)) {
    return [answer];
  }
  return [];
}

function extractAudioAnswers(value: unknown): string[] {
  if (typeof value === "string") {
    if (isAudioAnswerValue(value)) {
      return [value];
    }

    if ((value.startsWith("{") || value.startsWith("[")) && value.length > 1) {
      try {
        return extractAudioAnswers(JSON.parse(value));
      } catch {
        return [];
      }
    }

    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractAudioAnswers(entry));
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => extractAudioAnswers(entry));
  }

  return [];
}

function isAnsweredValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function getOptionDisplay(option: string | { label?: string; text?: string; imageUrl?: string } | undefined) {
  if (!option) return "";
  return typeof option === "string" ? option : option.text || option.label || "";
}

function getOptionLabel(index: number, option: string | { label?: string; text?: string; imageUrl?: string } | undefined) {
  if (option && typeof option !== "string" && option.label) return option.label;
  return String.fromCharCode(65 + index);
}

function buildReviewOptions(
  rawOptions: Array<string | { label?: string; text?: string; imageUrl?: string }>,
  selectedIndexes: number[],
  correctIndexes: number[],
): QuestionReviewOption[] {
  return rawOptions.map((option, index) => ({
    label: getOptionLabel(index, option),
    text: getOptionDisplay(option),
    imageUrl: option && typeof option !== "string" ? option.imageUrl : undefined,
    isCorrect: correctIndexes.includes(index),
    isSelected: selectedIndexes.includes(index),
  }));
}

function getMCQCorrectIndexes(
  question: Extract<Question, { type: "mcq" | "picture-mcq" | "listening-mcq" }>,
) {
  if (question.correctAnswers && question.correctAnswers.length > 0) {
    return sortUniqueNumbers(question.correctAnswers);
  }
  return typeof question.correctAnswer === "number" ? [question.correctAnswer] : [];
}

function formatPassageInlinePrompt(
  prompt: string,
  item: { label: string; options: string[] },
) {
  const blankPrompt = `Blank ${item.label}: ${item.options.join(" / ")}`;
  return prompt ? `${prompt} - ${blankPrompt}` : blankPrompt;
}

function normalizeTrueFalseChoice(value: unknown): "True" | "False" | "Not Given" | undefined {
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return "True";
  if (normalized === "false") return "False";
  if (normalized === "not given" || normalized === "not-given" || normalized === "not_given") {
    return "Not Given";
  }
  return undefined;
}

function getExpectedTrueFalseChoice(statement: {
  isTrue?: boolean;
  correctChoice?: "True" | "False" | "Not Given";
}) {
  if (statement.correctChoice) return statement.correctChoice;
  if (statement.isTrue === true) return "True";
  if (statement.isTrue === false) return "False";
  return "Not Given";
}

function sentenceReorderAnswerToString(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join(" ");
  }
  return typeof value === "string" ? value : "";
}

function inferSectionKind(section: Section): ReviewSectionKind {
  if (section.questions.some((question) => question.type === "writing")) return "writing";
  if (
    section.questions.some(
      (question) => question.type === "open-ended" && question.responseMode === "audio",
    )
  ) {
    return "speaking";
  }

  const normalized = `${section.sectionType || ""} ${section.id} ${section.title}`.trim().toLowerCase();
  if (normalized.includes("speaking")) return "speaking";
  if (normalized.includes("writing")) return "writing";
  if (normalized.includes("listening")) return "listening";
  if (normalized.includes("reading")) return "reading";
  if (normalized.includes("vocabulary")) return "vocabulary";
  if (normalized.includes("grammar")) return "grammar";
  return "other";
}

function buildReadingLookupKey(sectionId: string, localKey: string) {
  return `${sectionId}::${localKey}`;
}

function buildScopedQuestionId(sectionId: string, questionId: number) {
  const hash = Array.from(sectionId.toLowerCase()).reduce(
    (accumulator, character) => ((accumulator * 31) + character.charCodeAt(0)) % 1_000_000,
    7,
  );
  return (hash * 1_000) + questionId;
}

function getReadingResult(
  readingResults: Map<string, ReadingGradingResult>,
  sectionId: string,
  localKey: string,
) {
  return (
    readingResults.get(buildReadingLookupKey(sectionId, localKey))
    || readingResults.get(localKey)
    || null
  );
}

function isManualWritingReview(result: WritingEvaluationResult | null | undefined) {
  return Boolean(
    result
    && (result.manualReviewRequired || (result.reviewMode === "manual" && result.maxScore === 0 && result.grade === "Manual Review"))
  );
}

function findMaterialBlockForQuestion(section: Section, questionId: number) {
  return section.manualBlocks?.find((block) => block.questionIds.includes(questionId)) || null;
}

function getQuestionImageUrl(question: Question) {
  if ("imageUrl" in question && typeof question.imageUrl === "string") {
    return question.imageUrl || undefined;
  }
  return undefined;
}

function buildQuestionMaterialBase(
  section: Section,
  question: Question,
  scopedQuestionId: number,
) {
  const materialBlock = findMaterialBlockForQuestion(section, question.id);

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    sectionKind: inferSectionKind(section),
    sourceQuestionId: scopedQuestionId,
    questionType: question.type,
    sourceQuestion: question,
    taskDescription: materialBlock?.taskDescription || section.taskDescription,
    sectionDescription: materialBlock?.instructions || section.description,
    sectionPassage: materialBlock?.passage || ("passageText" in question ? question.passageText : undefined) || section.passage,
    sectionGrammarPassage: materialBlock?.grammarPassage || section.grammarPassage,
    sectionImageUrl: section.imageUrl,
    questionImageUrl: getQuestionImageUrl(question),
    sceneImageUrl: materialBlock?.sceneImageUrl || section.sceneImageUrl,
    matchingDescriptions: materialBlock?.matchingDescriptions || section.matchingDescriptions,
    wordBank: materialBlock?.wordBank || section.wordBank,
  };
}

export function isManualSpeakingReview(result: SpeakingEvaluationResult | null | undefined) {
  return Boolean(
    result
    && (result.manualReviewRequired || (result.reviewMode === "manual" && result.totalPossible === 0 && result.grade === "Manual Review"))
  );
}

export function safeParseJSON<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function getSectionDisplayName(sectionTitle: string, sectionId: string, locale: ReviewLocale) {
  const normalizedTitle = sectionTitle.trim().toLowerCase();
  const normalizedId = sectionId.trim().toLowerCase();
  if (SECTION_LABELS[normalizedTitle]) {
    return locale === "cn" ? SECTION_LABELS[normalizedTitle].cn : SECTION_LABELS[normalizedTitle].en;
  }
  if (SECTION_LABELS[normalizedId]) {
    return locale === "cn" ? SECTION_LABELS[normalizedId].cn : SECTION_LABELS[normalizedId].en;
  }
  return sectionTitle;
}

export function formatDuration(seconds: number, locale: ReviewLocale) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return locale === "cn"
    ? `${mins}分${secs.toString().padStart(2, "0")}秒`
    : `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function getLetterGrade(score: number, total: number) {
  if (total <= 0) return "D";
  const pct = Math.round((score / total) * 100);
  if (pct >= 90) return "A";
  if (pct >= 75) return "B";
  if (pct >= 60) return "C";
  return "D";
}

function buildQuestionDetailsForSection(
  section: Section,
  answers: Record<string, unknown>,
  explanationMap: Map<number, ExplanationResult>,
  readingResultMap: Map<string, ReadingGradingResult>,
): QuestionReviewDetail[] {
  const details: QuestionReviewDetail[] = [];

  for (const question of section.questions) {
    if (question.type === "writing") continue;
    if (question.type === "open-ended" && question.responseMode === "audio") continue;

    const key = `${section.id}:${question.id}`;
    const rawAnswer = answers[key];
    const scopedQuestionId = buildScopedQuestionId(section.id, question.id);
    const explanation = explanationMap.get(scopedQuestionId) || explanationMap.get(question.id);
    const base = buildQuestionMaterialBase(section, question, scopedQuestionId);

    if (question.type === "picture-mcq" || question.type === "listening-mcq") {
      const selectedIndexes = getSelectedIndexes(rawAnswer);
      const correctIndexes = getMCQCorrectIndexes(question);
      const isAnswered = selectedIndexes.length > 0;
      const isCorrect = JSON.stringify(selectedIndexes) === JSON.stringify(correctIndexes);
      details.push({
        ...base,
        id: `${section.id}:${question.id}`,
        questionNum: `Q${question.id}`,
        questionText: question.question,
        userAnswer: isAnswered
          ? selectedIndexes.map((index) => question.options[index]?.text || question.options[index]?.label || `Option ${index + 1}`).join(", ")
          : "Not Answered",
        correctAnswer: correctIndexes.map((index) => question.options[index]?.text || question.options[index]?.label || `Option ${index + 1}`).join(", "),
        isCorrect: isAnswered && isCorrect,
        isAnswered,
        options: buildReviewOptions(question.options, selectedIndexes, correctIndexes),
        explanationEn: explanation?.explanation_en,
        explanationCn: explanation?.explanation_cn,
        tipEn: explanation?.tip_en,
        tipCn: explanation?.tip_cn,
        context: base.sectionPassage,
      });
      continue;
    }

    if (question.type === "mcq") {
      const correctIndexes = getMCQCorrectIndexes(question);
      const multiSelect = (question.selectionLimit ?? 1) > 1 || correctIndexes.length > 1;

      if (multiSelect) {
        const selectedIndexes = getSelectedIndexes(rawAnswer);
        const isAnswered = selectedIndexes.length > 0;
        const isCorrect = JSON.stringify(selectedIndexes) === JSON.stringify(correctIndexes);
        details.push({
          ...base,
          id: `${section.id}:${question.id}`,
          questionNum: `Q${question.id}`,
          questionText: question.question.replace("___", question.highlightWord || "___"),
          userAnswer: isAnswered
            ? selectedIndexes.map((index) => getOptionDisplay(question.options[index])).join(", ")
            : "Not Answered",
          correctAnswer: correctIndexes.map((index) => getOptionDisplay(question.options[index])).join(", "),
          isCorrect: isAnswered && isCorrect,
          isAnswered,
          options: buildReviewOptions(question.options, selectedIndexes, correctIndexes),
          explanationEn: explanation?.explanation_en,
          explanationCn: explanation?.explanation_cn,
          tipEn: explanation?.tip_en,
          tipCn: explanation?.tip_cn,
          context: base.sectionPassage,
        });
        continue;
      }

      if (typeof question.correctAnswer === "number") {
        const selectedIndex = isAnsweredValue(rawAnswer) ? Number(rawAnswer) : -1;
        const isAnswered = selectedIndex >= 0;
        details.push({
          ...base,
          id: `${section.id}:${question.id}`,
          questionNum: `Q${question.id}`,
          questionText: question.question.replace("___", question.highlightWord || "___"),
          userAnswer: isAnswered ? getOptionDisplay(question.options[selectedIndex]) : "Not Answered",
          correctAnswer: getOptionDisplay(question.options[question.correctAnswer]),
          isCorrect: isAnswered && selectedIndex === question.correctAnswer,
          isAnswered,
          options: buildReviewOptions(question.options, isAnswered ? [selectedIndex] : [], [question.correctAnswer]),
          explanationEn: explanation?.explanation_en,
          explanationCn: explanation?.explanation_cn,
          tipEn: explanation?.tip_en,
          tipCn: explanation?.tip_cn,
          context: base.sectionPassage,
        });
        continue;
      }

      const selectedIndex = isAnsweredValue(rawAnswer) ? Number(rawAnswer) : -1;
      const selectedText = selectedIndex >= 0
        ? getOptionDisplay(question.options[selectedIndex])
        : isAnsweredValue(rawAnswer)
          ? String(rawAnswer)
          : "Not Answered";
      const expectedText = String(question.correctAnswer);
      const matchingIndexes = question.options
        .map((option, index) => ({ option, index }))
        .filter(({ option }) => normalizeSimpleText(getOptionDisplay(option)) === normalizeSimpleText(expectedText))
        .map(({ index }) => index);
      details.push({
        ...base,
        id: `${section.id}:${question.id}`,
        questionNum: `Q${question.id}`,
        questionText: question.question.replace("___", question.highlightWord || "___"),
        userAnswer: selectedText,
        correctAnswer: expectedText,
        isCorrect: isAnsweredValue(rawAnswer) && normalizeSimpleText(selectedText) === normalizeSimpleText(expectedText),
        isAnswered: isAnsweredValue(rawAnswer),
        options: buildReviewOptions(question.options, selectedIndex >= 0 ? [selectedIndex] : [], matchingIndexes),
        explanationEn: explanation?.explanation_en,
        explanationCn: explanation?.explanation_cn,
        tipEn: explanation?.tip_en,
        tipCn: explanation?.tip_cn,
        context: base.sectionPassage,
      });
      continue;
    }

    if (question.type === "fill-blank") {
      const rawText = typeof rawAnswer === "string" ? rawAnswer : "";
      const wordBank = base.wordBank;
      const correctEntry = wordBank?.find((entry) => entry.letter === question.correctAnswer);
      const selectedEntry = wordBank?.find((entry) => entry.letter === rawText);
      const userDisplay = rawText.trim()
        ? selectedEntry
          ? `${selectedEntry.letter} (${selectedEntry.word})`
          : rawText
        : "Not Answered";
      const correctDisplay = correctEntry
        ? `${correctEntry.letter} (${correctEntry.word})`
        : question.correctAnswer;
      const correctIndexes = wordBank
        ? wordBank
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => entry.letter === question.correctAnswer)
            .map(({ index }) => index)
        : [];
      const selectedIndexes = wordBank
        ? wordBank
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => entry.letter === rawText)
            .map(({ index }) => index)
        : [];

      details.push({
        ...base,
        id: `${section.id}:${question.id}`,
        questionNum: `Q${question.id}`,
        questionText: question.question || `Fill in blank ${question.id}`,
        userAnswer: userDisplay,
        correctAnswer: correctDisplay,
        isCorrect: rawText.trim().length > 0 && normalizeSimpleText(rawText) === normalizeSimpleText(question.correctAnswer),
        isAnswered: rawText.trim().length > 0,
        options: wordBank
          ? buildReviewOptions(
              wordBank.map((entry) => `${entry.letter} (${entry.word})`),
              selectedIndexes,
              correctIndexes,
            )
          : undefined,
        explanationEn: explanation?.explanation_en,
        explanationCn: explanation?.explanation_cn,
        tipEn: explanation?.tip_en,
        tipCn: explanation?.tip_cn,
        context: base.sectionPassage,
      });
      continue;
    }

    if (question.type === "wordbank-fill" || question.type === "story-fill") {
      const readingResult = getReadingResult(readingResultMap, section.id, String(question.id));
      const rawText = typeof rawAnswer === "string" ? rawAnswer : "";
      const acceptableAnswers = question.type === "story-fill" ? (question.acceptableAnswers || []) : [];
      const localCorrect = rawText.trim().length > 0 && (
        normalizeSimpleText(rawText) === normalizeSimpleText(question.correctAnswer)
        || acceptableAnswers.some((item) => normalizeSimpleText(rawText) === normalizeSimpleText(item))
      );

      details.push({
        ...base,
        id: `${section.id}:${question.id}`,
        questionNum: `Q${question.id}`,
        questionText: question.question,
        userAnswer: rawText.trim().length > 0 ? rawText : "Not Answered",
        correctAnswer: question.correctAnswer,
        isCorrect: readingResult ? readingResult.isCorrect : localCorrect,
        isAnswered: rawText.trim().length > 0,
        explanationEn: readingResult?.explanation_en || explanation?.explanation_en,
        explanationCn: readingResult?.explanation_cn || explanation?.explanation_cn,
        tipEn: explanation?.tip_en,
        tipCn: explanation?.tip_cn,
        context: base.sectionPassage,
      });
      continue;
    }

    if (question.type === "picture-spelling" || question.type === "word-completion") {
      const rawText = typeof rawAnswer === "string" ? rawAnswer : "";
      details.push({
        ...base,
        id: `${section.id}:${question.id}`,
        questionNum: `Q${question.id}`,
        questionText: question.question,
        userAnswer: rawText.trim().length > 0 ? rawText : "Not Answered",
        correctAnswer: question.correctAnswer,
        isCorrect: rawText.trim().length > 0 && normalizeVocabularyAnswer(rawText) === normalizeVocabularyAnswer(question.correctAnswer),
        isAnswered: rawText.trim().length > 0,
        explanationEn: explanation?.explanation_en,
        explanationCn: explanation?.explanation_cn,
        tipEn: explanation?.tip_en,
        tipCn: explanation?.tip_cn,
        context: base.sectionPassage,
      });
      continue;
    }

    if (question.type === "checkbox") {
      const selectedIndexes = Array.isArray(rawAnswer)
        ? rawAnswer.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        : [];
      const correctIndexes = sortUniqueNumbers(question.correctAnswers);
      details.push({
        ...base,
        id: `${section.id}:${question.id}`,
        questionNum: `Q${question.id}`,
        questionText: question.question,
        userAnswer: selectedIndexes.length > 0
          ? selectedIndexes.map((index) => getOptionDisplay(question.options[index])).join(", ")
          : "Not Answered",
        correctAnswer: correctIndexes.map((index) => getOptionDisplay(question.options[index])).join(", "),
        isCorrect: JSON.stringify(sortUniqueNumbers(selectedIndexes)) === JSON.stringify(correctIndexes),
        isAnswered: selectedIndexes.length > 0,
        options: buildReviewOptions(question.options, selectedIndexes, correctIndexes),
        explanationEn: explanation?.explanation_en,
        explanationCn: explanation?.explanation_cn,
        tipEn: explanation?.tip_en,
        tipCn: explanation?.tip_cn,
        context: base.sectionPassage,
      });
      continue;
    }

    if (question.type === "true-false") {
      const parsed = parseSerializedRecord(rawAnswer);
      const options = ["True", "False", "Not Given"];
      for (const statement of question.statements) {
        const rawChoice = parsed[statement.label];
        const userChoice = normalizeTrueFalseChoice(
          rawChoice && typeof rawChoice === "object" && "tf" in rawChoice
            ? (rawChoice as { tf?: unknown }).tf
            : rawChoice,
        );
        const correctChoice = getExpectedTrueFalseChoice(statement);
        const readingResult = getReadingResult(readingResultMap, section.id, `${question.id}-${statement.label}`);
        details.push({
          ...base,
          id: `${section.id}:${question.id}:${statement.label}`,
          questionNum: `Q${question.id}(${statement.label})`,
          questionText: `${question.question || "State whether each statement is True, False, or Not Given."} - ${statement.statement}`,
          userAnswer: userChoice || "Not Answered",
          correctAnswer: correctChoice,
          isCorrect: readingResult ? readingResult.isCorrect : userChoice === correctChoice,
          isAnswered: Boolean(userChoice),
          options: buildReviewOptions(
            options,
            userChoice ? [options.indexOf(userChoice)].filter((value) => value >= 0) : [],
            [options.indexOf(correctChoice)].filter((value) => value >= 0),
          ),
          explanationEn: readingResult?.explanation_en,
          explanationCn: readingResult?.explanation_cn,
          focusItemKey: statement.label,
          context: base.sectionPassage,
        });
      }
      continue;
    }

    if (question.type === "table") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.rows.forEach((row, index) => {
        const localKey = `${question.id}-${String.fromCharCode(97 + index)}`;
        const readingResult = getReadingResult(readingResultMap, section.id, localKey);
        const nestedRow = parsed[String(index)];
        const nestedValue = nestedRow && typeof nestedRow === "object"
          ? (nestedRow as Record<string, unknown>)[row.blankField]
          : undefined;
        const rawText = typeof nestedValue === "string"
          ? nestedValue
          : typeof parsed[`row${index}`] === "string"
            ? String(parsed[`row${index}`])
            : typeof parsed[row.blankField + index] === "string"
              ? String(parsed[row.blankField + index])
              : "";
        details.push({
          ...base,
          id: `${section.id}:${localKey}`,
          questionNum: `Q${question.id}(${String.fromCharCode(97 + index)})`,
          questionText: `Complete the table for "${row.situation}"`,
          userAnswer: rawText.trim().length > 0 ? rawText : "Not Answered",
          correctAnswer: row.answer,
          isCorrect: readingResult ? readingResult.isCorrect : normalizeSimpleText(rawText) === normalizeSimpleText(row.answer),
          isAnswered: rawText.trim().length > 0,
          explanationEn: readingResult?.explanation_en,
          explanationCn: readingResult?.explanation_cn,
          focusItemKey: String(index),
          context: base.sectionPassage,
        });
      });
      continue;
    }

    if (question.type === "reference") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item, index) => {
        const localKey = `${question.id}-${String.fromCharCode(97 + index)}`;
        const readingResult = getReadingResult(readingResultMap, section.id, localKey);
        const rawText = typeof parsed[String(index)] === "string" ? String(parsed[String(index)]) : "";
        details.push({
          ...base,
          id: `${section.id}:${localKey}`,
          questionNum: `Q${question.id}(${String.fromCharCode(97 + index)})`,
          questionText: `What does "${item.word}" ${item.lineRef ? `(${item.lineRef})` : ""} refer to?`.trim(),
          userAnswer: rawText.trim().length > 0 ? rawText : "Not Answered",
          correctAnswer: item.answer,
          isCorrect: readingResult ? readingResult.isCorrect : normalizeSimpleText(rawText) === normalizeSimpleText(item.answer),
          isAnswered: rawText.trim().length > 0,
          explanationEn: readingResult?.explanation_en,
          explanationCn: readingResult?.explanation_cn,
          focusItemKey: String(index),
          context: base.sectionPassage,
        });
      });
      continue;
    }

    if (question.type === "order") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.events.forEach((event, index) => {
        const localKey = `${question.id}-${String.fromCharCode(97 + index)}`;
        const readingResult = getReadingResult(readingResultMap, section.id, localKey);
        const rawText = typeof parsed[String(index)] === "string" ? String(parsed[String(index)]) : "";
        const correctText = String(question.correctOrder[index]);
        details.push({
          ...base,
          id: `${section.id}:${localKey}`,
          questionNum: `Q${question.id}(${String.fromCharCode(97 + index)})`,
          questionText: `Put this event in order: ${event}`,
          userAnswer: rawText.trim().length > 0 ? `Position ${rawText}` : "Not Answered",
          correctAnswer: `Position ${correctText}`,
          isCorrect: readingResult ? readingResult.isCorrect : normalizeSimpleText(rawText) === normalizeSimpleText(correctText),
          isAnswered: rawText.trim().length > 0,
          explanationEn: readingResult?.explanation_en,
          explanationCn: readingResult?.explanation_cn,
          focusItemKey: String(index),
          context: base.sectionPassage,
        });
      });
      continue;
    }

    if (question.type === "phrase") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item, index) => {
        const localKey = `${question.id}-${String.fromCharCode(97 + index)}`;
        const readingResult = getReadingResult(readingResultMap, section.id, localKey);
        const rawText = typeof parsed[String(index)] === "string" ? String(parsed[String(index)]) : "";
        details.push({
          ...base,
          id: `${section.id}:${localKey}`,
          questionNum: `Q${question.id}(${String.fromCharCode(97 + index)})`,
          questionText: item.clue,
          userAnswer: rawText.trim().length > 0 ? rawText : "Not Answered",
          correctAnswer: item.answer,
          isCorrect: readingResult ? readingResult.isCorrect : normalizeSimpleText(rawText) === normalizeSimpleText(item.answer),
          isAnswered: rawText.trim().length > 0,
          explanationEn: readingResult?.explanation_en,
          explanationCn: readingResult?.explanation_cn,
          focusItemKey: String(index),
          context: base.sectionPassage,
        });
      });
      continue;
    }

    if (question.type === "sentence-reorder") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item) => {
        const rawValue = parsed[item.label];
        const userSentence = sentenceReorderAnswerToString(rawValue);
        details.push({
          ...base,
          id: `${section.id}:${question.id}:${item.label}`,
          questionNum: `Q${question.id}(${item.label})`,
          questionText: `Reorder the sentence: ${item.scrambledWords}`,
          userAnswer: userSentence || "Not Answered",
          correctAnswer: item.correctAnswer,
          isCorrect: userSentence.length > 0 && normalizeSentenceAnswer(userSentence) === normalizeSentenceAnswer(item.correctAnswer),
          isAnswered: userSentence.length > 0,
          explanationEn: explanation?.explanation_en,
          explanationCn: explanation?.explanation_cn,
          tipEn: explanation?.tip_en,
          tipCn: explanation?.tip_cn,
          focusItemKey: item.label,
          context: base.sectionPassage,
        });
      });
      continue;
    }

    if (question.type === "inline-word-choice") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item) => {
        const selectedIndex = getChoiceIndex(parsed, item.label);
        const isAnswered = selectedIndex !== undefined && selectedIndex >= 0;
        details.push({
          ...base,
          id: `${section.id}:${question.id}:${item.label}`,
          questionNum: `Q${question.id}(${item.label})`,
          questionText: item.sentenceText || `${item.beforeText} ___ ${item.afterText}`.trim(),
          userAnswer: isAnswered ? item.options[selectedIndex] || "Not Answered" : "Not Answered",
          correctAnswer: item.options[item.correctAnswer] || "",
          isCorrect: isAnswered && selectedIndex === item.correctAnswer,
          isAnswered,
          options: buildReviewOptions(item.options, isAnswered ? [selectedIndex] : [], [item.correctAnswer]),
          explanationEn: explanation?.explanation_en,
          explanationCn: explanation?.explanation_cn,
          tipEn: explanation?.tip_en,
          tipCn: explanation?.tip_cn,
          focusItemKey: item.label,
          context: base.sectionPassage,
        });
      });
      continue;
    }

    if (question.type === "passage-inline-word-choice") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item) => {
        const selectedIndex = getChoiceIndex(parsed, item.label);
        const readingResult = getReadingResult(readingResultMap, section.id, `${question.id}-${item.label}`);
        const isAnswered = selectedIndex !== undefined && selectedIndex >= 0;
        details.push({
          ...base,
          id: `${section.id}:${question.id}:${item.label}`,
          questionNum: `Q${question.id}(${item.label})`,
          questionText: formatPassageInlinePrompt(question.question, item),
          userAnswer: isAnswered ? item.options[selectedIndex] || "Not Answered" : "Not Answered",
          correctAnswer: item.options[item.correctAnswer] || "",
          isCorrect: readingResult ? readingResult.isCorrect : (isAnswered && selectedIndex === item.correctAnswer),
          isAnswered,
          options: buildReviewOptions(item.options, isAnswered ? [selectedIndex] : [], [item.correctAnswer]),
          explanationEn: readingResult?.explanation_en || explanation?.explanation_en,
          explanationCn: readingResult?.explanation_cn || explanation?.explanation_cn,
          tipEn: explanation?.tip_en,
          tipCn: explanation?.tip_cn,
          focusItemKey: item.label,
          context: question.passageText || base.sectionPassage,
        });
      });
      continue;
    }

    if (question.type === "open-ended") {
      if (question.subQuestions && question.subQuestions.length > 0) {
        const parsed = parseSerializedRecord(rawAnswer);
        question.subQuestions.forEach((subQuestion) => {
          const readingResult = getReadingResult(readingResultMap, section.id, `${question.id}-${subQuestion.label}`);
          const rawText = typeof parsed[subQuestion.label] === "string" ? String(parsed[subQuestion.label]) : "";
          details.push({
            ...base,
            questionType: "open-ended-sub",
            id: `${section.id}:${question.id}:${subQuestion.label}`,
            questionNum: `Q${question.id}(${subQuestion.label})`,
            questionText: subQuestion.question,
            userAnswer: rawText.trim().length > 0 ? rawText : "Not Answered",
            correctAnswer: readingResult?.referenceAnswer || subQuestion.answer || "AI reference answer unavailable",
            isCorrect: readingResult
              ? readingResult.isCorrect
              : rawText.trim().length > 0
                ? String(subQuestion.answer || "")
                    .split("/")
                    .map((item) => normalizeSimpleText(item))
                    .filter(Boolean)
                    .includes(normalizeSimpleText(rawText))
                : false,
            isAnswered: rawText.trim().length > 0,
            explanationEn: readingResult?.explanation_en,
            explanationCn: readingResult?.explanation_cn,
            focusItemKey: subQuestion.label,
            context: base.sectionPassage,
          });
        });
        continue;
      }

      const readingResult = getReadingResult(readingResultMap, section.id, String(question.id));
      const audioAnswers = extractAudioAnswers(rawAnswer);
      const rawText = typeof rawAnswer === "string" && audioAnswers.length === 0 ? rawAnswer : "";
      const hasAudio = audioAnswers.length > 0;
      details.push({
        ...base,
        id: `${section.id}:${question.id}`,
        questionNum: `Q${question.id}`,
        questionText: question.question,
        userAnswer: hasAudio
          ? "Audio response submitted"
          : rawText.trim().length > 0
            ? rawText
            : "Not Answered",
        correctAnswer: readingResult?.referenceAnswer || question.answer || question.correctAnswer || "AI reference answer unavailable",
        isCorrect: readingResult
          ? readingResult.isCorrect
          : rawText.trim().length > 0
            ? String(question.correctAnswer || question.answer || "")
                .split("/")
                .map((item) => normalizeSimpleText(item))
                .filter(Boolean)
                .includes(normalizeSimpleText(rawText))
            : false,
        isAnswered: hasAudio || rawText.trim().length > 0,
        explanationEn: readingResult?.explanation_en,
        explanationCn: readingResult?.explanation_cn,
        context: base.sectionPassage,
      });
    }
  }

  return details;
}

function buildQuestionGroupSummary(details: QuestionReviewDetail[]) {
  const answeredDetails = details.filter((detail) => detail.isAnswered);
  const sectionTitle = details[0]?.sectionTitle || "";
  const baseQuestionText = details[0]?.questionText || "";

  return {
    questionId: details[0]?.sourceQuestionId || 0,
    sectionType: sectionTitle,
    questionText: details.length === 1
      ? baseQuestionText
      : `${sectionTitle} - ${baseQuestionText}`,
    userAnswer: answeredDetails.length > 0
      ? answeredDetails.map((detail) => `${detail.questionNum}: ${detail.userAnswer}`).join(" | ")
      : "Not Answered",
    correctAnswer: details.map((detail) => `${detail.questionNum}: ${detail.correctAnswer}`).join(" | "),
    context: details.find((detail) => detail.context)?.context,
  };
}

function buildReadingInputsForSection(
  section: Section,
  answers: Record<string, unknown>,
): ReadingInputCandidate[] {
  const inputs: ReadingInputCandidate[] = [];

  for (const question of section.questions) {
    const answerKey = `${section.id}:${question.id}`;
    const rawAnswer = answers[answerKey];

    if (question.type === "picture-mcq" || question.type === "listening-mcq") {
      const selectedIndexes = getSelectedIndexes(rawAnswer);
      const correctIndexes = getMCQCorrectIndexes(question);
      inputs.push({
        questionId: buildReadingLookupKey(section.id, String(question.id)),
        sectionId: section.id,
        sectionTitle: section.title,
        questionType: question.type,
        questionText: question.question,
        userAnswer: selectedIndexes.length > 0
          ? selectedIndexes.map((index) => question.options[index]?.text || question.options[index]?.label || `Option ${index + 1}`).join(", ")
          : "",
        correctAnswer: correctIndexes.map((index) => question.options[index]?.text || question.options[index]?.label || `Option ${index + 1}`).join(", "),
        context: section.passage,
      });
      continue;
    }

    if (question.type === "mcq") {
      const correctIndexes = getMCQCorrectIndexes(question);
      const multiSelect = (question.selectionLimit ?? 1) > 1 || correctIndexes.length > 1;

      if (multiSelect) {
        const selectedIndexes = getSelectedIndexes(rawAnswer);
        inputs.push({
          questionId: buildReadingLookupKey(section.id, String(question.id)),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: question.question,
          userAnswer: selectedIndexes.map((index) => getOptionDisplay(question.options[index])).join(", "),
          correctAnswer: correctIndexes.map((index) => getOptionDisplay(question.options[index])).join(", "),
          context: section.passage,
        });
        continue;
      }

      if (typeof question.correctAnswer === "number") {
        const selectedIndex = isAnsweredValue(rawAnswer) ? Number(rawAnswer) : -1;
        inputs.push({
          questionId: buildReadingLookupKey(section.id, String(question.id)),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: question.question,
          userAnswer: selectedIndex >= 0 ? getOptionDisplay(question.options[selectedIndex]) : "",
          correctAnswer: getOptionDisplay(question.options[question.correctAnswer]),
          context: section.passage,
        });
        continue;
      }

      const selectedIndex = isAnsweredValue(rawAnswer) ? Number(rawAnswer) : -1;
      inputs.push({
        questionId: buildReadingLookupKey(section.id, String(question.id)),
        sectionId: section.id,
        sectionTitle: section.title,
        questionType: question.type,
        questionText: question.question,
        userAnswer: selectedIndex >= 0 ? getOptionDisplay(question.options[selectedIndex]) : "",
        correctAnswer: String(question.correctAnswer),
        context: section.passage,
      });
      continue;
    }

    if (
      question.type === "fill-blank"
      || question.type === "wordbank-fill"
      || question.type === "story-fill"
      || question.type === "picture-spelling"
      || question.type === "word-completion"
    ) {
      inputs.push({
        questionId: buildReadingLookupKey(section.id, String(question.id)),
        sectionId: section.id,
        sectionTitle: section.title,
        questionType: question.type,
        questionText: question.question || `Question ${question.id}`,
        userAnswer: typeof rawAnswer === "string" ? rawAnswer : "",
        correctAnswer: question.correctAnswer,
        context: section.passage,
      });
      continue;
    }

    if (question.type === "checkbox") {
      const selectedIndexes = Array.isArray(rawAnswer)
        ? rawAnswer.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        : [];
      inputs.push({
        questionId: buildReadingLookupKey(section.id, String(question.id)),
        sectionId: section.id,
        sectionTitle: section.title,
        questionType: "checkbox",
        questionText: question.question,
        userAnswer: selectedIndexes.map((index) => getOptionDisplay(question.options[index])).join(", "),
        correctAnswer: sortUniqueNumbers(question.correctAnswers).map((index) => getOptionDisplay(question.options[index])).join(", "),
        context: section.passage,
      });
      continue;
    }

    if (question.type === "true-false") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.statements.forEach((statement) => {
        const rawChoice = parsed[statement.label];
        const userChoice = normalizeTrueFalseChoice(
          rawChoice && typeof rawChoice === "object" && "tf" in rawChoice
            ? (rawChoice as { tf?: unknown }).tf
            : rawChoice,
        );
        inputs.push({
          questionId: buildReadingLookupKey(section.id, `${question.id}-${statement.label}`),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: `${question.question || ""} ${statement.statement}`.trim(),
          userAnswer: userChoice || "",
          correctAnswer: getExpectedTrueFalseChoice(statement),
          context: section.passage,
        });
      });
      continue;
    }

    if (question.type === "table") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.rows.forEach((row, index) => {
        const nestedRow = parsed[String(index)];
        const nestedValue = nestedRow && typeof nestedRow === "object"
          ? (nestedRow as Record<string, unknown>)[row.blankField]
          : undefined;
        const rawText = typeof nestedValue === "string"
          ? nestedValue
          : typeof parsed[`row${index}`] === "string"
            ? String(parsed[`row${index}`])
            : typeof parsed[row.blankField + index] === "string"
              ? String(parsed[row.blankField + index])
              : "";

        inputs.push({
          questionId: buildReadingLookupKey(section.id, `${question.id}-${String.fromCharCode(97 + index)}`),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: `Complete the table for "${row.situation}"`,
          userAnswer: rawText,
          correctAnswer: row.answer,
          context: section.passage,
        });
      });
      continue;
    }

    if (question.type === "reference") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item, index) => {
        inputs.push({
          questionId: buildReadingLookupKey(section.id, `${question.id}-${String.fromCharCode(97 + index)}`),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: `What does "${item.word}" ${item.lineRef ? `(${item.lineRef})` : ""} refer to?`.trim(),
          userAnswer: typeof parsed[String(index)] === "string" ? String(parsed[String(index)]) : "",
          correctAnswer: item.answer,
          context: section.passage,
        });
      });
      continue;
    }

    if (question.type === "order") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.events.forEach((event, index) => {
        inputs.push({
          questionId: buildReadingLookupKey(section.id, `${question.id}-${String.fromCharCode(97 + index)}`),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: `Put this event in order: ${event}`,
          userAnswer: typeof parsed[String(index)] === "string" ? String(parsed[String(index)]) : "",
          correctAnswer: String(question.correctOrder[index]),
          context: section.passage,
        });
      });
      continue;
    }

    if (question.type === "phrase") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item, index) => {
        inputs.push({
          questionId: buildReadingLookupKey(section.id, `${question.id}-${String.fromCharCode(97 + index)}`),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: item.clue,
          userAnswer: typeof parsed[String(index)] === "string" ? String(parsed[String(index)]) : "",
          correctAnswer: item.answer,
          context: section.passage,
        });
      });
      continue;
    }

    if (question.type === "sentence-reorder") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item) => {
        inputs.push({
          questionId: buildReadingLookupKey(section.id, `${question.id}-${item.label}`),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: item.scrambledWords,
          userAnswer: sentenceReorderAnswerToString(parsed[item.label]),
          correctAnswer: item.correctAnswer,
          context: section.passage,
        });
      });
      continue;
    }

    if (question.type === "inline-word-choice") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item) => {
        const selectedIndex = getChoiceIndex(parsed, item.label);
        inputs.push({
          questionId: buildReadingLookupKey(section.id, `${question.id}-${item.label}`),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: item.sentenceText || `${item.beforeText} ___ ${item.afterText}`.trim(),
          userAnswer: selectedIndex !== undefined && selectedIndex >= 0 ? item.options[selectedIndex] || "" : "",
          correctAnswer: item.options[item.correctAnswer] || "",
          context: section.passage,
        });
      });
      continue;
    }

    if (question.type === "passage-inline-word-choice") {
      const parsed = parseSerializedRecord(rawAnswer);
      question.items.forEach((item) => {
        const selectedIndex = getChoiceIndex(parsed, item.label);
        inputs.push({
          questionId: buildReadingLookupKey(section.id, `${question.id}-${item.label}`),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: question.type,
          questionText: formatPassageInlinePrompt(question.question, item),
          userAnswer: selectedIndex !== undefined && selectedIndex >= 0 ? item.options[selectedIndex] || "" : "",
          correctAnswer: item.options[item.correctAnswer] || "",
          context: question.passageText || section.passage,
        });
      });
      continue;
    }

    if (question.type === "open-ended") {
      if (question.subQuestions && question.subQuestions.length > 0) {
        const parsed = parseSerializedRecord(rawAnswer);
        question.subQuestions.forEach((subQuestion) => {
          inputs.push({
            questionId: buildReadingLookupKey(section.id, `${question.id}-${subQuestion.label}`),
            sectionId: section.id,
            sectionTitle: section.title,
            questionType: "open-ended-sub",
            questionText: `${question.question} ${subQuestion.label}) ${subQuestion.question}`.trim(),
            userAnswer: typeof parsed[subQuestion.label] === "string" ? String(parsed[subQuestion.label]) : "",
            correctAnswer: subQuestion.answer,
            context: section.passage,
          });
        });
      } else {
        const audioAnswers = extractAudioAnswers(rawAnswer);
        if (audioAnswers.length > 0) continue;
        inputs.push({
          questionId: buildReadingLookupKey(section.id, String(question.id)),
          sectionId: section.id,
          sectionTitle: section.title,
          questionType: "open-ended",
          questionText: question.question,
          userAnswer: typeof rawAnswer === "string" ? rawAnswer : "",
          correctAnswer: question.answer || question.correctAnswer || "",
          context: section.passage,
        });
      }
    }
  }

  return inputs.filter((item) => (
    item.correctAnswer.trim().length > 0
    || item.questionType === "open-ended"
    || item.questionType === "open-ended-sub"
  ));
}

export function buildSubmissionArtifacts(
  paper: Paper,
  answers: Record<string, unknown>,
): SubmissionArtifacts {
  const objectiveBySection: Record<string, { correct: number; total: number }> = {};
  const wrongObjectiveAnswers: WrongAnswerExplanationCandidate[] = [];
  const readingInputs: ReadingInputCandidate[] = [];
  const speakingResponses: SpeakingResponseCandidate[] = [];
  let writingTask: WritingTaskCandidate | null = null;

  for (const section of paper.sections) {
    const kind = inferSectionKind(section);

    if (kind === "writing") {
      const writingQuestion = section.questions.find((question): question is WritingQuestion => question.type === "writing");
      if (writingQuestion) {
        const essayKey = `${section.id}:${writingQuestion.id}`;
        const essay = typeof answers[essayKey] === "string" ? String(answers[essayKey]) : "";
        writingTask = {
          sectionId: section.id,
          sectionTitle: section.title,
          question: writingQuestion,
          essay,
        };
      }
      continue;
    }

    if (kind === "speaking") {
      section.questions.forEach((question) => {
        if (question.type !== "open-ended") return;
        const answerKey = `${section.id}:${question.id}`;
        const rawValue = answers[answerKey];
        const audioUrls = extractAudioAnswers(rawValue);
        if (audioUrls.length === 0) return;

        const parsed = parseSerializedRecord(rawValue);
        if (question.subQuestions && question.subQuestions.length > 0) {
          question.subQuestions.forEach((subQuestion, index) => {
            const audioUrl = typeof parsed[subQuestion.label] === "string" ? String(parsed[subQuestion.label]) : "";
            if (!audioUrl || !isAudioAnswerValue(audioUrl)) return;
            speakingResponses.push({
              sectionId: section.id,
              sectionTitle: section.title,
              questionId: question.id * 100 + index,
              prompt: `${question.question} ${subQuestion.label}) ${subQuestion.question}`.trim(),
              audioUrl,
            });
          });
        } else {
          speakingResponses.push({
            sectionId: section.id,
            sectionTitle: section.title,
            questionId: question.id,
            prompt: question.question,
            audioUrl: audioUrls[0],
          });
        }
      });
      continue;
    }

    if (kind === "reading") {
      readingInputs.push(...buildReadingInputsForSection(section, answers));
      continue;
    }

    const sectionDetails = buildQuestionDetailsForSection(section, answers, new Map(), new Map());
    objectiveBySection[section.id] = {
      correct: sectionDetails.filter((detail) => detail.isCorrect).length,
      total: sectionDetails.length,
    };

    const grouped = sectionDetails.reduce<Record<number, QuestionReviewDetail[]>>((accumulator, detail) => {
      const bucket = accumulator[detail.sourceQuestionId] || [];
      bucket.push(detail);
      accumulator[detail.sourceQuestionId] = bucket;
      return accumulator;
    }, {});

    Object.values(grouped).forEach((group) => {
      if (group.every((detail) => detail.isCorrect)) return;
      if (!group.some((detail) => detail.isAnswered)) return;
      wrongObjectiveAnswers.push(buildQuestionGroupSummary(group));
    });
  }

  const objectiveTotals = Object.values(objectiveBySection).reduce(
    (accumulator, item) => ({
      correct: accumulator.correct + item.correct,
      total: accumulator.total + item.total,
    }),
    { correct: 0, total: 0 },
  );

  return {
    objectiveTotals,
    objectiveBySection,
    readingInputs,
    wrongObjectiveAnswers,
    writingTask,
    speakingResponses,
  };
}

export function buildAssessmentReviewModel(
  record: AssessmentReviewRecord,
): AssessmentReviewModel {
  const storedPayload = parseStoredAssessmentPayload(record.answersJson);
  const answers = storedPayload.answers as Record<string, unknown>;
  const paperSnapshot = storedPayload.paperSnapshot;
  const paper = paperSnapshot && typeof paperSnapshot === "object"
    ? (paperSnapshot as Paper)
    : getPaperById(record.paperId) || null;

  const readingResults = safeParseJSON<ReadingGradingResult[]>(record.readingResultsJson, []);
  const writingResult = safeParseJSON<WritingEvaluationResult | null>(record.writingResultJson, null);
  const explanations = safeParseJSON<ExplanationResult[]>(record.explanationsJson, []);
  const report = safeParseJSON<AssessmentReportResult | null>(record.reportJson, null);
  const speakingEvaluation = report?.speakingEvaluation || null;
  const bySection = safeParseJSON<Record<string, { correct: number; total: number }>>(record.scoreBySectionJson, {});
  const sectionTimings = safeParseJSON<Record<string, number>>(record.sectionTimingsJson, {});

  const explanationMap = new Map<number, ExplanationResult>();
  explanations.forEach((item) => explanationMap.set(item.questionId, item));

  const readingResultMap = new Map<string, ReadingGradingResult>();
  readingResults.forEach((item) => readingResultMap.set(item.questionId, item));

  const sections: SectionReviewSummary[] = [];
  let writing: WritingReviewData | null = null;

  if (paper) {
    for (const section of paper.sections) {
      const kind = inferSectionKind(section);

      if (kind === "writing") {
        const writingQuestion = section.questions.find((question): question is WritingQuestion => question.type === "writing");
        if (writingQuestion) {
          const essayKey = `${section.id}:${writingQuestion.id}`;
          const essay = typeof answers[essayKey] === "string" ? String(answers[essayKey]) : "";
          writing = {
            sectionId: section.id,
            sectionTitle: section.title,
            question: writingQuestion,
            essay,
            evaluation: writingResult,
            manualReview: isManualWritingReview(writingResult),
          };
        }
      }

      const details = kind === "writing" || kind === "speaking"
        ? []
        : buildQuestionDetailsForSection(section, answers, explanationMap, readingResultMap);

      let correct = 0;
      let total = 0;
      let manualReview = false;

      if (kind === "writing") {
        const isManual = isManualWritingReview(writingResult);
        manualReview = isManual;
        correct = writingResult && !isManual ? writingResult.score : 0;
        total = writingResult && !isManual ? writingResult.maxScore : 0;
      } else if (kind === "speaking") {
        const matchingEvaluations = speakingEvaluation?.evaluations.filter((item) => item.sectionId === section.id) || [];
        const isManual = isManualSpeakingReview(speakingEvaluation);
        manualReview = isManual;
        correct = !isManual ? matchingEvaluations.reduce((sum, item) => sum + item.score, 0) : 0;
        total = !isManual ? matchingEvaluations.reduce((sum, item) => sum + item.maxScore, 0) : 0;
      } else if (kind === "reading") {
        correct = details.filter((detail) => detail.isCorrect).length;
        total = details.length;
      } else if (bySection[section.id]) {
        correct = bySection[section.id].correct;
        total = bySection[section.id].total;
      } else {
        correct = details.filter((detail) => detail.isCorrect).length;
        total = details.length;
      }

      sections.push({
        sectionId: section.id,
        sectionTitle: section.title,
        kind,
        correct,
        total,
        percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
        timeSeconds: sectionTimings[section.id] || 0,
        manualReview,
        details,
      });
    }
  }

  const totalScore = sections.reduce((sum, section) => sum + section.correct, 0);
  const totalPossible = sections.reduce((sum, section) => sum + section.total, 0);
  const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  return {
    paper,
    answers,
    report,
    readingResults,
    writingResult,
    explanations,
    speakingEvaluation,
    sections,
    writing,
    speaking: {
      evaluation: speakingEvaluation,
      manualReview: isManualSpeakingReview(speakingEvaluation),
    },
    totalScore,
    totalPossible,
    percentage,
    grade: getLetterGrade(totalScore, totalPossible),
    totalTimeSeconds: record.totalTimeSeconds || 0,
  };
}
