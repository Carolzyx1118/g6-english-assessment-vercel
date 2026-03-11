/**
 * Convert a ManualPaperBlueprint into the runtime Paper format used by the quiz system.
 * This runs on both client and server so it lives in shared/.
 */
import { MANUAL_SECTION_TYPE_LABELS } from "./manualPaperBlueprint";
import type { ManualPaperBlueprint, ManualQuestion, ManualSectionType, ManualSubsection } from "./manualPaperBlueprint";

// Re-export the types we need from papers.ts (but keep this file dependency-free for the server)
// The caller is responsible for casting the result to the Paper type.

export interface ConvertedSection {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  taskDescription?: string;
  questions: ConvertedQuestion[];
  passage?: string;
  wordBank?: { letter: string; word: string }[];
  grammarPassage?: string;
  audioUrl?: string;
  sceneImageUrl?: string;
  sectionType?: ManualSectionType;
  inlineCloze?: boolean;
  /** For passage-matching: the labeled descriptions */
  matchingDescriptions?: Array<{ label: string; name: string; text: string }>;
  manualBlocks?: ConvertedManualBlock[];
}

export interface ConvertedManualBlock {
  id: string;
  displayNumber: number;
  questionType: string;
  instructions?: string;
  taskDescription?: string;
  questionIds: number[];
  passage?: string;
  wordBank?: { letter: string; word: string }[];
  grammarPassage?: string;
  audioUrl?: string;
  sceneImageUrl?: string;
  inlineCloze?: boolean;
  matchingDescriptions?: Array<{ label: string; name: string; text: string }>;
}

export interface ConvertedQuestion {
  id: number;
  type: string;
  question: string;
  options?: string[] | { label: string; imageUrl: string; text?: string }[];
  correctAnswer: string | number;
  acceptableAnswers?: string[];
  imageUrl?: string;
  subQuestions?: { label: string; question: string; answer: string }[];
  /** For passage-mcq: per-blank options */
  blankOptions?: Array<{ label: string; text: string }>;
  /** For writing */
  topic?: string;
  instructions?: string;
  wordCount?: string;
  prompts?: string[];
  /** For typed-fill-blank */
  correctAnswerText?: string;
  wordPattern?: string;
  /** For passage-matching */
  matchingCorrectLabel?: string;
  responseMode?: "text" | "audio";
  /** Min/max words for writing */
  minWords?: number;
  maxWords?: number;
  referenceAnswer?: string;
  statements?: Array<{
    label: string;
    statement: string;
    isTrue?: boolean;
    correctChoice?: "True" | "False" | "Not Given";
    reason?: string;
    explanation?: string;
  }>;
  choices?: Array<"True" | "False" | "Not Given">;
  requiresReason?: boolean;
  correctAnswers?: number[];
  selectionLimit?: number;
  events?: string[];
  correctOrder?: number[];
  items?: Array<
    | { label: string; scrambledWords: string; correctAnswer: string }
    | { label: string; sentenceText?: string; beforeText: string; options: string[]; afterText: string; correctAnswer: number }
    | { label: string; options: string[]; correctAnswer: number }
  >;
  inlineChoiceItems?: Array<{ label: string; sentenceText?: string; beforeText: string; options: string[]; afterText: string; correctAnswer: number }>;
  passageChoiceItems?: Array<{ label: string; options: string[]; correctAnswer: number }>;
  passageText?: string;
}

function getAssetUrl(asset?: { previewUrl?: string; dataUrl: string }) {
  return asset?.previewUrl || asset?.dataUrl;
}

function buildClozePassage(
  passageText: string | undefined,
  questionIds: number[],
  format: "inline-mcq" | "drag-drop",
) {
  if (!passageText) return undefined;

  let gapIndex = 0;
  return passageText.replace(/___/g, () => {
    const questionId = questionIds[gapIndex];
    gapIndex += 1;

    if (!questionId) {
      return "___";
    }

    return format === "drag-drop"
      ? `<b>(${questionId}) ___</b>`
      : `(${questionId}) ___`;
  });
}

const SECTION_TYPE_ICONS: Record<ManualSectionType, string> = {
  reading: "📖",
  listening: "🎧",
  writing: "✍️",
  speaking: "🗣️",
  grammar: "📝",
  vocabulary: "📚",
  "math-multiple-choice": "🧮",
  "math-short-answer": "📐",
  "math-application": "📊",
};

