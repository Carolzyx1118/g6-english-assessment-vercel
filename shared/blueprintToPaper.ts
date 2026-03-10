/**
 * Convert a ManualPaperBlueprint into the runtime Paper format used by the quiz system.
 * This runs on both client and server so it lives in shared/.
 */
import type { ManualPaperBlueprint, ManualSubsection, ManualQuestion, ManualSectionType } from "./manualPaperBlueprint";

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
  questions: ConvertedQuestion[];
  passage?: string;
  wordBank?: { letter: string; word: string }[];
  grammarPassage?: string;
  audioUrl?: string;
  sceneImageUrl?: string;
  /** For passage-matching: the labeled descriptions */
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
  /** For passage-matching */
  matchingCorrectLabel?: string;
  /** Min/max words for writing */
  minWords?: number;
  maxWords?: number;
  referenceAnswer?: string;
}

const SECTION_TYPE_ICONS: Record<ManualSectionType, string> = {
  reading: "📖",
  listening: "🎧",
  writing: "✍️",
  speaking: "🗣️",
  grammar: "📝",
  vocabulary: "📚",
};

const SECTION_TYPE_COLORS: Record<ManualSectionType, { color: string; bgColor: string }> = {
  reading: { color: "text-blue-600", bgColor: "bg-blue-50" },
  listening: { color: "text-purple-600", bgColor: "bg-purple-50" },
  writing: { color: "text-rose-600", bgColor: "bg-rose-50" },
  speaking: { color: "text-orange-600", bgColor: "bg-orange-50" },
  grammar: { color: "text-emerald-600", bgColor: "bg-emerald-50" },
  vocabulary: { color: "text-amber-600", bgColor: "bg-amber-50" },
};

function convertSubsectionQuestions(
  subsection: ManualSubsection,
  startId: number,
): ConvertedQuestion[] {
  const questions: ConvertedQuestion[] = [];
  let currentId = startId;

  for (const q of subsection.questions) {
    const converted = convertSingleQuestion(q, currentId, subsection);
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
): ConvertedQuestion | null {
  switch (q.type) {
    case "mcq": {
      const optionTexts = q.options.map((o) => o.text);
      const correctIdx = q.options.findIndex((o) => o.label === q.correctAnswer);
      return {
        id,
        type: "mcq",
        question: q.prompt,
        options: optionTexts,
        correctAnswer: correctIdx >= 0 ? correctIdx : 0,
        imageUrl: q.options.find((o) => o.image?.previewUrl)?.image?.previewUrl,
      };
    }

    case "fill-blank": {
      const wordBankItem = (subsection.wordBank ?? []).find(
        (w) => w.id === q.correctAnswerWordBankId,
      );
      return {
        id,
        type: "wordbank-fill",
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
        type: "wordbank-fill",
        question: q.prompt,
        correctAnswer: wordBankItem?.word ?? "",
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
        imageUrl: q.image?.previewUrl || q.image?.dataUrl,
        minWords: q.minWords,
        maxWords: q.maxWords,
        referenceAnswer: q.referenceAnswer,
      };
    }

    case "passage-matching": {
      return {
        id,
        type: "mcq",
        question: q.prompt,
        options: (subsection.matchingDescriptions ?? []).map((d) => `${d.label}. ${d.name}`),
        correctAnswer: (subsection.matchingDescriptions ?? []).findIndex(
          (d) => d.label === q.correctAnswer,
        ),
        matchingCorrectLabel: q.correctAnswer,
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

    for (const subsection of section.subsections) {
      if (subsection.questionType === "writing") hasWriting = true;

      const convertedQuestions = convertSubsectionQuestions(subsection, globalQuestionId);
      totalQuestions += convertedQuestions.length;
      globalQuestionId += convertedQuestions.length;

      const convertedSection: ConvertedSection = {
        id: `${section.id}-${subsection.id}`,
        title: subsection.title || `${section.partLabel} - ${subsection.title || "Questions"}`,
        subtitle: subsection.instructions || "",
        icon: SECTION_TYPE_ICONS[section.sectionType] || "📖",
        color: colors.color,
        bgColor: colors.bgColor,
        description: subsection.instructions || "",
        questions: convertedQuestions,
      };

      // Add passage text
      if (subsection.passageText) {
        if (subsection.questionType === "passage-fill-blank") {
          convertedSection.grammarPassage = subsection.passageText;
        } else {
          convertedSection.passage = subsection.passageText;
        }
      }

      // Add word bank
      if (subsection.wordBank && subsection.wordBank.length > 0) {
        convertedSection.wordBank = subsection.wordBank.map((w) => ({
          letter: w.letter,
          word: w.word,
        }));
      }

      // Add audio
      if (subsection.audio) {
        convertedSection.audioUrl = subsection.audio.previewUrl || subsection.audio.dataUrl;
      }

      // Add scene image
      if (subsection.sceneImage) {
        convertedSection.sceneImageUrl = subsection.sceneImage.previewUrl || subsection.sceneImage.dataUrl;
      }

      // Add matching descriptions
      if (subsection.matchingDescriptions && subsection.matchingDescriptions.length > 0) {
        convertedSection.matchingDescriptions = subsection.matchingDescriptions.map((d) => ({
          label: d.label,
          name: d.name,
          text: d.text,
        }));
      }

      sections.push(convertedSection);
    }
  }

  return {
    id: blueprint.id,
    title: blueprint.title,
    subtitle: blueprint.description,
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