const SECTION_TYPE_COLORS: Record<ManualSectionType, { color: string; bgColor: string }> = {
  reading: { color: "text-blue-600", bgColor: "bg-blue-50" },
  listening: { color: "text-purple-600", bgColor: "bg-purple-50" },
  writing: { color: "text-rose-600", bgColor: "bg-rose-50" },
  speaking: { color: "text-orange-600", bgColor: "bg-orange-50" },
  grammar: { color: "text-emerald-600", bgColor: "bg-emerald-50" },
  vocabulary: { color: "text-amber-600", bgColor: "bg-amber-50" },
  "math-multiple-choice": { color: "text-sky-700", bgColor: "bg-sky-50" },
  "math-short-answer": { color: "text-emerald-700", bgColor: "bg-emerald-50" },
  "math-application": { color: "text-amber-700", bgColor: "bg-amber-50" },
};

function convertSubsectionQuestions(
  subsection: ManualSubsection,
  sectionType: ManualSectionType,
  startId: number,
): ConvertedQuestion[] {
  const questions: ConvertedQuestion[] = [];
  let currentId = startId;

  for (const q of subsection.questions) {
    const converted = convertSingleQuestion(q, currentId, subsection, sectionType);
    if (converted) {
      questions.push(converted);
      currentId++;
    }
  }

  return questions;
}

function convertSingleQuestion(
  q: ManualQuestion,
  id: number,
  subsection: ManualSubsection,
  sectionType: ManualSectionType,
): ConvertedQuestion | null {
  if (subsection.questionType === "speaking") {
    const prompt = "prompt" in q && typeof q.prompt === "string" && q.prompt.trim()
      ? q.prompt
      : subsection.instructions?.trim() || "Record your answer.";
    const imageUrl = ("image" in q && q.image ? getAssetUrl(q.image) : undefined) || getAssetUrl(subsection.sceneImage);

    return {
      id,
      type: "open-ended",
      question: prompt,
      correctAnswer: "",
      imageUrl,
      responseMode: "audio",
    };
  }

  switch (q.type) {
    case "mcq": {
      const optionTexts = q.options.map((o) => o.text);
      const normalizedCorrectAnswers = (q.correctAnswers && q.correctAnswers.length > 0 ? q.correctAnswers : [q.correctAnswer])
        .flatMap((label) => {
          const index = q.options.findIndex((o) => o.label === label);
          return index >= 0 ? [index] : [];
        });
      const uniqueCorrectAnswers = Array.from(new Set(normalizedCorrectAnswers));
      const correctIdx = uniqueCorrectAnswers[0] ?? 0;
      const desiredSelectionLimit = q.selectionLimit ?? (uniqueCorrectAnswers.length || 1);
      const selectionLimit = Math.max(1, Math.min(desiredSelectionLimit, q.options.length));
      const optionCards = q.options.map((o) => ({
        label: o.label,
        imageUrl: getAssetUrl(o.image) || "",
        text: o.text || undefined,
      }));
      const hasOptionImages = optionCards.some((o) => Boolean(o.imageUrl));

      if (sectionType === "listening") {
        return {
          id,
          type: "listening-mcq",
          question: q.prompt,
          options: optionCards,
          correctAnswer: correctIdx,
          correctAnswers: uniqueCorrectAnswers,
          selectionLimit,
        };
      }

      if (hasOptionImages) {
        return {
          id,
          type: "picture-mcq",
          question: q.prompt,
          options: optionCards,
          correctAnswer: correctIdx,
          correctAnswers: uniqueCorrectAnswers,
          selectionLimit,
        };
      }

      return {
        id,
        type: "mcq",
        question: q.prompt,
        options: optionTexts,
        correctAnswer: correctIdx,
        imageUrl: q.options.find((o) => o.image?.previewUrl)?.image?.previewUrl,
        correctAnswers: uniqueCorrectAnswers,
        selectionLimit,
      };
    }

    case "fill-blank": {
      const wordBankItem = (subsection.wordBank ?? []).find(
        (w) => w.id === q.correctAnswerWordBankId,
      );
      return {
        id,
        type: "fill-blank",
        question: q.prompt,
        correctAnswer: wordBankItem?.word ?? "",
      };
    }

    case "passage-fill-blank": {
      const wordBankItem = (subsection.wordBank ?? []).find(
        (w) => w.id === q.correctAnswerWordBankId,
      );
      return {
        id,
        type: "fill-blank",
        question: q.prompt || `Blank ${id}`,
        correctAnswer: wordBankItem?.letter ?? "",
      };
    }

    case "passage-mcq": {
      const optionTexts = q.options.map((o) => o.text);
      const correctIdx = q.options.findIndex((o) => o.label === q.correctAnswer);
      return {
        id,
        type: "mcq",
        question: q.prompt,
        options: optionTexts,
        correctAnswer: correctIdx >= 0 ? correctIdx : 0,
        blankOptions: q.options.map((o) => ({ label: o.label, text: o.text })),
      };
    }

    case "typed-fill-blank": {
      return {
        id,
        type: "fill-blank",
        question: q.prompt,
        correctAnswer: q.correctAnswer,
        correctAnswerText: q.correctAnswer,
      };
    }

    case "picture-spelling": {
      return {
        id,
        type: "picture-spelling",
        question: q.prompt,
        correctAnswer: q.correctAnswer,
        imageUrl: getAssetUrl(q.image),
      };
    }

    case "word-completion": {
      return {
        id,
        type: "word-completion",
        question: q.prompt,
        imageUrl: getAssetUrl(q.image),
        wordPattern: q.wordPattern,
        correctAnswer: q.correctAnswer,
      };
    }

    case "passage-open-ended": {
      return {
        id,
        type: "open-ended",
        question: q.prompt,
        correctAnswer: q.referenceAnswer || "",
        referenceAnswer: q.referenceAnswer,
      };
    }

    case "writing": {
      return {
        id,
        type: "writing",
        question: q.prompt,
        topic: q.prompt,
        instructions: q.prompt,
        wordCount: q.minWords && q.maxWords
          ? `${q.minWords}-${q.maxWords} words`
          : q.minWords
            ? `At least ${q.minWords} words`
            : q.maxWords
              ? `Up to ${q.maxWords} words`
              : "",
        prompts: [q.prompt],
        correctAnswer: q.referenceAnswer || "",
        imageUrl: getAssetUrl(q.image),
        minWords: q.minWords,
        maxWords: q.maxWords,
        referenceAnswer: q.referenceAnswer,
      };
    }

    case "speaking": {
      return {
        id,
        type: "open-ended",
        question: q.prompt,
        correctAnswer: "",
        imageUrl: getAssetUrl(q.image),
        responseMode: "audio",
      };
    }

    case "passage-matching": {
      const correctIndex = (subsection.matchingDescriptions ?? []).findIndex(
        (d) => d.label === q.correctAnswer,
      );
      return {
        id,
        type: "mcq",
        question: q.prompt,
        options: (subsection.matchingDescriptions ?? []).map((d) => d.name || d.text || "Untitled option"),
        correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        matchingCorrectLabel: q.correctAnswer,
      };
    }

    case "heading-match": {
      const correctIndex = (subsection.matchingDescriptions ?? []).findIndex(
        (d) => d.label === q.correctAnswer,
      );
      return {
        id,
        type: "mcq",
        question: q.prompt,
        options: (subsection.matchingDescriptions ?? []).map((d) => d.name || d.text || "Untitled heading"),
        correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        matchingCorrectLabel: q.correctAnswer,
      };
    }

    case "true-false": {
      return {
        id,
        type: "true-false",
        question: q.prompt,
        correctAnswer: "",
        statements: q.statements.map((statement) => ({
          label: statement.label,
          statement: statement.statement,
          isTrue: statement.correctAnswer === "true" ? true : statement.correctAnswer === "false" ? false : undefined,
          correctChoice:
            statement.correctAnswer === "true"
              ? "True"
              : statement.correctAnswer === "false"
                ? "False"
                : "Not Given",
          reason: statement.explanation,
          explanation: statement.explanation,
        })),
        choices: ["True", "False", "Not Given"],
        requiresReason: q.requiresReason,
      };
    }

    case "checkbox": {
      const normalized = q.options.map((option, index) => ({
        ...option,
        label: option.label || String.fromCharCode(65 + index),
      }));
      return {
        id,
        type: "checkbox",
        question: q.prompt,
        options: normalized.map((option) => option.text),
        correctAnswer: "",
        correctAnswers: normalized.flatMap((option, optionIndex) => (
          q.correctAnswers.includes(option.label) ? [optionIndex] : []
        )),
        selectionLimit: q.selectionLimit ?? Math.max(q.correctAnswers.length, 2),
      };
    }

    case "ordering": {
      const orderedItems = [...q.items].sort((a, b) => a.correctPosition - b.correctPosition);
      const displayItems = q.items.map((item) => item.text);
      const correctOrder = q.items.map((item) => {
        const orderIndex = orderedItems.findIndex((orderedItem) => orderedItem.id === item.id);
        return orderIndex >= 0 ? orderIndex + 1 : item.correctPosition;
      });

      return {
        id,
        type: "order",
        question: q.prompt,
        options: [],
        correctAnswer: "",
        events: displayItems,
        correctOrder,
      };
    }

    case "sentence-reorder": {
      return {
        id,
        type: "sentence-reorder",
        question: q.prompt,
        correctAnswer: "",
        items: q.items.map((item) => ({
          label: item.label,
          scrambledWords: item.scrambledWords,
          correctAnswer: item.correctAnswer,
        })),
      };
    }

    case "inline-word-choice": {
      const items = q.items.map((item) => ({
        label: item.label,
        sentenceText: item.sentenceText,
        beforeText: item.beforeText,
        options: item.options.map((option) => option.text),
        afterText: item.afterText,
        correctAnswer: Math.max(
          0,
          item.options.findIndex((option) => option.label === item.correctAnswer),
        ),
      }));
      return {
        id,
        type: "inline-word-choice",
        question: q.prompt,
        correctAnswer: "",
        items,
        inlineChoiceItems: items,
      };
    }

    case "passage-inline-word-choice": {
      const items = q.items.map((item) => ({
        label: item.label,
        options: item.options.map((option) => option.text),
        correctAnswer: Math.max(
          0,
          item.options.findIndex((option) => option.label === item.correctAnswer),
        ),
      }));
      return {
        id,
        type: "passage-inline-word-choice",
        question: q.prompt,
        correctAnswer: "",
        passageText: subsection.passageText || "",
        items,
        passageChoiceItems: items,
      };
    }

    default:
      return null;
  }
}

export function blueprintToPaper(blueprint: ManualPaperBlueprint, options?: {
  subject?: string;
  category?: string;
}): {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  subject: string;
  category: string;
  sections: ConvertedSection[];
  totalQuestions: number;
  hasListening: boolean;
  hasWriting: boolean;
  isManualPaper: true;
} {
  const sections: ConvertedSection[] = [];
  let globalQuestionId = 1;
  let totalQuestions = 0;
  let hasListening = false;
  let hasWriting = false;

  for (const section of blueprint.sections) {
    if (section.sectionType === "listening") hasListening = true;
    if (section.sectionType === "writing") hasWriting = true;

    const colors = SECTION_TYPE_COLORS[section.sectionType] || SECTION_TYPE_COLORS.reading;
    const convertedSection: ConvertedSection = {
      id: `${section.sectionType}-${section.id}`,
      title: `${section.partLabel} · ${MANUAL_SECTION_TYPE_LABELS[section.sectionType] || section.sectionType}`,
      subtitle: "",
      icon: SECTION_TYPE_ICONS[section.sectionType] || "📖",
      color: colors.color,
      bgColor: colors.bgColor,
      description: section.subsections.length > 1
        ? "Complete all main questions in this part."
        : section.subsections[0]?.instructions || "",
      questions: [],
      sectionType: section.sectionType,
      manualBlocks: [],
    };

    for (let subsectionIndex = 0; subsectionIndex < section.subsections.length; subsectionIndex += 1) {
      const subsection = section.subsections[subsectionIndex];
      if (subsection.questionType === "writing") hasWriting = true;

      const convertedQuestions = convertSubsectionQuestions(subsection, section.sectionType, globalQuestionId);
      totalQuestions += convertedQuestions.length;
      globalQuestionId += convertedQuestions.length;
      convertedSection.questions.push(...convertedQuestions);

      const convertedBlock: ConvertedManualBlock = {
        id: subsection.id,
        displayNumber: subsectionIndex + 1,
        questionType: subsection.questionType,
        instructions: subsection.instructions?.trim() || undefined,
        taskDescription: subsection.questionType === "speaking"
          ? subsection.taskDescription?.trim() || undefined
          : undefined,
        questionIds: convertedQuestions.map((question) => question.id),
      };

      // Add passage text
      if (subsection.passageText) {
        if (subsection.questionType === "passage-fill-blank") {
          convertedBlock.grammarPassage = buildClozePassage(
            subsection.passageText,
            convertedQuestions.map((question) => question.id),
            "drag-drop",
          );
        } else if (subsection.questionType === "passage-mcq") {
          convertedBlock.passage = buildClozePassage(
            subsection.passageText,
            convertedQuestions.map((question) => question.id),
            "inline-mcq",
          );
          convertedBlock.inlineCloze = true;
        } else if (
          subsection.questionType !== "passage-matching"
        ) {
          convertedBlock.passage = subsection.passageText;
        }
      }

      // Add word bank
      if (subsection.wordBank && subsection.wordBank.length > 0) {
        convertedBlock.wordBank = subsection.wordBank.map((w: { letter: string; word: string }) => ({
          letter: w.letter,
          word: w.word,
        }));
      }

      // Add audio
      if (subsection.audio) {
        convertedBlock.audioUrl = subsection.audio.previewUrl || subsection.audio.dataUrl;
      }

      // Add scene image
      if (subsection.sceneImage) {
        convertedBlock.sceneImageUrl = subsection.sceneImage.previewUrl || subsection.sceneImage.dataUrl;
      }

      // Add matching descriptions
      if (subsection.matchingDescriptions && subsection.matchingDescriptions.length > 0) {
        convertedBlock.matchingDescriptions = subsection.matchingDescriptions.map((d: { label: string; name: string; text: string }) => ({
          label: d.label,
          name: d.name,
          text: d.text,
        }));
      }

      convertedSection.manualBlocks?.push(convertedBlock);
    }

    if (convertedSection.manualBlocks?.length === 1) {
      const [onlyBlock] = convertedSection.manualBlocks;
      convertedSection.subtitle = onlyBlock.instructions || "";
      convertedSection.description = onlyBlock.instructions || convertedSection.description;
      convertedSection.taskDescription = onlyBlock.taskDescription;
      convertedSection.passage = onlyBlock.passage;
      convertedSection.wordBank = onlyBlock.wordBank;
      convertedSection.grammarPassage = onlyBlock.grammarPassage;
      convertedSection.audioUrl = onlyBlock.audioUrl;
      convertedSection.sceneImageUrl = onlyBlock.sceneImageUrl;
      convertedSection.inlineCloze = onlyBlock.inlineCloze;
      convertedSection.matchingDescriptions = onlyBlock.matchingDescriptions;
    }

    sections.push(convertedSection);
  }

  return {
    id: blueprint.id,
    title: blueprint.title,
    subtitle: "",
    description: blueprint.description,
    icon: "📋",
    color: "text-indigo-600",
    subject: options?.subject || "english",
    category: options?.category || "assessment",
    sections,
    totalQuestions,
    hasListening,
    hasWriting,
    isManualPaper: true,
  };
}

/** Count total questions in a blueprint */
export function countBlueprintQuestions(blueprint: ManualPaperBlueprint): number {
  let count = 0;
  for (const section of blueprint.sections) {
    for (const subsection of section.subsections) {
      count += subsection.questions.length;
    }
  }
  return count;
}

/** Check if blueprint has listening sections */
export function blueprintHasListening(blueprint: ManualPaperBlueprint): boolean {
  return blueprint.sections.some((s) => s.sectionType === "listening");
}

/** Check if blueprint has writing sections or writing questions */
export function blueprintHasWriting(blueprint: ManualPaperBlueprint): boolean {
  return blueprint.sections.some(
    (s) => s.sectionType === "writing" || s.subsections.some((sub) => sub.questionType === "writing"),
  );
}
