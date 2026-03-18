import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, Check, ChevronDown, FilePlus2, ImagePlus, Link2, Loader2, Mic, Music, PenLine, Plus, SquarePen, Trash2, Volume2 } from "lucide-react";
import { PAPER_SUBJECT_LABELS, PAPER_SUBJECT_ORDER, type FillBlankQuestion, type PaperSubject } from "@/data/papers";
import DragDropFillBlank from "@/components/DragDropFillBlank";
import {
  compressImage,
  createSquareImageDataUrl,
  fileToBase64,
  formatFileSize,
  validateAudioFile,
  validateImageFile,
} from "@/lib/imageUtils";
import { trpc } from "@/lib/trpc";
import { renderTextWithFractions } from "@/lib/renderTextWithFractions";
import { formatQuestionBankItemId } from "@/lib/questionBankItem";
import {
  buildWordCompletionAnswer,
  getPictureSpellingCharacters,
  getWordCompletionFilledLetters,
  getWordPatternBlankCount,
  normalizeVocabularyAnswer,
  parseWordPattern,
} from "@/lib/vocabularyWordHelpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TeacherToolsLayout from "@/components/TeacherToolsLayout";
import EnglishQuestionTagEditor from "@/components/EnglishQuestionTagEditor";
import SubjectQuestionTagEditor from "@/components/SubjectQuestionTagEditor";
import GeneratedPaperConfigEditor, { type GeneratedSourcePaperOption } from "@/components/GeneratedPaperConfigEditor";
import type {
  ManualAudioFile,
  ManualCheckboxOption,
  ManualCheckboxQuestion,
  ManualFillBlankQuestion,
  ManualHeadingMatchQuestion,
  ManualInlineWordChoiceItem,
  ManualInlineWordChoiceOption,
  ManualInlineWordChoiceQuestion,
  ManualMCQOption,
  ManualMCQQuestion,
  ManualMatchingDescription,
  ManualOptionImage,
  ManualOrderingItem,
  ManualOrderingQuestion,
  ManualPaperBuildMode,
  ManualPaperBlueprint,
  ManualPaperGenerationConfig,
  ManualPaperVisibilityMode,
  ManualPassageFillBlankQuestion,
  ManualPassageInlineWordChoiceQuestion,
  ManualPassageMCQOption,
  ManualPassageMCQQuestion,
  ManualPassageMatchingQuestion,
  ManualPictureSpellingQuestion,
  ManualQuestion,
  ManualQuestionTags,
  ManualQuestionType,
  ManualSentenceReorderItem,
  ManualSentenceReorderQuestion,
  ManualSection,
  ManualSectionType,
  ManualSubsection,
  ManualTruthValue,
  ManualTypedFillBlankQuestion,
  ManualPassageOpenEndedQuestion,
  ManualSpeakingQuestion,
  ManualTrueFalseQuestion,
  ManualTrueFalseStatement,
  ManualWordCompletionQuestion,
  ManualWritingQuestion,
  ManualWordBankItem,
} from "@shared/manualPaperBlueprint";
import {
  MANUAL_QUESTION_TYPE_LABELS,
  MANUAL_QUESTION_TYPE_GROUPS,
  MANUAL_QUESTION_TYPE_OPTIONS,
  MANUAL_SECTION_TYPE_LABELS,
} from "@shared/manualPaperBlueprint";
import {
  generatePaperFromTaggedSources,
  getBlueprintBuildMode,
  getBlueprintVisibilityMode,
} from "@shared/taggedPaperGenerator";
import { toast } from "sonner";
import PassageMCQPreview from "@/components/PassageMCQPreview";

const DEFAULT_SECTION_TYPE: ManualSectionType = "reading";
const DEFAULT_QUESTION_TYPE: ManualQuestionType = "mcq";
const DEFAULT_WORD_BANK_SIZE = 4;
const PAPER_BUILDER_DRAFT_STORAGE_PREFIX = "pureon_manual_paper_builder_draft_v2";
const ENGLISH_SECTION_TYPES: ManualSectionType[] = ["reading", "listening", "writing", "speaking", "grammar", "vocabulary"];
const MATH_SECTION_TYPES: ManualSectionType[] = ["math-multiple-choice", "math-short-answer", "math-application"];
const ENGLISH_GENERATED_SECTION_TYPES: ManualSectionType[] = ["reading", "listening", "writing", "grammar", "vocabulary"];
const DEFAULT_SECTION_TYPE_BY_SUBJECT: Record<PaperSubject, ManualSectionType> = {
  english: "reading",
  math: "math-multiple-choice",
  vocabulary: "vocabulary",
};
const MATH_QUESTION_TYPE_GROUPS = [
  {
    label: "Math Questions",
    values: ["mcq", "typed-fill-blank"] as ManualQuestionType[],
  },
];
const VOCABULARY_QUESTION_TYPE_GROUPS = [
  {
    label: "Vocabulary Questions",
    values: ["mcq", "picture-spelling", "word-completion"] as ManualQuestionType[],
  },
];

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOptionLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function getNumberLabel(index: number) {
  return String(index + 1);
}

function createCopyTitle(title: string) {
  const trimmed = title.trim();
  return trimmed ? `${trimmed} (Copy)` : "Untitled Paper (Copy)";
}

function createGenerationRule() {
  return {
    id: createLocalId(),
    label: "新规则",
    weight: 1,
    filters: {
      track: "ket" as const,
      entries: [],
      abilities: [],
      grammarPoints: [],
      difficulties: [],
    },
  };
}

function createGenerationSection(sectionType: ManualSectionType = "reading") {
  return {
    id: createLocalId(),
    title: "",
    sectionType,
    instructions: "",
    totalQuestions: 5,
    rules: [createGenerationRule()],
  };
}

function createGenerationConfig(): ManualPaperGenerationConfig {
  return {
    sourcePaperIds: [],
    sections: [createGenerationSection()],
  };
}

function isPaperSubjectValue(value: unknown): value is PaperSubject {
  return typeof value === "string" && PAPER_SUBJECT_ORDER.includes(value as PaperSubject);
}

function getDefaultSectionTypeForSubject(subject: PaperSubject): ManualSectionType {
  return DEFAULT_SECTION_TYPE_BY_SUBJECT[subject];
}

function getAvailableSectionTypesForSubject(subject: PaperSubject): ManualSectionType[] {
  if (subject === "math") return MATH_SECTION_TYPES;
  if (subject === "vocabulary") return ["vocabulary"];
  return ENGLISH_SECTION_TYPES;
}

function getQuestionTypeGroupsForSubject(subject: PaperSubject) {
  if (subject === "math") return MATH_QUESTION_TYPE_GROUPS;
  if (subject === "vocabulary") return VOCABULARY_QUESTION_TYPE_GROUPS;
  return MANUAL_QUESTION_TYPE_GROUPS;
}

function getAllowedQuestionTypesForSubject(subject: PaperSubject): ManualQuestionType[] {
  return getQuestionTypeGroupsForSubject(subject).flatMap((group) => group.values);
}

function getDefaultQuestionTypeForSectionType(sectionType: ManualSectionType): ManualQuestionType {
  if (sectionType === "math-short-answer") return "typed-fill-blank";
  if (sectionType === "math-application") return "typed-fill-blank";
  return "mcq";
}

function getLockedMathQuestionType(sectionType: ManualSectionType): ManualQuestionType {
  return getDefaultQuestionTypeForSectionType(sectionType);
}

function getEnglishSectionTypeFromAbility(ability?: string): ManualSectionType | null {
  if (!ability) return null;
  if (ability === "语法") return "grammar";
  if (ability === "词汇") return "vocabulary";
  if (ability === "听力理解") return "listening";
  if (ability === "口语") return "speaking";
  if (ability === "写作") return "writing";
  if (ability === "阅读理解") return "reading";
  return null;
}

function inferQuestionBankSectionType(
  section: ManualSection,
  subsection: ManualSubsection,
  paperSubject: PaperSubject,
): ManualSectionType {
  if (paperSubject === "vocabulary") {
    return "vocabulary";
  }

  if (paperSubject === "math") {
    if (subsection.questionType === "mcq") {
      return "math-multiple-choice";
    }

    return section.sectionType === "math-application" ? "math-application" : "math-short-answer";
  }

  if (subsection.questionType === "speaking") {
    return "speaking";
  }

  if (subsection.questionType === "writing") {
    return "writing";
  }

  const taggedAbility = subsection.questions.find((question) => question.tags?.english?.ability)?.tags?.english?.ability;
  const taggedSectionType = getEnglishSectionTypeFromAbility(taggedAbility);
  if (taggedSectionType) {
    return taggedSectionType;
  }

  if (subsection.audio) {
    return "listening";
  }

  if (ENGLISH_SECTION_TYPES.includes(section.sectionType)) {
    return section.sectionType;
  }

  return "reading";
}

function normalizeQuestionBankSection(
  section: ManualSection,
  paperSubject: PaperSubject,
): ManualSection {
  const subsection = section.subsections[0];
  if (!subsection) {
    return section;
  }

  return {
    ...section,
    sectionType: inferQuestionBankSectionType(section, subsection, paperSubject),
  };
}

function getPaperBuilderDraftKey(editPaperId: string, paperSubject: PaperSubject) {
  return `${PAPER_BUILDER_DRAFT_STORAGE_PREFIX}:${editPaperId || `__new__:${paperSubject}`}`;
}

function getDefaultQuestionBankTitle(subject: PaperSubject) {
  return `${PAPER_SUBJECT_LABELS[subject]} Question Bank`;
}

interface ManualPaperBuilderDraft {
  version: 2;
  subject: PaperSubject;
  paperSeed: string;
  createdAt: string;
  title: string;
  description: string;
  buildMode: ManualPaperBuildMode;
  visibilityMode: ManualPaperVisibilityMode;
  generationConfig?: ManualPaperGenerationConfig;
  sections: ManualSection[];
  savedAt: string;
}

function readPaperBuilderDraft(storageKey: string, paperSubject: PaperSubject): ManualPaperBuilderDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const parsedVersion = typeof parsed.version === "number" ? parsed.version : undefined;
    if (parsedVersion !== 1 && parsedVersion !== 2) return null;

    return {
      version: 2,
      subject: isPaperSubjectValue(parsed.subject) ? parsed.subject : paperSubject,
      paperSeed: typeof parsed.paperSeed === "string" ? parsed.paperSeed : createLocalId(),
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      title: typeof parsed.title === "string" ? parsed.title : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      buildMode: parsed.buildMode === "generated" ? "generated" : "fixed",
      visibilityMode: parsed.visibilityMode === "question-bank" ? "question-bank" : "student",
      generationConfig: (parsed.generationConfig as ManualPaperGenerationConfig | undefined) ?? createGenerationConfig(),
      sections: Array.isArray(parsed.sections) ? (parsed.sections as ManualSection[]) : [createSection(getDefaultSectionTypeForSubject(paperSubject))],
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writePaperBuilderDraft(storageKey: string, draft: ManualPaperBuilderDraft) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Ignore storage failures.
  }
}

function clearPaperBuilderDraft(storageKey: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures.
  }
}

const manualQuestionTypeOptionMap = new Map(
  MANUAL_QUESTION_TYPE_OPTIONS.map((option) => [option.value, option]),
);

function getDisplayedQuestionType(questionType: ManualQuestionType): ManualQuestionType {
  return questionType === "heading-match" ? "passage-matching" : questionType;
}

function relabelOptions(options: ManualMCQOption[]) {
  return options.map((option, optionIndex) => ({
    ...option,
    label: getOptionLabel(optionIndex),
  }));
}

function relabelCheckboxOptions(options: ManualCheckboxOption[]) {
  return options.map((option, optionIndex) => ({
    ...option,
    label: getOptionLabel(optionIndex),
  }));
}

function relabelInlineWordChoiceOptions(options: ManualInlineWordChoiceOption[]) {
  return options.map((option, optionIndex) => ({
    ...option,
    label: getOptionLabel(optionIndex),
  }));
}

function relabelWordBank(wordBank: ManualWordBankItem[]) {
  return wordBank.map((item, itemIndex) => ({
    ...item,
    letter: getOptionLabel(itemIndex),
  }));
}

function relabelStatements(statements: ManualTrueFalseStatement[]) {
  return statements.map((statement, index) => ({
    ...statement,
    label: getNumberLabel(index),
  }));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createOption(index: number): ManualMCQOption {
  return {
    id: createLocalId(),
    label: getOptionLabel(index),
    text: "",
  };
}

function createMCQQuestion(): ManualMCQQuestion {
  return {
    id: createLocalId(),
    type: "mcq",
    prompt: "",
    options: [createOption(0), createOption(1), createOption(2)],
    correctAnswer: "A",
    correctAnswers: ["A"],
    selectionLimit: 1,
  };
}

function createWordBankItem(index: number): ManualWordBankItem {
  return {
    id: createLocalId(),
    letter: getOptionLabel(index),
    word: "",
  };
}

function createFillBlankQuestion(correctAnswerWordBankId: string): ManualFillBlankQuestion {
  return {
    id: createLocalId(),
    type: "fill-blank",
    prompt: "",
    correctAnswerWordBankId,
  };
}

function createPassageFillBlankQuestion(correctAnswerWordBankId: string): ManualPassageFillBlankQuestion {
  return {
    id: createLocalId(),
    type: "passage-fill-blank",
    prompt: "",
    correctAnswerWordBankId,
  };
}

function createTypedFillBlankQuestion(): ManualTypedFillBlankQuestion {
  return {
    id: createLocalId(),
    type: "typed-fill-blank",
    prompt: "",
    correctAnswer: "",
  };
}

function createPictureSpellingQuestion(): ManualPictureSpellingQuestion {
  return {
    id: createLocalId(),
    type: "picture-spelling",
    prompt: "",
    correctAnswer: "",
  };
}

function createWordCompletionQuestion(): ManualWordCompletionQuestion {
  return {
    id: createLocalId(),
    type: "word-completion",
    prompt: "",
    wordPattern: "",
    correctAnswer: "",
  };
}

function createPassageOpenEndedQuestion(): ManualPassageOpenEndedQuestion {
  return {
    id: createLocalId(),
    type: "passage-open-ended",
    prompt: "",
    referenceAnswer: "",
  };
}

function createWritingQuestion(): ManualWritingQuestion {
  return {
    id: createLocalId(),
    type: "writing",
    prompt: "",
  };
}

function createSpeakingQuestion(): ManualSpeakingQuestion {
  return {
    id: createLocalId(),
    type: "speaking",
    prompt: "",
  };
}

function createMatchingDescription(index: number, labelFactory: (index: number) => string = getOptionLabel): ManualMatchingDescription {
  return {
    id: createLocalId(),
    label: labelFactory(index),
    name: "",
    text: "",
  };
}

function createPassageMatchingQuestion(): ManualPassageMatchingQuestion {
  return {
    id: createLocalId(),
    type: "passage-matching",
    prompt: "",
    correctAnswer: "A",
  };
}

function createTrueFalseStatement(index: number): ManualTrueFalseStatement {
  return {
    id: createLocalId(),
    label: getNumberLabel(index),
    statement: "",
    correctAnswer: "true",
  };
}

function createTrueFalseQuestion(): ManualTrueFalseQuestion {
  return {
    id: createLocalId(),
    type: "true-false",
    prompt: "",
    statements: [createTrueFalseStatement(0)],
    requiresReason: false,
  };
}

function createHeadingMatchQuestion(index = 0): ManualHeadingMatchQuestion {
  return {
    id: createLocalId(),
    type: "heading-match",
    prompt: `Paragraph ${getOptionLabel(index)}`,
    correctAnswer: "1",
  };
}

function createCheckboxOption(index: number): ManualCheckboxOption {
  return {
    id: createLocalId(),
    label: getOptionLabel(index),
    text: "",
  };
}

function createCheckboxQuestion(): ManualCheckboxQuestion {
  return {
    id: createLocalId(),
    type: "checkbox",
    prompt: "",
    options: [
      createCheckboxOption(0),
      createCheckboxOption(1),
      createCheckboxOption(2),
      createCheckboxOption(3),
    ],
    correctAnswers: ["A", "B"],
    selectionLimit: 2,
  };
}

function createOrderingItem(index: number): ManualOrderingItem {
  return {
    id: createLocalId(),
    text: "",
    correctPosition: index + 1,
  };
}

function createOrderingQuestion(): ManualOrderingQuestion {
  return {
    id: createLocalId(),
    type: "ordering",
    prompt: "",
    items: [
      createOrderingItem(0),
      createOrderingItem(1),
      createOrderingItem(2),
    ],
  };
}

function createSentenceReorderItem(index: number): ManualSentenceReorderItem {
  return {
    id: createLocalId(),
    label: getNumberLabel(index),
    scrambledWords: "",
    correctAnswer: "",
  };
}

function createSentenceReorderQuestion(): ManualSentenceReorderQuestion {
  return {
    id: createLocalId(),
    type: "sentence-reorder",
    prompt: "",
    items: [
      createSentenceReorderItem(0),
      createSentenceReorderItem(1),
      createSentenceReorderItem(2),
    ],
  };
}

function createInlineWordChoiceOption(index: number): ManualInlineWordChoiceOption {
  return {
    id: createLocalId(),
    label: getOptionLabel(index),
    text: "",
  };
}

function createInlineWordChoiceItem(index: number): ManualInlineWordChoiceItem {
  return {
    id: createLocalId(),
    label: getNumberLabel(index),
    sentenceText: "",
    beforeText: "",
    options: [createInlineWordChoiceOption(0), createInlineWordChoiceOption(1)],
    afterText: "",
    correctAnswer: "A",
  };
}

function createInlineWordChoiceQuestion(): ManualInlineWordChoiceQuestion {
  return {
    id: createLocalId(),
    type: "inline-word-choice",
    prompt: "",
    items: [
      createInlineWordChoiceItem(0),
      createInlineWordChoiceItem(1),
      createInlineWordChoiceItem(2),
    ],
  };
}

function createPassageInlineWordChoiceItem(index: number): ManualPassageInlineWordChoiceQuestion["items"][number] {
  return {
    id: createLocalId(),
    label: getNumberLabel(index),
    options: [createInlineWordChoiceOption(0), createInlineWordChoiceOption(1)],
    correctAnswer: "A",
  };
}

function createPassageInlineWordChoiceQuestion(): ManualPassageInlineWordChoiceQuestion {
  return {
    id: createLocalId(),
    type: "passage-inline-word-choice",
    prompt: "",
    items: [
      createPassageInlineWordChoiceItem(0),
      createPassageInlineWordChoiceItem(1),
      createPassageInlineWordChoiceItem(2),
    ],
  };
}

function createPassageMCQOption(index: number): ManualPassageMCQOption {
  return {
    id: createLocalId(),
    label: getOptionLabel(index),
    text: "",
  };
}

function createPassageMCQQuestion(blankNumber: number): ManualPassageMCQQuestion {
  return {
    id: createLocalId(),
    type: "passage-mcq",
    prompt: `Blank ${blankNumber}`,
    options: [createPassageMCQOption(0), createPassageMCQOption(1), createPassageMCQOption(2)],
    correctAnswer: "A",
  };
}

/** Returns true for question types that use a word bank */
function isWordBankSubsectionType(questionType: ManualQuestionType) {
  return questionType === "fill-blank" || questionType === "passage-fill-blank";
}

function createSubsection(questionType: ManualQuestionType = DEFAULT_QUESTION_TYPE): ManualSubsection {
  if (questionType === "fill-blank") {
    const wordBank = relabelWordBank(
      Array.from({ length: DEFAULT_WORD_BANK_SIZE }, (_, index) => createWordBankItem(index)),
    );

    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      wordBank,
      questions: [createFillBlankQuestion(wordBank[0]?.id || "")],
    };
  }

  if (questionType === "passage-fill-blank") {
    const wordBank = relabelWordBank(
      Array.from({ length: DEFAULT_WORD_BANK_SIZE }, (_, index) => createWordBankItem(index)),
    );

    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      wordBank,
      passageText: "",
      questions: [],
    };
  }

  if (questionType === "passage-mcq") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      passageText: "",
      questions: [],
    };
  }

  if (questionType === "typed-fill-blank") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createTypedFillBlankQuestion()],
    };
  }

  if (questionType === "picture-spelling") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createPictureSpellingQuestion()],
    };
  }

  if (questionType === "word-completion") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createWordCompletionQuestion()],
    };
  }

  if (questionType === "passage-open-ended") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      passageText: "",
      questions: [createPassageOpenEndedQuestion()],
    };
  }

  if (questionType === "passage-inline-word-choice") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      passageText: "",
      questions: [createPassageInlineWordChoiceQuestion()],
    };
  }

  if (questionType === "writing") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createWritingQuestion()],
    };
  }

  if (questionType === "speaking") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createSpeakingQuestion()],
    };
  }

  if (questionType === "passage-matching") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      passageText: "",
      matchingDescriptions: Array.from({ length: 5 }, (_, i) => createMatchingDescription(i)),
      questions: [createPassageMatchingQuestion()],
    };
  }

  if (questionType === "true-false") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createTrueFalseQuestion()],
    };
  }

  if (questionType === "heading-match") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      passageText: "",
      matchingDescriptions: Array.from({ length: 4 }, (_, i) => createMatchingDescription(i, getNumberLabel)),
      questions: [createHeadingMatchQuestion(0)],
    };
  }

  if (questionType === "checkbox") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createCheckboxQuestion()],
    };
  }

  if (questionType === "ordering") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createOrderingQuestion()],
    };
  }

  if (questionType === "sentence-reorder") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createSentenceReorderQuestion()],
    };
  }

  if (questionType === "inline-word-choice") {
    return {
      id: createLocalId(),
      title: "",
      instructions: "",
      questionType,
      questions: [createInlineWordChoiceQuestion()],
    };
  }

  return {
    id: createLocalId(),
    title: "",
    instructions: "",
    questionType,
    questions: [createMCQQuestion()],
  };
}

function createSection(sectionType: ManualSectionType = DEFAULT_SECTION_TYPE): ManualSection {
  return {
    id: createLocalId(),
    sectionType,
    subsections: [createSubsection(getDefaultQuestionTypeForSectionType(sectionType))],
  };
}

function normalizeSectionsForQuestionBankMode(
  sections: ManualSection[],
  paperSubject: PaperSubject,
): ManualSection[] {
  const fallbackSectionType = getDefaultSectionTypeForSubject(paperSubject);
  const allowedSectionTypes = getAvailableSectionTypesForSubject(paperSubject);

  const flattened = sections.flatMap((section) => {
    const sectionType = allowedSectionTypes.includes(section.sectionType)
      ? section.sectionType
      : fallbackSectionType;
    const subsections = section.subsections.length > 0
      ? section.subsections
      : [createSubsection(getDefaultQuestionTypeForSectionType(sectionType))];

    return subsections.map((subsection) => {
      const normalizedSection = normalizeQuestionBankSection(
        {
          id: createLocalId(),
          sectionType,
          subsections: [normalizeLoadedSubsection(subsection, paperSubject, sectionType)],
        },
        paperSubject,
      );

      return normalizedSection;
    });
  });

  return flattened.length > 0 ? flattened : [createSection(fallbackSectionType)];
}

const MANUAL_SECTION_TYPES = Object.keys(MANUAL_SECTION_TYPE_LABELS) as ManualSectionType[];
const MANUAL_QUESTION_TYPES = Object.keys(MANUAL_QUESTION_TYPE_LABELS) as ManualQuestionType[];

function isManualSectionTypeValue(value: unknown): value is ManualSectionType {
  return typeof value === "string" && MANUAL_SECTION_TYPES.includes(value as ManualSectionType);
}

function isManualQuestionTypeValue(value: unknown): value is ManualQuestionType {
  return typeof value === "string" && MANUAL_QUESTION_TYPES.includes(value as ManualQuestionType);
}

function normalizeLoadedSubsection(
  rawSubsection: Partial<ManualSubsection> | undefined,
  paperSubject: PaperSubject,
  sectionType?: ManualSectionType,
): ManualSubsection {
  const rawQuestionType = isManualQuestionTypeValue(rawSubsection?.questionType)
    ? rawSubsection.questionType
    : DEFAULT_QUESTION_TYPE;
  const questionType = paperSubject === "math" && sectionType
    ? getLockedMathQuestionType(sectionType)
    : (() => {
        const allowedQuestionTypes = getAllowedQuestionTypesForSubject(paperSubject);
        return allowedQuestionTypes.includes(rawQuestionType)
          ? rawQuestionType
          : DEFAULT_QUESTION_TYPE;
      })();
  const baseSubsection = createSubsection(questionType);
  const loadedQuestions = (() => {
    if (!Array.isArray(rawSubsection?.questions)) {
      return baseSubsection.questions;
    }

    if (paperSubject === "math" && sectionType === "math-application" && rawQuestionType === "passage-open-ended") {
      return rawSubsection.questions
        .filter(isManualPassageOpenEndedQuestion)
        .map((question) => ({
          id: question.id,
          type: "typed-fill-blank" as const,
          prompt: question.prompt,
          correctAnswer: question.referenceAnswer,
        }));
    }

    if (rawQuestionType === questionType) {
      return rawSubsection.questions.filter(Boolean) as ManualQuestion[];
    }

    return baseSubsection.questions;
  })();

  return {
    ...baseSubsection,
    ...rawSubsection,
    id: typeof rawSubsection?.id === "string" && rawSubsection.id ? rawSubsection.id : baseSubsection.id,
    title: typeof rawSubsection?.title === "string" ? rawSubsection.title : "",
    instructions: typeof rawSubsection?.instructions === "string" ? rawSubsection.instructions : "",
    taskDescription:
      typeof rawSubsection?.taskDescription === "string" && rawSubsection.taskDescription.trim()
        ? rawSubsection.taskDescription
        : undefined,
    questionType,
    questions: loadedQuestions.length > 0 || baseSubsection.questions.length === 0
      ? loadedQuestions
      : baseSubsection.questions,
    wordBank: Array.isArray(rawSubsection?.wordBank)
      ? rawSubsection.wordBank
      : baseSubsection.wordBank,
    passageText: typeof rawSubsection?.passageText === "string"
      ? rawSubsection.passageText
      : baseSubsection.passageText,
    matchingDescriptions: Array.isArray(rawSubsection?.matchingDescriptions)
      ? rawSubsection.matchingDescriptions
      : baseSubsection.matchingDescriptions,
    sceneImage: rawSubsection?.sceneImage,
    audio: rawSubsection?.audio,
  };
}

function normalizeLoadedBuilderState(
  rawBlueprint: Partial<ManualPaperBlueprint> | undefined,
  paperSubject: PaperSubject,
): {
  paperSeed: string;
  createdAt: string;
  title: string;
  description: string;
  buildMode: ManualPaperBuildMode;
  visibilityMode: ManualPaperVisibilityMode;
  generationConfig: ManualPaperGenerationConfig;
  sections: ManualSection[];
} {
  const sections = Array.isArray(rawBlueprint?.sections) && rawBlueprint.sections.length > 0
    ? rawBlueprint.sections.map((rawSection) => {
        const sectionType = isManualSectionTypeValue(rawSection?.sectionType)
          && getAvailableSectionTypesForSubject(paperSubject).includes(rawSection.sectionType)
          ? rawSection.sectionType
          : getDefaultSectionTypeForSubject(paperSubject);
        const baseSection = createSection(sectionType);
        const loadedSubsections = Array.isArray(rawSection?.subsections) && rawSection.subsections.length > 0
          ? rawSection.subsections.map((subsection) => normalizeLoadedSubsection(subsection, paperSubject, sectionType))
          : baseSection.subsections;

        return {
          ...baseSection,
          ...rawSection,
          id: typeof rawSection?.id === "string" && rawSection.id ? rawSection.id : baseSection.id,
          sectionType,
          subsections: loadedSubsections,
        };
      })
    : [createSection(getDefaultSectionTypeForSubject(paperSubject))];

  const buildMode = rawBlueprint?.buildMode === "generated" ? "generated" : "fixed";
  const visibilityMode = rawBlueprint?.visibilityMode === "question-bank" ? "question-bank" : "student";
  const normalizedSections = buildMode === "fixed" && visibilityMode === "question-bank"
    ? normalizeSectionsForQuestionBankMode(sections, paperSubject)
    : sections;

  return {
    paperSeed:
      typeof rawBlueprint?.id === "string" && rawBlueprint.id
        ? rawBlueprint.id
        : createLocalId(),
    createdAt:
      typeof rawBlueprint?.createdAt === "string" && rawBlueprint.createdAt
        ? rawBlueprint.createdAt
        : new Date().toISOString(),
    title: typeof rawBlueprint?.title === "string" ? rawBlueprint.title : "",
    description: typeof rawBlueprint?.description === "string" ? rawBlueprint.description : "",
    buildMode,
    visibilityMode,
    generationConfig: rawBlueprint?.generationConfig ?? createGenerationConfig(),
    sections: normalizedSections,
  };
}

function buildExpandedImageBlockState(sections: ManualSection[]) {
  return Object.fromEntries(
    sections.flatMap((section) =>
      section.subsections
        .filter((subsection) => Boolean(subsection.sceneImage))
        .map((subsection) => [subsection.id, true] as const)
    ),
  ) as Record<string, boolean>;
}

function isManualMCQQuestion(question: ManualQuestion): question is ManualMCQQuestion {
  return question.type === "mcq";
}

function isManualFillBlankQuestion(question: ManualQuestion): question is ManualFillBlankQuestion {
  return question.type === "fill-blank";
}

function isManualPassageFillBlankQuestion(question: ManualQuestion): question is ManualPassageFillBlankQuestion {
  return question.type === "passage-fill-blank";
}

function isAnyFillBlankQuestion(question: ManualQuestion): question is ManualFillBlankQuestion | ManualPassageFillBlankQuestion {
  return question.type === "fill-blank" || question.type === "passage-fill-blank";
}

function isManualPassageMCQQuestion(question: ManualQuestion): question is ManualPassageMCQQuestion {
  return question.type === "passage-mcq";
}

function isManualTypedFillBlankQuestion(question: ManualQuestion): question is ManualTypedFillBlankQuestion {
  return question.type === "typed-fill-blank";
}

function isManualPictureSpellingQuestion(question: ManualQuestion): question is ManualPictureSpellingQuestion {
  return question.type === "picture-spelling";
}

function isManualWordCompletionQuestion(question: ManualQuestion): question is ManualWordCompletionQuestion {
  return question.type === "word-completion";
}

function isManualPassageOpenEndedQuestion(question: ManualQuestion): question is ManualPassageOpenEndedQuestion {
  return question.type === "passage-open-ended";
}

function isManualWritingQuestion(question: ManualQuestion): question is ManualWritingQuestion {
  return question.type === "writing";
}

function isManualSpeakingQuestion(question: ManualQuestion): question is ManualSpeakingQuestion {
  return question.type === "speaking";
}

function isManualPassageMatchingQuestion(question: ManualQuestion): question is ManualPassageMatchingQuestion {
  return question.type === "passage-matching";
}

function isManualTrueFalseQuestion(question: ManualQuestion): question is ManualTrueFalseQuestion {
  return question.type === "true-false";
}

function isManualHeadingMatchQuestion(question: ManualQuestion): question is ManualHeadingMatchQuestion {
  return question.type === "heading-match";
}

function isManualCheckboxQuestion(question: ManualQuestion): question is ManualCheckboxQuestion {
  return question.type === "checkbox";
}

function isManualOrderingQuestion(question: ManualQuestion): question is ManualOrderingQuestion {
  return question.type === "ordering";
}

function isManualSentenceReorderQuestion(question: ManualQuestion): question is ManualSentenceReorderQuestion {
  return question.type === "sentence-reorder";
}

function isManualInlineWordChoiceQuestion(question: ManualQuestion): question is ManualInlineWordChoiceQuestion {
  return question.type === "inline-word-choice";
}

function isManualPassageInlineWordChoiceQuestion(question: ManualQuestion): question is ManualPassageInlineWordChoiceQuestion {
  return question.type === "passage-inline-word-choice";
}

/** Returns true for question types that use a passage */
function isPassageSubsectionType(questionType: ManualQuestionType) {
  return questionType === "passage-fill-blank"
    || questionType === "passage-mcq"
    || questionType === "passage-inline-word-choice"
    || questionType === "passage-open-ended"
    || questionType === "heading-match";
}

function getMatchingLabelFactory(questionType: ManualQuestionType) {
  return questionType === "heading-match" ? getNumberLabel : getOptionLabel;
}

function buildBlueprint(
  paperSeed: string,
  createdAt: string,
  title: string,
  description: string,
  sections: ManualSection[],
  buildMode: ManualPaperBuildMode,
  visibilityMode: ManualPaperVisibilityMode,
  generationConfig: ManualPaperGenerationConfig,
): ManualPaperBlueprint {
  if (buildMode === "generated") {
    return {
      id: title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `paper-${paperSeed}`,
      title: title.trim(),
      description: description.trim(),
      buildMode,
      visibilityMode,
      generationConfig,
      sections: [],
      createdAt,
    };
  }

  return {
    id: title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `paper-${paperSeed}`,
    title: title.trim(),
    description: description.trim(),
    buildMode,
    visibilityMode,
    generationConfig,
    sections: sections.map((section, sectionIndex) => ({
      ...section,
      partLabel: visibilityMode === "question-bank" ? `Question ${sectionIndex + 1}` : `Part ${sectionIndex + 1}`,
      subsections: section.subsections.map((subsection) => {
        if (isWordBankSubsectionType(subsection.questionType)) {
          return {
            ...subsection,
            wordBank: relabelWordBank(subsection.wordBank ?? []),
            questions: subsection.questions.filter(isAnyFillBlankQuestion),
          };
        }

        if (subsection.questionType === "passage-mcq") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualPassageMCQQuestion).map((question) => ({
              ...question,
              options: relabelOptions(question.options as ManualMCQOption[]) as unknown as ManualPassageMCQOption[],
            })),
          };
        }

        if (subsection.questionType === "typed-fill-blank") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualTypedFillBlankQuestion),
          };
        }

        if (subsection.questionType === "picture-spelling") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualPictureSpellingQuestion),
          };
        }

        if (subsection.questionType === "word-completion") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualWordCompletionQuestion),
          };
        }

        if (subsection.questionType === "passage-open-ended") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualPassageOpenEndedQuestion),
          };
        }

        if (subsection.questionType === "passage-inline-word-choice") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualPassageInlineWordChoiceQuestion).map((question) => ({
              ...question,
              items: question.items.map((item, itemIndex) => {
                const options = relabelInlineWordChoiceOptions(item.options);
                const validCorrectAnswer = options.some((option) => option.label === item.correctAnswer)
                  ? item.correctAnswer
                  : options[0]?.label || "A";
                return {
                  ...item,
                  label: getNumberLabel(itemIndex),
                  options,
                  correctAnswer: validCorrectAnswer,
                };
              }),
            })),
          };
        }

        if (subsection.questionType === "writing") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualWritingQuestion),
          };
        }

        if (subsection.questionType === "speaking") {
          return {
            ...subsection,
            taskDescription: subsection.taskDescription?.trim() || undefined,
            questions: subsection.questions.filter(isManualSpeakingQuestion),
          };
        }

        if (subsection.questionType === "passage-matching") {
          return {
            ...subsection,
            matchingDescriptions: (subsection.matchingDescriptions ?? []).map((desc, i) => ({
              ...desc,
              label: getOptionLabel(i),
            })),
            questions: subsection.questions.filter(isManualPassageMatchingQuestion),
          };
        }

        if (subsection.questionType === "true-false") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualTrueFalseQuestion).map((question) => ({
              ...question,
              prompt: "",
              statements: relabelStatements(question.statements),
            })),
          };
        }

        if (subsection.questionType === "heading-match") {
          const matchingDescriptions = (subsection.matchingDescriptions ?? []).map((desc, i) => ({
            ...desc,
            label: getNumberLabel(i),
          }));
          return {
            ...subsection,
            matchingDescriptions,
            questions: subsection.questions.filter(isManualHeadingMatchQuestion).map((question, questionIndex) => ({
              ...question,
              prompt: question.prompt || `Paragraph ${getOptionLabel(questionIndex)}`,
              correctAnswer: matchingDescriptions.some((desc) => desc.label === question.correctAnswer)
                ? question.correctAnswer
                : matchingDescriptions[0]?.label || "1",
            })),
          };
        }

        if (subsection.questionType === "checkbox") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualCheckboxQuestion).map((question) => {
              const options = relabelCheckboxOptions(question.options);
              const validCorrectAnswers = question.correctAnswers.filter((answer) =>
                options.some((option) => option.label === answer),
              );
              return {
                ...question,
                options,
                correctAnswers: validCorrectAnswers.length ? validCorrectAnswers : options.slice(0, 2).map((option) => option.label),
                selectionLimit: Math.max(
                  1,
                  Math.min(question.selectionLimit ?? (validCorrectAnswers.length || 2), options.length),
                ),
              };
            }),
          };
        }

        if (subsection.questionType === "ordering") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualOrderingQuestion).map((question) => ({
              ...question,
              items: question.items.map((item, itemIndex) => ({
                ...item,
                correctPosition: Math.max(1, Math.min(item.correctPosition || itemIndex + 1, question.items.length)),
              })),
            })),
          };
        }

        if (subsection.questionType === "sentence-reorder") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualSentenceReorderQuestion).map((question) => ({
              ...question,
              prompt: "",
              items: question.items.map((item, itemIndex) => ({
                ...item,
                label: getNumberLabel(itemIndex),
              })),
            })),
          };
        }

        if (subsection.questionType === "inline-word-choice") {
          return {
            ...subsection,
            questions: subsection.questions.filter(isManualInlineWordChoiceQuestion).map((question) => ({
              ...question,
              items: question.items.map((item, itemIndex) => {
                const options = relabelInlineWordChoiceOptions(item.options);
                const validCorrectAnswer = options.some((option) => option.label === item.correctAnswer)
                  ? item.correctAnswer
                  : options[0]?.label || "A";
                return {
                  ...item,
                  label: getNumberLabel(itemIndex),
                  options,
                  correctAnswer: validCorrectAnswer,
                };
              }),
            })),
          };
        }

        return {
          ...subsection,
          questions: subsection.questions.filter(isManualMCQQuestion).map((question) => ({
            ...(() => {
              const options = relabelOptions(question.options);
              const validCorrectAnswers = (question.correctAnswers && question.correctAnswers.length > 0
                ? question.correctAnswers
                : [question.correctAnswer]
              ).filter((answer) => options.some((option) => option.label === answer));
              const normalizedCorrectAnswers = validCorrectAnswers.length > 0
                ? validCorrectAnswers
                : [options[0]?.label || "A"];
              return {
                ...question,
                options,
                correctAnswer: normalizedCorrectAnswers[0],
                correctAnswers: normalizedCorrectAnswers,
                selectionLimit: Math.max(
                  1,
                  Math.min(question.selectionLimit ?? normalizedCorrectAnswers.length, options.length),
                ),
              };
            })(),
          })),
        };
      }),
    })),
    createdAt,
  };
}

function buildFillBlankPreviewPassage(questions: ManualFillBlankQuestion[]) {
  return questions
    .map((question, questionIndex) => {
      const safePrompt = escapeHtml(question.prompt.trim() || `Sentence ${questionIndex + 1}`);

      if (safePrompt.includes("___")) {
        return safePrompt.replace("___", `<b>(${questionIndex + 1}) ___</b>`);
      }

      return `${safePrompt} <b>(${questionIndex + 1}) ___</b>`;
    })
    .join("\n\n");
}

/**
 * Build a passage preview for passage-fill-blank type.
 * The passage text contains ___ markers which we number sequentially.
 */
function buildPassageFillBlankPreviewPassage(passageText: string) {
  let blankIndex = 0;
  return escapeHtml(passageText).replace(/___/g, () => {
    blankIndex++;
    return `<b>(${blankIndex}) ___</b>`;
  });
}

/** Count the number of ___ blanks in a passage */
function countPassageBlanks(passageText: string): number {
  return (passageText.match(/___/g) || []).length;
}

function PictureSpellingSubsectionPreview({ subsection }: { subsection: ManualSubsection }) {
  const questions = subsection.questions.filter(isManualPictureSpellingQuestion);

  return (
    <div className="space-y-4">
      {questions.map((question, questionIndex) => {
        const letters = getPictureSpellingCharacters(question.correctAnswer);
        return (
          <div key={question.id} className="rounded-xl border border-white bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 md:w-40">
                {question.image ? (
                  <img
                    src={question.image.previewUrl || question.image.dataUrl}
                    alt={`Picture spelling ${questionIndex + 1}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-4 text-center text-xs text-slate-400">Upload an image</span>
                )}
              </div>
              <div className="flex-1 space-y-4">
                {question.prompt.trim() ? (
                  <p className="whitespace-pre-wrap text-sm font-medium text-slate-700">
                    {question.prompt}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {(letters.length > 0 ? letters : Array.from({ length: 5 }, () => "_")).map((_, letterIndex) => (
                    <span
                      key={`${question.id}-letter-${letterIndex}`}
                      className="inline-flex h-11 w-10 items-center justify-center rounded-lg border-2 border-slate-300 bg-white text-sm font-semibold text-slate-500"
                    >
                      _
                    </span>
                  ))}
                </div>
                <p className="text-xs font-medium text-emerald-700">
                  Correct answer: {question.correctAnswer || "(not set)"}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WordCompletionSubsectionPreview({ subsection }: { subsection: ManualSubsection }) {
  const questions = subsection.questions.filter(isManualWordCompletionQuestion);

  return (
    <div className="space-y-4">
      {questions.map((question, questionIndex) => {
        const tokens = parseWordPattern(question.wordPattern.trim() || "w__d");
        return (
          <div key={question.id} className="rounded-xl border border-white bg-white p-5 shadow-sm">
            <div className="space-y-4">
              {question.image ? (
                <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={question.image.previewUrl || question.image.dataUrl}
                    alt={`Word completion ${questionIndex + 1}`}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}
              {question.prompt.trim() ? (
                <p className="whitespace-pre-wrap text-sm font-medium text-slate-700">
                  {`${questionIndex + 1}. ${question.prompt}`}
                </p>
              ) : (
                <p className="text-sm font-medium text-slate-700">{`Question ${questionIndex + 1}`}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {tokens.map((token, tokenIndex) => (
                  token.kind === "blank" ? (
                    <span
                      key={`${question.id}-blank-${tokenIndex}`}
                      className="inline-flex h-11 w-10 items-center justify-center rounded-lg border-2 border-slate-300 bg-white text-sm font-semibold text-slate-500"
                    >
                      _
                    </span>
                  ) : (
                    <span
                      key={`${question.id}-text-${tokenIndex}`}
                      className={`inline-flex h-11 items-center justify-center px-2 text-base font-semibold ${
                        /\s/.test(token.value) ? "min-w-[10px]" : "text-slate-800"
                      }`}
                    >
                      {token.value}
                    </span>
                  )
                ))}
              </div>
              <p className="text-xs font-medium text-emerald-700">
                Correct answer: {question.correctAnswer || "(not set)"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function validateManualPaperBuilder(
  title: string,
  sections: ManualSection[],
  buildMode: ManualPaperBuildMode,
  visibilityMode: ManualPaperVisibilityMode,
  generationConfig: ManualPaperGenerationConfig,
) {
  if (visibilityMode !== "question-bank" && !title.trim()) {
    return "Enter a paper name before saving.";
  }

  if (buildMode === "generated") {
    if (!generationConfig.sections.length) {
      return "Add at least one random generation section before saving.";
    }

    for (let sectionIndex = 0; sectionIndex < generationConfig.sections.length; sectionIndex += 1) {
      const section = generationConfig.sections[sectionIndex];
      const sectionLabel = `Generated section ${sectionIndex + 1}`;
      if (section.totalQuestions <= 0) {
        return `${sectionLabel} needs a target question count.`;
      }
      if (!ENGLISH_GENERATED_SECTION_TYPES.includes(section.sectionType)) {
        return `${sectionLabel} has an unsupported section type.`;
      }
      if (!section.rules.length) {
        return `${sectionLabel} needs at least one generation rule.`;
      }

      for (let ruleIndex = 0; ruleIndex < section.rules.length; ruleIndex += 1) {
        const rule = section.rules[ruleIndex];
        if (!rule.label.trim()) {
          return `${sectionLabel} rule ${ruleIndex + 1} needs a name.`;
        }
        if (!Number.isFinite(rule.weight) || rule.weight <= 0) {
          return `${sectionLabel} rule ${ruleIndex + 1} needs a valid weight.`;
        }
      }
    }

    return null;
  }

  if (sections.length === 0) {
    return visibilityMode === "question-bank"
      ? "Add at least one question before saving."
      : "Add at least one part before saving.";
  }

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    if (section.subsections.length === 0) {
      return `Part ${sectionIndex + 1} needs at least one question block.`;
    }

    for (let subsectionIndex = 0; subsectionIndex < section.subsections.length; subsectionIndex += 1) {
      const subsection = section.subsections[subsectionIndex];
      const blockLabel = `Part ${sectionIndex + 1} Question ${subsectionIndex + 1}`;

      if (subsection.questions.length === 0) {
        return `${blockLabel} has no questions yet.`;
      }

      const wordBank = subsection.wordBank ?? [];
      const validWordBankIds = new Set(
        wordBank
          .filter((item: ManualWordBankItem) => item.word.trim().length > 0)
          .map((item: ManualWordBankItem) => item.id),
      );

      if (isWordBankSubsectionType(subsection.questionType)) {
        if (wordBank.length === 0 || validWordBankIds.size === 0) {
          return `${blockLabel} needs at least one word bank item.`;
        }
      }

      if (
        subsection.questionType === "passage-fill-blank" ||
        subsection.questionType === "passage-mcq" ||
        subsection.questionType === "passage-inline-word-choice"
      ) {
        const blankCount = countPassageBlanks(subsection.passageText ?? "");
        if (!(subsection.passageText ?? "").trim()) {
          return `${blockLabel} needs passage text.`;
        }
        if (blankCount === 0) {
          return `${blockLabel} needs at least one ___ blank in the passage.`;
        }
        if (subsection.questions.length !== blankCount && subsection.questionType !== "passage-inline-word-choice") {
          return `${blockLabel} has ${blankCount} blanks but ${subsection.questions.length} answer slots.`;
        }
      }

      if (
        subsection.questionType === "passage-open-ended"
        && section.sectionType !== "math-application"
        && !(subsection.passageText ?? "").trim()
      ) {
        return `${blockLabel} needs passage text above the questions.`;
      }

      if (subsection.questionType === "passage-matching") {
        const matchingDescriptions = subsection.matchingDescriptions ?? [];
        if (matchingDescriptions.length < 2) {
          return `${blockLabel} needs at least two matching options.`;
        }
        for (const description of matchingDescriptions) {
          if (!description.name.trim() && !description.text.trim()) {
            return `${blockLabel} has an empty matching option.`;
          }
        }
      }

      for (let questionIndex = 0; questionIndex < subsection.questions.length; questionIndex += 1) {
        const question = subsection.questions[questionIndex];
        const questionLabel = `${blockLabel} item ${questionIndex + 1}`;

        if (isManualMCQQuestion(question)) {
          if (!question.prompt.trim()) {
            return `${questionLabel} needs a question prompt.`;
          }
          if (question.options.length < 2) {
            return `${questionLabel} needs at least two options.`;
          }
          for (const option of question.options) {
            if (!option.text.trim() && !option.image) {
              return `${questionLabel} has an empty option.`;
            }
          }
          const correctAnswers = question.correctAnswers?.length ? question.correctAnswers : [question.correctAnswer];
          if (correctAnswers.length === 0) {
            return `${questionLabel} needs at least one correct answer.`;
          }
        }

        if (isManualFillBlankQuestion(question)) {
          if (!question.prompt.trim()) {
            return `${questionLabel} needs a sentence.`;
          }
          if (!question.prompt.includes("___")) {
            return `${questionLabel} should use ___ to mark the blank.`;
          }
          if (!validWordBankIds.has(question.correctAnswerWordBankId)) {
            return `${questionLabel} needs a valid word bank answer.`;
          }
        }

        if (isManualPassageFillBlankQuestion(question)) {
          if (!validWordBankIds.has(question.correctAnswerWordBankId)) {
            return `${questionLabel} needs a valid word bank answer.`;
          }
        }

        if (isManualPassageMCQQuestion(question)) {
          if (question.options.length < 2) {
            return `${questionLabel} needs at least two options.`;
          }
          if (question.options.some((option) => !option.text.trim())) {
            return `${questionLabel} has an empty option.`;
          }
        }

        if (isManualTypedFillBlankQuestion(question)) {
          if (!question.prompt.trim()) {
            return `${questionLabel} needs a sentence.`;
          }
          if (section.sectionType !== "math-short-answer" && section.sectionType !== "math-application" && !question.prompt.includes("___")) {
            return `${questionLabel} should use ___ to mark the blank.`;
          }
          if (!question.correctAnswer.trim()) {
            return `${questionLabel} needs the typed correct answer.`;
          }
        }

        if (isManualPictureSpellingQuestion(question)) {
          if (!question.image) {
            return `${questionLabel} needs an image.`;
          }
          if (!question.correctAnswer.trim()) {
            return `${questionLabel} needs the correct spelling.`;
          }
        }

        if (isManualWordCompletionQuestion(question)) {
          if (!question.wordPattern.trim()) {
            return `${questionLabel} needs a partial word pattern.`;
          }
          if (!question.wordPattern.includes("_")) {
            return `${questionLabel} needs at least one _ in the word pattern.`;
          }
          if (!question.correctAnswer.trim()) {
            return `${questionLabel} needs the completed word.`;
          }
          const blankCount = getWordPatternBlankCount(question.wordPattern);
          const normalizedAnswer = normalizeVocabularyAnswer(question.correctAnswer);
          const normalizedPatternLength = question.wordPattern.replace(/\s+/g, "").replace(/_/g, "").length + blankCount;
          if (blankCount === 0) {
            return `${questionLabel} needs at least one blank letter.`;
          }
          if (normalizedAnswer.length !== normalizedPatternLength) {
            return `${questionLabel} pattern and correct answer length do not match.`;
          }
        }

        if (isManualPassageOpenEndedQuestion(question)) {
          if (!question.prompt.trim()) {
            return `${questionLabel} needs a question prompt.`;
          }
        }

        if (isManualWritingQuestion(question)) {
          if (!question.prompt.trim()) {
            return `${questionLabel} needs a writing prompt.`;
          }
        }

        if (isManualSpeakingQuestion(question)) {
          if (!question.prompt.trim()) {
            return `${questionLabel} needs a speaking prompt.`;
          }
        }

        if (isManualPassageMatchingQuestion(question)) {
          if (!question.prompt.trim()) {
            return `${questionLabel} needs matching text.`;
          }
          const labels = new Set((subsection.matchingDescriptions ?? []).map((item: ManualMatchingDescription) => item.label));
          if (!labels.has(question.correctAnswer)) {
            return `${questionLabel} needs a valid matching answer.`;
          }
        }

        if (isManualTrueFalseQuestion(question)) {
          if (question.statements.length === 0) {
            return `${questionLabel} needs at least one statement.`;
          }
          if (question.statements.some((statement) => !statement.statement.trim())) {
            return `${questionLabel} has an empty statement.`;
          }
        }

        if (isManualOrderingQuestion(question)) {
          if (question.items.length < 2) {
            return `${questionLabel} needs at least two ordering items.`;
          }
          if (question.items.some((item) => !item.text.trim())) {
            return `${questionLabel} has an empty ordering item.`;
          }
        }

        if (isManualSentenceReorderQuestion(question)) {
          if (question.items.length === 0) {
            return `${questionLabel} needs at least one sentence item.`;
          }
          if (question.items.some((item) => !item.scrambledWords.trim() || !item.correctAnswer.trim())) {
            return `${questionLabel} needs both scrambled words and a correct sentence.`;
          }
        }

        if (isManualInlineWordChoiceQuestion(question)) {
          if (question.items.length === 0) {
            return `${questionLabel} needs at least one sentence item.`;
          }
          for (const item of question.items) {
            const sentence = buildInlineWordChoiceSentence(item).trim();
            if (!sentence) {
              return `${questionLabel} has an empty sentence.`;
            }
            if (!sentence.includes("___")) {
              return `${questionLabel} should use ___ to mark the clickable blank.`;
            }
            if (item.options.length < 2 || item.options.some((option) => !option.text.trim())) {
              return `${questionLabel} needs at least two filled options for each sentence.`;
            }
          }
        }

        if (isManualPassageInlineWordChoiceQuestion(question)) {
          if (question.items.length === 0) {
            return `${questionLabel} needs at least one passage blank.`;
          }
          for (const item of question.items) {
            if (item.options.length < 2 || item.options.some((option) => !option.text.trim())) {
              return `${questionLabel} needs at least two filled options for each blank.`;
            }
          }
        }
      }
    }
  }

  return null;
}

function buildInlineWordChoiceSentence(item: ManualInlineWordChoiceItem) {
  if (typeof item.sentenceText === "string") {
    return item.sentenceText;
  }

  const before = item.beforeText.trim();
  const after = item.afterText.trim();

  if (before && after) {
    return `${before} ___ ${after}`;
  }
  if (before) {
    return before;
  }
  if (after) {
    return after;
  }
  return "";
}

function splitInlineWordChoiceSentence(sentence: string) {
  const [beforePart = "", ...afterParts] = sentence.split("___");
  return {
    sentenceText: sentence,
    beforeText: beforePart.trim(),
    afterText: afterParts.join("___").trim(),
  };
}

function getCorrectWord(wordBank: ManualWordBankItem[] | undefined, wordBankId: string) {
  return wordBank?.find((item) => item.id === wordBankId)?.word || "";
}

function FillBlankSubsectionPreview({ subsection }: { subsection: ManualSubsection }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const wordBank = subsection.wordBank ?? [];
  const questions = useMemo(
    () => subsection.questions.filter(isManualFillBlankQuestion),
    [subsection.questions],
  );

  const previewQuestions = useMemo<FillBlankQuestion[]>(
    () =>
      questions.map((question, questionIndex) => ({
        id: questionIndex + 1,
        type: "fill-blank",
        question: question.prompt,
        correctAnswer: getCorrectWord(wordBank, question.correctAnswerWordBankId),
      })),
    [questions, wordBank],
  );

  const answerKey = useMemo(
    () =>
      questions.map((question, questionIndex) => ({
        id: questionIndex + 1,
        answer: getCorrectWord(wordBank, question.correctAnswerWordBankId) || "Not set",
      })),
    [questions, wordBank],
  );

  if (!questions.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        Add at least one blank to preview this question block.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DragDropFillBlank
        questions={previewQuestions}
        wordBank={wordBank.map((item) => ({ letter: item.letter, word: item.word || "Untitled word" }))}
        grammarPassage={buildFillBlankPreviewPassage(questions)}
        sceneImageUrl={subsection.sceneImage?.previewUrl || subsection.sceneImage?.dataUrl}
        sectionId={`manual-fillblank-preview-${subsection.id}`}
        getAnswer={(_, id) => answers[id]}
        setAnswer={(_, id, value) => {
          setAnswers((prev) => ({
            ...prev,
            [id]: value,
          }));
        }}
      />

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Answer Key</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {answerKey.map((item) => (
            <span
              key={item.id}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700"
            >
              {item.id}. {item.answer}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PassageFillBlankSubsectionPreview({ subsection }: { subsection: ManualSubsection }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const wordBank = subsection.wordBank ?? [];
  const passageText = subsection.passageText ?? "";
  const blankCount = countPassageBlanks(passageText);
  const questions = useMemo(
    () => subsection.questions.filter(isManualPassageFillBlankQuestion),
    [subsection.questions],
  );

  const previewQuestions = useMemo<FillBlankQuestion[]>(
    () =>
      Array.from({ length: blankCount }, (_, i) => ({
        id: i + 1,
        type: "fill-blank" as const,
        question: "",
        correctAnswer: questions[i]
          ? getCorrectWord(wordBank, questions[i].correctAnswerWordBankId)
          : "",
      })),
    [blankCount, questions, wordBank],
  );

  const answerKey = useMemo(
    () =>
      Array.from({ length: blankCount }, (_, i) => ({
        id: i + 1,
        answer: questions[i]
          ? getCorrectWord(wordBank, questions[i].correctAnswerWordBankId) || "Not set"
          : "Not set",
      })),
    [blankCount, questions, wordBank],
  );

  if (!passageText.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        Enter the passage text with ___ blanks to preview this question block.
      </div>
    );
  }

  if (blankCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-sm text-amber-700">
        The passage does not contain any ___ blanks. Add ___ where you want blanks to appear.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DragDropFillBlank
        questions={previewQuestions}
        wordBank={wordBank.map((item) => ({ letter: item.letter, word: item.word || "Untitled word" }))}
        grammarPassage={buildPassageFillBlankPreviewPassage(passageText)}
        sceneImageUrl={subsection.sceneImage?.previewUrl || subsection.sceneImage?.dataUrl}
        sectionId={`manual-passage-fillblank-preview-${subsection.id}`}
        getAnswer={(_, id) => answers[id]}
        setAnswer={(_, id, value) => {
          setAnswers((prev) => ({
            ...prev,
            [id]: value,
          }));
        }}
      />

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Answer Key</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {answerKey.map((item) => (
            <span
              key={item.id}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700"
            >
              {item.id}. {item.answer}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PassageInlineWordChoiceSubsectionPreview({ subsection }: { subsection: ManualSubsection }) {
  const question = useMemo(
    () => subsection.questions.find(isManualPassageInlineWordChoiceQuestion),
    [subsection.questions],
  );
  const passageText = subsection.passageText ?? "";

  if (!passageText.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        Enter the passage text with ___ blanks to preview this question block.
      </div>
    );
  }

  if (!question) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        Add a passage question to preview this block.
      </div>
    );
  }

  let blankIndex = 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <div className="space-y-3">
          {passageText.split('\n').map((paragraph, paragraphIndex) => {
            if (!paragraph.trim()) {
              return <div key={`preview-space-${paragraphIndex}`} className="h-3" />;
            }

            const parts = paragraph.split(/___/g);

            return (
              <p key={`preview-paragraph-${paragraphIndex}`} className="text-sm leading-8 text-slate-800">
                {parts.map((part, partIndex) => {
                  const item = partIndex < parts.length - 1 ? question.items[blankIndex++] : undefined;

                  return (
                    <span key={`preview-segment-${paragraphIndex}-${partIndex}`}>
                      {part}
                      {item ? (
                        <span className="mx-1 inline-flex flex-wrap items-center gap-1 align-middle">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 text-[10px] font-bold text-emerald-800">
                            {item.label}
                          </span>
                          {item.options.map((option) => (
                            <span
                              key={option.id}
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                                option.label === item.correctAnswer
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                  : "border-slate-200 bg-white text-slate-500"
                              }`}
                            >
                              {option.text || `Option ${option.label}`}
                            </span>
                          ))}
                        </span>
                      ) : partIndex < parts.length - 1 ? (
                        <span className="mx-1 inline-flex rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-400">
                          ___
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PaperIntake() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();
  const uploadFileMutation = trpc.papers.uploadFile.useMutation();
  const saveManualPaperMutation = trpc.papers.saveManualPaper.useMutation();
  const updateManualPaperMutation = trpc.papers.updateManualPaper.useMutation();
  const requestedSubject = useMemo(() => {
    const value = new URLSearchParams(search).get("subject");
    return isPaperSubjectValue(value) ? value : "english";
  }, [search]);
  const editPaperId = useMemo(
    () => new URLSearchParams(search).get("edit")?.trim() || "",
    [search],
  );
  const isEditing = editPaperId.length > 0;
  const [paperSubject, setPaperSubject] = useState<PaperSubject>(requestedSubject);
  const draftStorageKey = useMemo(
    () => getPaperBuilderDraftKey(isEditing ? editPaperId : "", paperSubject),
    [editPaperId, isEditing, paperSubject],
  );
  const [paperSeed, setPaperSeed] = useState(() => createLocalId());
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [buildMode, setBuildMode] = useState<ManualPaperBuildMode>("fixed");
  const [visibilityMode, setVisibilityMode] = useState<ManualPaperVisibilityMode>("student");
  const [generationConfig, setGenerationConfig] = useState<ManualPaperGenerationConfig>(() => createGenerationConfig());
  const [sections, setSections] = useState<ManualSection[]>([createSection(getDefaultSectionTypeForSubject(requestedSubject))]);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [currentPublished, setCurrentPublished] = useState(false);
  const [expandedImageBlocks, setExpandedImageBlocks] = useState<Record<string, boolean>>({});
  const [editingPaperMeta, setEditingPaperMeta] = useState<{ id: number; paperId: string; published: boolean } | null>(null);
  const [hasHydratedEditState, setHasHydratedEditState] = useState(false);
  const [hasRestoredLocalDraft, setHasRestoredLocalDraft] = useState(false);
  const [activePreviewSubsectionId, setActivePreviewSubsectionId] = useState<string | null>(null);
  const autosavePausedRef = useRef(false);
  const previewColumnRef = useRef<HTMLDivElement | null>(null);
  const availableSectionTypes = useMemo(() => getAvailableSectionTypesForSubject(paperSubject), [paperSubject]);
  const questionTypeGroups = useMemo(() => getQuestionTypeGroupsForSubject(paperSubject), [paperSubject]);
  const isMathPaper = paperSubject === "math";
  const isEnglishPaper = paperSubject === "english";
  const publishedManualPapersQuery = trpc.papers.listManualPapers.useQuery(undefined, {
    staleTime: 5_000,
  });
  const isQuestionBankMode = buildMode === "fixed" && visibilityMode === "question-bank";
  const managerHref = isQuestionBankMode
    ? `/question-bank?subject=${paperSubject}`
    : `/paper-manager?subject=${paperSubject}`;
  const isLegacyGeneratedMode = isEditing && isEnglishPaper && buildMode === "generated";
  const showPreviewActionCard = buildMode === "fixed";
  const effectiveTitle = isQuestionBankMode ? (title.trim() || getDefaultQuestionBankTitle(paperSubject)) : title;
  const effectiveDescription = isQuestionBankMode ? "" : description;
  const draftActionLabel = isQuestionBankMode
    ? (isEditing ? "Save Question Draft Changes" : "Save Question Draft")
    : (isEditing ? "Save Draft Changes" : "Save Draft");
  const publishActionLabel = isQuestionBankMode
    ? (isEditing && currentPublished ? "Update Question Bank" : "Submit Question Bank")
    : (isEditing && currentPublished ? "Update Published Paper" : "Publish Paper");

  const editPaperQuery = trpc.papers.getManualPaperDetail.useQuery(
    { paperId: editPaperId },
    {
      enabled: isEditing,
      staleTime: 0,
      retry: false,
    },
  );

  const blueprint = useMemo(
    () => buildBlueprint(paperSeed, createdAt, effectiveTitle, effectiveDescription, sections, buildMode, visibilityMode, generationConfig),
    [buildMode, createdAt, effectiveDescription, effectiveTitle, generationConfig, paperSeed, sections, visibilityMode],
  );
  const publishedEnglishSourcePapers = useMemo<GeneratedSourcePaperOption[]>(() => {
    return (publishedManualPapersQuery.data ?? []).flatMap((paper) => {
      if (paper.subject !== "english") return [];
      try {
        const parsedBlueprint = JSON.parse(paper.blueprintJson) as ManualPaperBlueprint;
        if (getBlueprintBuildMode(parsedBlueprint) !== "fixed") return [];
        return [{
          paperId: paper.paperId,
          title: paper.title,
          totalQuestions: paper.totalQuestions,
          hiddenFromStudentSelection: getBlueprintVisibilityMode(parsedBlueprint) === "question-bank",
        }];
      } catch {
        return [];
      }
    });
  }, [publishedManualPapersQuery.data]);
  const generatedPreview = useMemo(() => {
    if (buildMode !== "generated") return null;
    const sourcePapers = (publishedManualPapersQuery.data ?? []).flatMap((paper) => {
      if (paper.subject !== "english") return [];
      try {
        const parsedBlueprint = JSON.parse(paper.blueprintJson) as ManualPaperBlueprint;
        if (getBlueprintBuildMode(parsedBlueprint) !== "fixed") return [];
        return [{
          paperId: paper.paperId,
          title: paper.title,
          blueprint: parsedBlueprint,
        }];
      } catch {
        return [];
      }
    });
    return generatePaperFromTaggedSources(blueprint, sourcePapers);
  }, [blueprint, buildMode, publishedManualPapersQuery.data]);
  const previewBlueprint = buildMode === "generated" && generatedPreview
    ? generatedPreview.blueprint
    : blueprint;
  const hasAnyQuestions = useMemo(
    () => sections.some((section) => section.subsections.some((subsection) => subsection.questions.length > 0)),
    [sections],
  );
  const isStickyPreviewMode = buildMode === "fixed";
  const getQuestionBankDisplayId = (section: ManualSection) =>
    formatQuestionBankItemId(paperSubject, section.subsections[0]?.id ?? section.id);

  useEffect(() => {
    if (!isEditing) {
      setPaperSubject(requestedSubject);
    }
  }, [isEditing, requestedSubject]);

  useEffect(() => {
    if (isEditing) return;

    autosavePausedRef.current = true;
    const nextSection = createSection(getDefaultSectionTypeForSubject(requestedSubject));
    setPaperSubject(requestedSubject);
    setPaperSeed(createLocalId());
    setCreatedAt(new Date().toISOString());
    setTitle("");
    setDescription("");
    setBuildMode("fixed");
    setVisibilityMode("student");
    setGenerationConfig(createGenerationConfig());
    setSections([nextSection]);
    setExpandedImageBlocks(buildExpandedImageBlockState([nextSection]));
    setSaveFeedback(null);
    setCurrentPublished(false);
    setHasRestoredLocalDraft(false);
    setActivePreviewSubsectionId(nextSection.subsections[0]?.id ?? null);

    const timeout = window.setTimeout(() => {
      autosavePausedRef.current = false;
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [isEditing, requestedSubject]);

  useEffect(() => {
    if (!isEditing || !editPaperQuery.data || hasHydratedEditState) return;

    try {
      const parsedBlueprint = JSON.parse(editPaperQuery.data.blueprintJson) as Partial<ManualPaperBlueprint>;
      const loadedSubject = isPaperSubjectValue(editPaperQuery.data.subject)
        ? editPaperQuery.data.subject
        : requestedSubject;
      const normalized = normalizeLoadedBuilderState(parsedBlueprint, loadedSubject);
      setPaperSubject(loadedSubject);
      setPaperSeed(normalized.paperSeed);
      setCreatedAt(normalized.createdAt);
      setTitle(editPaperQuery.data.title || normalized.title);
      setDescription(editPaperQuery.data.description || normalized.description);
      setBuildMode(normalized.buildMode);
      setVisibilityMode(normalized.visibilityMode);
      setGenerationConfig(normalized.generationConfig);
      setSections(normalized.sections);
      setExpandedImageBlocks(buildExpandedImageBlockState(normalized.sections));
      setEditingPaperMeta({
        id: editPaperQuery.data.id,
        paperId: editPaperQuery.data.paperId,
        published: editPaperQuery.data.published,
      });
      setCurrentPublished(editPaperQuery.data.published);
      setHasHydratedEditState(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load the paper for editing.");
      navigate(managerHref);
    }
  }, [editPaperQuery.data, hasHydratedEditState, isEditing, navigate, requestedSubject]);

  useEffect(() => {
    if (!editPaperQuery.error) return;
    toast.error(editPaperQuery.error.message || "Failed to load the paper for editing.");
    navigate(managerHref);
  }, [editPaperQuery.error, navigate]);

  useEffect(() => {
    if (hasRestoredLocalDraft) return;
    if (isEditing && !hasHydratedEditState) return;

    const draft = readPaperBuilderDraft(draftStorageKey, paperSubject);
    if (draft) {
      setPaperSubject(draft.subject);
      const normalized = normalizeLoadedBuilderState(draft as unknown as Partial<ManualPaperBlueprint>, draft.subject);
      setPaperSeed(normalized.paperSeed);
      setCreatedAt(normalized.createdAt);
      setTitle(normalized.title);
      setDescription(normalized.description);
      setBuildMode(normalized.buildMode);
      setVisibilityMode(normalized.visibilityMode);
      setGenerationConfig(normalized.generationConfig);
      setSections(normalized.sections);
      setExpandedImageBlocks(buildExpandedImageBlockState(normalized.sections));
      toast.success("Recovered your last unsaved draft.");
    }

    setHasRestoredLocalDraft(true);
  }, [draftStorageKey, hasHydratedEditState, hasRestoredLocalDraft, isEditing, paperSubject]);

  useEffect(() => {
    if (!hasRestoredLocalDraft) return;
    if (isEditing && !hasHydratedEditState) return;
    if (autosavePausedRef.current) return;

    const timeout = window.setTimeout(() => {
      writePaperBuilderDraft(draftStorageKey, {
        version: 2,
        subject: paperSubject,
        paperSeed,
        createdAt,
        title,
        description,
        buildMode,
        visibilityMode,
        generationConfig,
        sections,
        savedAt: new Date().toISOString(),
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    createdAt,
    description,
    draftStorageKey,
    buildMode,
    generationConfig,
    hasHydratedEditState,
    hasRestoredLocalDraft,
    isEditing,
    paperSeed,
    paperSubject,
    sections,
    title,
    visibilityMode,
  ]);

  useEffect(() => {
    setSaveFeedback(null);
  }, [buildMode, description, generationConfig, sections, title, visibilityMode]);

  useEffect(() => {
    if (buildMode === "generated" && visibilityMode === "question-bank") {
      setVisibilityMode("student");
    }
  }, [buildMode, visibilityMode]);

  useEffect(() => {
    if (buildMode !== "fixed" || !activePreviewSubsectionId || !previewColumnRef.current) return;

    const target = previewColumnRef.current.querySelector<HTMLElement>(
      `[data-preview-subsection-id="${activePreviewSubsectionId}"]`,
    );
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activePreviewSubsectionId, buildMode]);

  useEffect(() => {
    if (buildMode !== "fixed") return;
    const firstSubsectionId = sections[0]?.subsections[0]?.id ?? null;
    if (!firstSubsectionId) return;
    if (!activePreviewSubsectionId || !sections.some((section) => section.subsections.some((subsection) => subsection.id === activePreviewSubsectionId))) {
      setActivePreviewSubsectionId(firstSubsectionId);
    }
  }, [activePreviewSubsectionId, buildMode, sections]);

  const getSubsectionTrackingProps = (subsectionId: string) => ({
    onFocusCapture: () => {
      if (buildMode === "fixed") {
        setActivePreviewSubsectionId(subsectionId);
      }
    },
    onClick: () => {
      if (buildMode === "fixed") {
        setActivePreviewSubsectionId(subsectionId);
      }
    },
  });

  const activateFixedMode = () => {
    setBuildMode("fixed");
    setVisibilityMode("student");
  };

  const activateQuestionBankMode = () => {
    setBuildMode("fixed");
    setVisibilityMode("question-bank");
    setSections((prev) => {
      const next = normalizeSectionsForQuestionBankMode(prev, paperSubject);
      setExpandedImageBlocks(buildExpandedImageBlockState(next));
      return next;
    });
  };

  const handleSubjectSelection = (nextSubject: PaperSubject) => {
    if (nextSubject === requestedSubject) return;
    navigate(`/paper-intake?subject=${nextSubject}`);
  };

  const getDurableAssetUrl = (value?: string) => {
    if (!value) return undefined;
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
      return value;
    }
    return undefined;
  };

  /** Persist durable asset URLs when available, otherwise keep embedded data for reliability. */
  const prepareBlueprintForSave = (bp: ManualPaperBlueprint): ManualPaperBlueprint => {
    const stripImage = (img?: ManualOptionImage): ManualOptionImage | undefined => {
      if (!img) return undefined;
      const durableUrl = getDurableAssetUrl(img.previewUrl) ?? getDurableAssetUrl(img.dataUrl);
      return {
        ...img,
        dataUrl: durableUrl ?? img.dataUrl,
        previewUrl: durableUrl,
      };
    };
    const stripAudio = (audio?: ManualAudioFile): ManualAudioFile | undefined => {
      if (!audio) return undefined;
      const durableUrl = getDurableAssetUrl(audio.previewUrl) ?? getDurableAssetUrl(audio.dataUrl);
      return {
        ...audio,
        dataUrl: durableUrl ?? audio.dataUrl,
        previewUrl: durableUrl,
      };
    };
    return {
      ...bp,
      sections: bp.sections.map((section) => ({
        ...section,
        subsections: section.subsections.map((sub) => ({
          ...sub,
          sceneImage: stripImage(sub.sceneImage),
          audio: stripAudio(sub.audio),
          questions: sub.questions.map((q) => {
            if (q.type === "mcq") {
              return { ...q, options: q.options.map((opt) => ({ ...opt, image: stripImage(opt.image) })) };
            }
            if (q.type === "writing" && (q as ManualWritingQuestion).image) {
              return { ...q, image: stripImage((q as ManualWritingQuestion).image) };
            }
            if (q.type === "speaking" && (q as ManualSpeakingQuestion).image) {
              return { ...q, image: stripImage((q as ManualSpeakingQuestion).image) };
            }
            if (q.type === "picture-spelling" && (q as ManualPictureSpellingQuestion).image) {
              return { ...q, image: stripImage((q as ManualPictureSpellingQuestion).image) };
            }
            if (q.type === "word-completion" && (q as ManualWordCompletionQuestion).image) {
              return { ...q, image: stripImage((q as ManualWordCompletionQuestion).image) };
            }
            return q;
          }),
        })),
      })),
    };
  };

  const updateSection = (sectionId: string, updater: (section: ManualSection) => ManualSection) => {
    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) {
        return section;
      }

      const nextSection = updater(section);
      return isQuestionBankMode ? normalizeQuestionBankSection(nextSection, paperSubject) : nextSection;
    }));
  };

  const updateSubsection = (
    sectionId: string,
    subsectionId: string,
    updater: (subsection: ManualSubsection) => ManualSubsection,
  ) => {
    updateSection(sectionId, (section) => ({
      ...section,
      subsections: section.subsections.map((subsection) => (
        subsection.id === subsectionId ? updater(subsection) : subsection
      )),
    }));
  };

  const updateQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualQuestion) => ManualQuestion,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => ({
      ...subsection,
      questions: subsection.questions.map((question) => (
        question.id === questionId ? updater(question) : question
      )),
    }));
  };

  const updateQuestionTags = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    tags: ManualQuestionTags | undefined,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      tags,
    }));
  };

  const updateSubsectionQuestionTags = (
    sectionId: string,
    subsectionId: string,
    tags: ManualQuestionTags | undefined,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => ({
      ...subsection,
      sharedQuestionTags: tags,
      questions: subsection.questions.map((question) => ({
        ...question,
        tags,
      })),
    }));
  };

  const renderQuestionTagEditor = (
    sectionId: string,
    subsectionId: string,
    question: ManualQuestion,
    sectionType: ManualSectionType,
  ) => {
    if (paperSubject === "english") {
      return (
        <EnglishQuestionTagEditor
          value={question.tags}
          sectionType={sectionType}
          questionType={question.type}
          onChange={(nextTags) => updateQuestionTags(sectionId, subsectionId, question.id, nextTags)}
        />
      );
    }

    if (paperSubject === "math" || paperSubject === "vocabulary") {
      return (
        <SubjectQuestionTagEditor
          subject={paperSubject}
          value={question.tags}
          onChange={(nextTags) => updateQuestionTags(sectionId, subsectionId, question.id, nextTags)}
        />
      );
    }

    return null;
  };

  const renderSharedPassageTagEditor = (
    sectionId: string,
    subsectionId: string,
    subsection: ManualSubsection,
    sectionType: ManualSectionType,
  ) => {
    if (!isQuestionBankMode) return null;

    const sourceQuestion = subsection.questions[0];
    const sharedTags = sourceQuestion?.tags ?? subsection.sharedQuestionTags;
    const sharedQuestionType = sourceQuestion?.type ?? subsection.questionType;

    if (paperSubject === "english") {
      return (
        <EnglishQuestionTagEditor
          value={sharedTags}
          sectionType={sectionType}
          questionType={sharedQuestionType}
          onChange={(nextTags) => updateSubsectionQuestionTags(sectionId, subsectionId, nextTags)}
        />
      );
    }

    if (paperSubject === "math" || paperSubject === "vocabulary") {
      return (
        <SubjectQuestionTagEditor
          subject={paperSubject}
          value={sharedTags}
          onChange={(nextTags) => updateSubsectionQuestionTags(sectionId, subsectionId, nextTags)}
        />
      );
    }

    return null;
  };

  const toggleImageBlock = (subsectionId: string, currentValue: boolean) => {
    setExpandedImageBlocks((prev) => ({
      ...prev,
      [subsectionId]: !currentValue,
    }));
  };

  const updateMCQQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualMCQQuestion) => ManualMCQQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualMCQQuestion(question) ? updater(question) : question
    ));
  };

  const updateFillBlankQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualFillBlankQuestion) => ManualFillBlankQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualFillBlankQuestion(question) ? updater(question) : question
    ));
  };

  const updatePassageFillBlankQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPassageFillBlankQuestion) => ManualPassageFillBlankQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPassageFillBlankQuestion(question) ? updater(question) : question
    ));
  };

  const updatePassageMCQQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPassageMCQQuestion) => ManualPassageMCQQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPassageMCQQuestion(question) ? updater(question) : question
    ));
  };

  const updateTypedFillBlankQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualTypedFillBlankQuestion) => ManualTypedFillBlankQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualTypedFillBlankQuestion(question) ? updater(question) : question
    ));
  };

  const updatePictureSpellingQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPictureSpellingQuestion) => ManualPictureSpellingQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPictureSpellingQuestion(question) ? updater(question) : question
    ));
  };

  const updateWordCompletionQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualWordCompletionQuestion) => ManualWordCompletionQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualWordCompletionQuestion(question) ? updater(question) : question
    ));
  };

  const updatePassageOpenEndedQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPassageOpenEndedQuestion) => ManualPassageOpenEndedQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPassageOpenEndedQuestion(question) ? updater(question) : question
    ));
  };

  const updateWritingQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualWritingQuestion) => ManualWritingQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualWritingQuestion(question) ? updater(question) : question
    ));
  };

  const updateSpeakingQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualSpeakingQuestion) => ManualSpeakingQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualSpeakingQuestion(question) ? updater(question) : question
    ));
  };

  const updatePassageMatchingQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPassageMatchingQuestion) => ManualPassageMatchingQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPassageMatchingQuestion(question) ? updater(question) : question
    ));
  };

  const updateTrueFalseQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualTrueFalseQuestion) => ManualTrueFalseQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualTrueFalseQuestion(question) ? updater(question) : question
    ));
  };

  const updateHeadingMatchQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualHeadingMatchQuestion) => ManualHeadingMatchQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualHeadingMatchQuestion(question) ? updater(question) : question
    ));
  };

  const updateCheckboxQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualCheckboxQuestion) => ManualCheckboxQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualCheckboxQuestion(question) ? updater(question) : question
    ));
  };

  const updateOrderingQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualOrderingQuestion) => ManualOrderingQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualOrderingQuestion(question) ? updater(question) : question
    ));
  };

  const updateSentenceReorderQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualSentenceReorderQuestion) => ManualSentenceReorderQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualSentenceReorderQuestion(question) ? updater(question) : question
    ));
  };

  const updateInlineWordChoiceQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualInlineWordChoiceQuestion) => ManualInlineWordChoiceQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualInlineWordChoiceQuestion(question) ? updater(question) : question
    ));
  };

  const updatePassageInlineWordChoiceQuestion = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    updater: (question: ManualPassageInlineWordChoiceQuestion) => ManualPassageInlineWordChoiceQuestion,
  ) => {
    updateQuestion(sectionId, subsectionId, questionId, (question) => (
      isManualPassageInlineWordChoiceQuestion(question) ? updater(question) : question
    ));
  };

  const addMatchingDescription = (sectionId: string, subsectionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      const descriptions = subsection.matchingDescriptions ?? [];
      const labelFactory = getMatchingLabelFactory(subsection.questionType);
      return {
        ...subsection,
        matchingDescriptions: [
          ...descriptions,
          createMatchingDescription(descriptions.length, labelFactory),
        ],
      };
    });
  };

  const removeMatchingDescription = (sectionId: string, subsectionId: string, descriptionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      const descriptions = subsection.matchingDescriptions ?? [];
      if (descriptions.length <= 2) return subsection;
      const labelFactory = getMatchingLabelFactory(subsection.questionType);
      const nextDescriptions = descriptions
        .filter((d) => d.id !== descriptionId)
        .map((d, i) => ({ ...d, label: labelFactory(i) }));
      // Update any question correctAnswers that referenced the removed label
      const removedLabel = descriptions.find((d) => d.id === descriptionId)?.label || "";
      return {
        ...subsection,
        matchingDescriptions: nextDescriptions,
        questions: subsection.questions.map((q) => {
          if (!isManualPassageMatchingQuestion(q) && !isManualHeadingMatchQuestion(q)) return q;
          if (q.correctAnswer === removedLabel || !nextDescriptions.some((desc) => desc.label === q.correctAnswer)) {
            return { ...q, correctAnswer: nextDescriptions[0]?.label || "A" };
          }
          return q;
        }),
      };
    });
  };

  const addTrueFalseStatement = (sectionId: string, subsectionId: string, questionId: string) => {
    updateTrueFalseQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      statements: [
        ...question.statements,
        createTrueFalseStatement(question.statements.length),
      ],
    }));
  };

  const removeTrueFalseStatement = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    statementId: string,
  ) => {
    updateTrueFalseQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.statements.length <= 1) return question;
      return {
        ...question,
        statements: relabelStatements(question.statements.filter((statement) => statement.id !== statementId)),
      };
    });
  };

  const updateTrueFalseStatement = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    statementId: string,
    updater: (statement: ManualTrueFalseStatement) => ManualTrueFalseStatement,
  ) => {
    updateTrueFalseQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      statements: question.statements.map((statement) => (
        statement.id === statementId ? updater(statement) : statement
      )),
    }));
  };

  const addCheckboxOption = (sectionId: string, subsectionId: string, questionId: string) => {
    updateCheckboxQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: [...question.options, createCheckboxOption(question.options.length)],
    }));
  };

  const removeCheckboxOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    optionId: string,
  ) => {
    updateCheckboxQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.options.length <= 2) return question;
      const nextOptions = relabelCheckboxOptions(question.options.filter((option) => option.id !== optionId));
      const validCorrectAnswers = question.correctAnswers.filter((answer) =>
        nextOptions.some((option) => option.label === answer),
      );

      return {
        ...question,
        options: nextOptions,
        correctAnswers: validCorrectAnswers,
        selectionLimit: Math.max(
          1,
          Math.min(question.selectionLimit ?? (validCorrectAnswers.length || 2), nextOptions.length),
        ),
      };
    });
  };

  const updateCheckboxOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    optionId: string,
    updater: (option: ManualCheckboxOption) => ManualCheckboxOption,
  ) => {
    updateCheckboxQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: question.options.map((option) => (
        option.id === optionId ? updater(option) : option
      )),
    }));
  };

  const addOrderingItem = (sectionId: string, subsectionId: string, questionId: string) => {
    updateOrderingQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      items: [...question.items, createOrderingItem(question.items.length)],
    }));
  };

  const removeOrderingItem = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
  ) => {
    updateOrderingQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.items.length <= 2) return question;
      const nextItems = question.items.filter((item) => item.id !== itemId);
      return {
        ...question,
        items: nextItems.map((item, itemIndex) => ({
          ...item,
          correctPosition: Math.min(item.correctPosition, nextItems.length) || itemIndex + 1,
        })),
      };
    });
  };

  const updateOrderingItem = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
    updater: (item: ManualOrderingItem) => ManualOrderingItem,
  ) => {
    updateOrderingQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      items: question.items.map((item) => (
        item.id === itemId ? updater(item) : item
      )),
    }));
  };

  const addSentenceReorderItem = (sectionId: string, subsectionId: string, questionId: string) => {
    updateSentenceReorderQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      items: [
        ...question.items,
        createSentenceReorderItem(question.items.length),
      ],
    }));
  };

  const removeSentenceReorderItem = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
  ) => {
    updateSentenceReorderQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.items.length <= 1) return question;
      return {
        ...question,
        items: question.items
          .filter((item) => item.id !== itemId)
          .map((item, itemIndex) => ({
            ...item,
            label: getNumberLabel(itemIndex),
          })),
      };
    });
  };

  const updateSentenceReorderItem = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
    updater: (item: ManualSentenceReorderItem) => ManualSentenceReorderItem,
  ) => {
    updateSentenceReorderQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      items: question.items.map((item) => (
        item.id === itemId ? updater(item) : item
      )),
    }));
  };

  const addInlineWordChoiceItem = (sectionId: string, subsectionId: string, questionId: string) => {
    updateInlineWordChoiceQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      items: [
        ...question.items,
        createInlineWordChoiceItem(question.items.length),
      ],
    }));
  };

  const removeInlineWordChoiceItem = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
  ) => {
    updateInlineWordChoiceQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.items.length <= 1) return question;
      return {
        ...question,
        items: question.items
          .filter((item) => item.id !== itemId)
          .map((item, itemIndex) => ({
            ...item,
            label: getNumberLabel(itemIndex),
          })),
      };
    });
  };

  const updateInlineWordChoiceItem = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
    updater: (item: ManualInlineWordChoiceItem) => ManualInlineWordChoiceItem,
  ) => {
    updateInlineWordChoiceQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      items: question.items.map((item) => (
        item.id === itemId ? updater(item) : item
      )),
    }));
  };

  const addPassageInlineWordChoiceOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
  ) => {
    updatePassageInlineWordChoiceQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      items: question.items.map((item) => (
        item.id === itemId
          ? {
              ...item,
              options: [...item.options, createInlineWordChoiceOption(item.options.length)],
            }
          : item
      )),
    }));
  };

  const removePassageInlineWordChoiceOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
    optionId: string,
  ) => {
    updatePassageInlineWordChoiceQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      items: question.items.map((item) => {
        if (item.id !== itemId || item.options.length <= 2) return item;
        const nextOptions = relabelInlineWordChoiceOptions(item.options.filter((option) => option.id !== optionId));
        const hasCorrect = nextOptions.some((option) => option.label === item.correctAnswer);
        return {
          ...item,
          options: nextOptions,
          correctAnswer: hasCorrect ? item.correctAnswer : nextOptions[0]?.label || "A",
        };
      }),
    }));
  };

  const updatePassageInlineWordChoiceOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
    optionId: string,
    updater: (option: ManualInlineWordChoiceOption) => ManualInlineWordChoiceOption,
  ) => {
    updatePassageInlineWordChoiceQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      items: question.items.map((item) => (
        item.id === itemId
          ? {
              ...item,
              options: item.options.map((option) => (
                option.id === optionId ? updater(option) : option
              )),
            }
          : item
      )),
    }));
  };

  const addInlineWordChoiceOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
  ) => {
    updateInlineWordChoiceItem(sectionId, subsectionId, questionId, itemId, (item) => ({
      ...item,
      options: [...item.options, createInlineWordChoiceOption(item.options.length)],
    }));
  };

  const removeInlineWordChoiceOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
    optionId: string,
  ) => {
    updateInlineWordChoiceItem(sectionId, subsectionId, questionId, itemId, (item) => {
      if (item.options.length <= 2) return item;
      const nextOptions = relabelInlineWordChoiceOptions(item.options.filter((option) => option.id !== optionId));
      const validCorrectAnswer = nextOptions.some((option) => option.label === item.correctAnswer)
        ? item.correctAnswer
        : nextOptions[0]?.label || "A";
      return {
        ...item,
        options: nextOptions,
        correctAnswer: validCorrectAnswer,
      };
    });
  };

  const updateInlineWordChoiceOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    itemId: string,
    optionId: string,
    updater: (option: ManualInlineWordChoiceOption) => ManualInlineWordChoiceOption,
  ) => {
    updateInlineWordChoiceItem(sectionId, subsectionId, questionId, itemId, (item) => ({
      ...item,
      options: item.options.map((option) => (
        option.id === optionId ? updater(option) : option
      )),
    }));
  };

  const updateMatchingDescription = (
    sectionId: string,
    subsectionId: string,
    descriptionId: string,
    updater: (desc: ManualMatchingDescription) => ManualMatchingDescription,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => ({
      ...subsection,
      matchingDescriptions: (subsection.matchingDescriptions ?? []).map((d) =>
        d.id === descriptionId ? updater(d) : d,
      ),
    }));
  };

  const handleWritingImageUpload = async (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const compressedFile = await compressImage(file, "scene");
      const fileBase64 = await fileToBase64(compressedFile);
      const dataUrl = `data:${compressedFile.type};base64,${fileBase64}`;
      let previewUrl = URL.createObjectURL(compressedFile);

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `writing-${compressedFile.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: compressedFile.type,
          fileBase64,
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to the in-browser preview URL when upload is unavailable.
      }

      updateWritingQuestion(sectionId, subsectionId, questionId, (question) => ({
        ...question,
        image: {
          dataUrl,
          previewUrl,
          fileName: compressedFile.name,
          mimeType: compressedFile.type,
          size: compressedFile.size,
        },
      }));

      toast.success("Writing prompt image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const handleSpeakingImageUpload = async (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const compressedFile = await compressImage(file, "scene");
      const fileBase64 = await fileToBase64(compressedFile);
      const dataUrl = `data:${compressedFile.type};base64,${fileBase64}`;
      let previewUrl = URL.createObjectURL(compressedFile);

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `speaking-${compressedFile.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: compressedFile.type,
          fileBase64,
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to the in-browser preview URL when upload is unavailable.
      }

      updateSpeakingQuestion(sectionId, subsectionId, questionId, (question) => ({
        ...question,
        image: {
          dataUrl,
          previewUrl,
          fileName: compressedFile.name,
          mimeType: compressedFile.type,
          size: compressedFile.size,
        },
      }));

      toast.success("Speaking prompt image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const handlePictureSpellingImageUpload = async (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const compressedFile = await compressImage(file, "scene");
      const fileBase64 = await fileToBase64(compressedFile);
      const dataUrl = `data:${compressedFile.type};base64,${fileBase64}`;
      let previewUrl = URL.createObjectURL(compressedFile);

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `vocabulary-picture-${compressedFile.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: compressedFile.type,
          fileBase64,
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to local preview when upload is unavailable.
      }

      updatePictureSpellingQuestion(sectionId, subsectionId, questionId, (question) => ({
        ...question,
        image: {
          dataUrl,
          previewUrl,
          fileName: compressedFile.name,
          mimeType: compressedFile.type,
          size: compressedFile.size,
        },
      }));

      toast.success("Vocabulary image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const handleWordCompletionImageUpload = async (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const compressedFile = await compressImage(file, "scene");
      const fileBase64 = await fileToBase64(compressedFile);
      const dataUrl = `data:${compressedFile.type};base64,${fileBase64}`;
      let previewUrl = URL.createObjectURL(compressedFile);

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `vocabulary-completion-${compressedFile.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: compressedFile.type,
          fileBase64,
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to local preview when upload is unavailable.
      }

      updateWordCompletionQuestion(sectionId, subsectionId, questionId, (question) => ({
        ...question,
        image: {
          dataUrl,
          previewUrl,
          fileName: compressedFile.name,
          mimeType: compressedFile.type,
          size: compressedFile.size,
        },
      }));

      toast.success("Word completion image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const addSection = () => {
    setSections((prev) => [...prev, createSection(getDefaultSectionTypeForSubject(paperSubject))]);
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => (prev.length > 1 ? prev.filter((section) => section.id !== sectionId) : prev));
  };

  const addSubsection = (sectionId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      subsections: [...section.subsections, createSubsection(getDefaultQuestionTypeForSectionType(section.sectionType))],
    }));
  };

  const removeSubsection = (sectionId: string, subsectionId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      subsections:
        section.subsections.length > 1
          ? section.subsections.filter((subsection) => subsection.id !== subsectionId)
          : section.subsections,
    }));
  };

  const changeSubsectionQuestionType = (
    sectionId: string,
    subsectionId: string,
    nextQuestionType: ManualQuestionType,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (subsection.questionType === nextQuestionType || getDisplayedQuestionType(subsection.questionType) === nextQuestionType) {
        return subsection;
      }

      const nextSubsection = createSubsection(nextQuestionType);

      return {
        ...subsection,
        questionType: nextQuestionType,
        wordBank: nextSubsection.wordBank,
        questions: nextSubsection.questions,
        passageText: nextSubsection.passageText,
        matchingDescriptions: nextSubsection.matchingDescriptions,
      };
    });
  };

  const addQuestion = (sectionId: string, subsectionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (subsection.questionType === "fill-blank") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualFillBlankQuestion),
            createFillBlankQuestion(subsection.wordBank?.[0]?.id || ""),
          ],
        };
      }

      if (subsection.questionType === "passage-fill-blank") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualPassageFillBlankQuestion),
            createPassageFillBlankQuestion(subsection.wordBank?.[0]?.id || ""),
          ],
        };
      }

      if (subsection.questionType === "typed-fill-blank") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualTypedFillBlankQuestion),
            createTypedFillBlankQuestion(),
          ],
        };
      }

      if (subsection.questionType === "picture-spelling") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualPictureSpellingQuestion),
            createPictureSpellingQuestion(),
          ],
        };
      }

      if (subsection.questionType === "word-completion") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualWordCompletionQuestion),
            createWordCompletionQuestion(),
          ],
        };
      }

      if (subsection.questionType === "passage-open-ended") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualPassageOpenEndedQuestion),
            createPassageOpenEndedQuestion(),
          ],
        };
      }

      // Writing type: typically only 1 question per subsection, but allow adding more
      if (subsection.questionType === "writing") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualWritingQuestion),
            createWritingQuestion(),
          ],
        };
      }

      if (subsection.questionType === "speaking") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualSpeakingQuestion),
            createSpeakingQuestion(),
          ],
        };
      }

      if (subsection.questionType === "passage-matching") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualPassageMatchingQuestion),
            createPassageMatchingQuestion(),
          ],
        };
      }

      if (subsection.questionType === "true-false") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualTrueFalseQuestion),
            createTrueFalseQuestion(),
          ],
        };
      }

      if (subsection.questionType === "heading-match") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualHeadingMatchQuestion),
            createHeadingMatchQuestion(subsection.questions.filter(isManualHeadingMatchQuestion).length),
          ],
        };
      }

      if (subsection.questionType === "checkbox") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualCheckboxQuestion),
            createCheckboxQuestion(),
          ],
        };
      }

      if (subsection.questionType === "ordering") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualOrderingQuestion),
            createOrderingQuestion(),
          ],
        };
      }

      if (subsection.questionType === "sentence-reorder") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualSentenceReorderQuestion),
            createSentenceReorderQuestion(),
          ],
        };
      }

      if (subsection.questionType === "inline-word-choice") {
        return {
          ...subsection,
          questions: [
            ...subsection.questions.filter(isManualInlineWordChoiceQuestion),
            createInlineWordChoiceQuestion(),
          ],
        };
      }

      return {
        ...subsection,
        questions: [...subsection.questions.filter(isManualMCQQuestion), createMCQQuestion()],
      };
    });
  };

  const removeQuestion = (sectionId: string, subsectionId: string, questionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => ({
      ...subsection,
      questions:
        subsection.questions.length > 1
          ? subsection.questions.filter((question) => question.id !== questionId)
          : subsection.questions,
    }));
  };

  const addOption = (sectionId: string, subsectionId: string, questionId: string) => {
    updateMCQQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: [...question.options, createOption(question.options.length)],
      selectionLimit: Math.max(1, Math.min(question.selectionLimit ?? (question.correctAnswers?.length || 1), question.options.length + 1)),
    }));
  };

  const removeOption = (sectionId: string, subsectionId: string, questionId: string, optionId: string) => {
    updateMCQQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.options.length <= 2) {
        return question;
      }

      const nextOptions = relabelOptions(question.options.filter((option) => option.id !== optionId));
      const nextCorrectAnswers = (question.correctAnswers && question.correctAnswers.length > 0
        ? question.correctAnswers
        : [question.correctAnswer]
      ).filter((answer) => nextOptions.some((option) => option.label === answer));
      const normalizedCorrectAnswers = nextCorrectAnswers.length > 0
        ? nextCorrectAnswers
        : [nextOptions[0]?.label || "A"];

      return {
        ...question,
        options: nextOptions,
        correctAnswer: normalizedCorrectAnswers[0],
        correctAnswers: normalizedCorrectAnswers,
        selectionLimit: Math.max(
          1,
          Math.min(question.selectionLimit ?? normalizedCorrectAnswers.length, nextOptions.length),
        ),
      };
    });
  };

  const updateOption = (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    optionId: string,
    updater: (option: ManualMCQOption) => ManualMCQOption,
  ) => {
    updateMCQQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: question.options.map((option) => (
        option.id === optionId ? updater(option) : option
      )),
    }));
  };

  const addWordBankItem = (sectionId: string, subsectionId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (!isWordBankSubsectionType(subsection.questionType)) {
        return subsection;
      }

      const nextWordBank = relabelWordBank([
        ...(subsection.wordBank ?? []),
        createWordBankItem((subsection.wordBank ?? []).length),
      ]);

      return {
        ...subsection,
        wordBank: nextWordBank,
        questions: subsection.questions.map((question) => {
          if (!isAnyFillBlankQuestion(question) || question.correctAnswerWordBankId) {
            return question;
          }

          return {
            ...question,
            correctAnswerWordBankId: nextWordBank[0]?.id || "",
          };
        }),
      };
    });
  };

  const removeWordBankItem = (sectionId: string, subsectionId: string, wordBankId: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (!isWordBankSubsectionType(subsection.questionType)) {
        return subsection;
      }

      const currentWordBank = subsection.wordBank ?? [];
      if (currentWordBank.length <= 1) {
        return subsection;
      }

      const nextWordBank = relabelWordBank(currentWordBank.filter((item) => item.id !== wordBankId));
      const fallbackWordBankId = nextWordBank[0]?.id || "";

      return {
        ...subsection,
        wordBank: nextWordBank,
        questions: subsection.questions.map((question) => {
          if (!isAnyFillBlankQuestion(question)) {
            return question;
          }

          return {
            ...question,
            correctAnswerWordBankId:
              question.correctAnswerWordBankId === wordBankId
                ? fallbackWordBankId
                : question.correctAnswerWordBankId,
          };
        }),
      };
    });
  };

  const updateWordBankItem = (
    sectionId: string,
    subsectionId: string,
    wordBankId: string,
    updater: (item: ManualWordBankItem) => ManualWordBankItem,
  ) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      if (!isWordBankSubsectionType(subsection.questionType)) {
        return subsection;
      }

      return {
        ...subsection,
        wordBank: (subsection.wordBank ?? []).map((item) => (item.id === wordBankId ? updater(item) : item)),
      };
    });
  };

  /**
   * For passage-fill-blank: auto-sync the questions array to match the number of ___ in the passage.
   */
  const syncPassageBlanksToQuestions = (sectionId: string, subsectionId: string, newPassageText: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      const blankCount = countPassageBlanks(newPassageText);
      const existingQuestions = subsection.questions.filter(isManualPassageFillBlankQuestion);
      const fallbackWordBankId = subsection.wordBank?.[0]?.id || "";
      const sharedTags = existingQuestions[0]?.tags ?? subsection.sharedQuestionTags;

      let nextQuestions: ManualPassageFillBlankQuestion[];
      if (existingQuestions.length < blankCount) {
        // Add more questions
        nextQuestions = [
          ...existingQuestions,
          ...Array.from({ length: blankCount - existingQuestions.length }, () =>
            ({
              ...createPassageFillBlankQuestion(fallbackWordBankId),
              tags: sharedTags,
            }),
          ),
        ];
      } else {
        // Trim excess questions
        nextQuestions = existingQuestions.slice(0, blankCount);
      }

      return {
        ...subsection,
        passageText: newPassageText,
        sharedQuestionTags: sharedTags,
        questions: nextQuestions,
      };
    });
  };

  /**
   * For passage-mcq: auto-sync the questions array to match the number of ___ in the passage.
   * Each blank gets its own set of MCQ options (A/B/C/D).
   */
  const syncPassageMCQBlanksToQuestions = (sectionId: string, subsectionId: string, newPassageText: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      const blankCount = countPassageBlanks(newPassageText);
      const existingQuestions = subsection.questions.filter(isManualPassageMCQQuestion);
      const sharedTags = existingQuestions[0]?.tags ?? subsection.sharedQuestionTags;

      let nextQuestions: ManualPassageMCQQuestion[];
      if (existingQuestions.length < blankCount) {
        nextQuestions = [
          ...existingQuestions,
          ...Array.from({ length: blankCount - existingQuestions.length }, (_, i) =>
            ({
              ...createPassageMCQQuestion(existingQuestions.length + i + 1),
              tags: sharedTags,
            }),
          ),
        ];
      } else {
        nextQuestions = existingQuestions.slice(0, blankCount);
      }

      return {
        ...subsection,
        passageText: newPassageText,
        sharedQuestionTags: sharedTags,
        questions: nextQuestions,
      };
    });
  };

  const syncPassageInlineWordChoiceBlanksToQuestions = (sectionId: string, subsectionId: string, newPassageText: string) => {
    updateSubsection(sectionId, subsectionId, (subsection) => {
      const blankCount = countPassageBlanks(newPassageText);
      const existingQuestion = subsection.questions.find(isManualPassageInlineWordChoiceQuestion);
      const baseQuestion = existingQuestion
        ? existingQuestion
        : {
            ...createPassageInlineWordChoiceQuestion(),
            tags: subsection.sharedQuestionTags,
          };
      const existingItems = baseQuestion.items ?? [];

      let nextItems = existingItems;
      if (existingItems.length < blankCount) {
        nextItems = [
          ...existingItems,
          ...Array.from({ length: blankCount - existingItems.length }, (_, i) =>
            createPassageInlineWordChoiceItem(existingItems.length + i),
          ),
        ];
      } else {
        nextItems = existingItems.slice(0, blankCount);
      }

      nextItems = nextItems.map((item, index) => ({
        ...item,
        label: getNumberLabel(index),
      }));

      return {
        ...subsection,
        passageText: newPassageText,
        sharedQuestionTags: baseQuestion.tags,
        questions: blankCount > 0
          ? [{
              ...baseQuestion,
              items: nextItems,
            }]
          : [{
              ...baseQuestion,
              items: [],
            }],
      };
    });
  };

  const addPassageMCQOption = (sectionId: string, subsectionId: string, questionId: string) => {
    updatePassageMCQQuestion(sectionId, subsectionId, questionId, (question) => ({
      ...question,
      options: [...question.options, createPassageMCQOption(question.options.length)],
    }));
  };

  const removePassageMCQOption = (sectionId: string, subsectionId: string, questionId: string, optionId: string) => {
    updatePassageMCQQuestion(sectionId, subsectionId, questionId, (question) => {
      if (question.options.length <= 2) return question;
      const nextOptions = question.options.filter((o) => o.id !== optionId).map((o, i) => ({ ...o, label: getOptionLabel(i) }));
      const hasCorrect = nextOptions.some((o) => o.label === question.correctAnswer);
      return {
        ...question,
        options: nextOptions,
        correctAnswer: hasCorrect ? question.correctAnswer : nextOptions[0]?.label || "A",
      };
    });
  };

  const handleOptionImageUpload = async (
    sectionId: string,
    subsectionId: string,
    questionId: string,
    optionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const normalizedImage = await createSquareImageDataUrl(file, 320);
      let previewUrl = normalizedImage.previewUrl;

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `option-${file.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: normalizedImage.mimeType,
          fileBase64: normalizedImage.dataUrl.split(",")[1] ?? "",
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to the in-browser preview URL when upload is unavailable.
      }

      updateOption(sectionId, subsectionId, questionId, optionId, (option) => ({
        ...option,
        image: {
          dataUrl: normalizedImage.dataUrl,
          previewUrl,
          fileName: file.name,
          mimeType: normalizedImage.mimeType,
          size: normalizedImage.size,
        },
      }));
      toast.success("Square option image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const handleSubsectionImageUpload = async (
    sectionId: string,
    subsectionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const compressedFile = await compressImage(file, "scene");
      const fileBase64 = await fileToBase64(compressedFile);
      const dataUrl = `data:${compressedFile.type};base64,${fileBase64}`;
      let previewUrl = URL.createObjectURL(compressedFile);

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `scene-${compressedFile.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: compressedFile.type,
          fileBase64,
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to the in-browser preview URL when upload is unavailable.
      }

      updateSubsection(sectionId, subsectionId, (subsection) => ({
        ...subsection,
        sceneImage: {
          dataUrl,
          previewUrl,
          fileName: compressedFile.name,
          mimeType: compressedFile.type,
          size: compressedFile.size,
        },
      }));

      toast.success("Question block image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const handleSubsectionAudioUpload = async (
    sectionId: string,
    subsectionId: string,
    file: File | undefined,
  ) => {
    if (!file) return;

    const validationError = validateAudioFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const fileBase64 = await fileToBase64(file);
      const dataUrl = `data:${file.type};base64,${fileBase64}`;
      let previewUrl = URL.createObjectURL(file);

      try {
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `audio-${file.name.replace(/\s+/g, "-").toLowerCase()}`,
          contentType: file.type,
          fileBase64,
        });
        previewUrl = uploaded.url;
      } catch {
        // Fall back to the in-browser preview URL when upload is unavailable.
      }

      updateSubsection(sectionId, subsectionId, (subsection) => ({
        ...subsection,
        audio: {
          dataUrl,
          previewUrl,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        },
      }));

      toast.success("Audio file uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process audio file");
    }
  };

  const isPersisting = saveManualPaperMutation.isPending || updateManualPaperMutation.isPending;
  const hasGeneratedSections = generationConfig.sections.some((section) => Math.max(0, section.totalQuestions || 0) > 0);
  const saveDisabled = !effectiveTitle.trim()
    || (buildMode === "generated" ? !hasGeneratedSections : !hasAnyQuestions)
    || isPersisting
    || (isEditing && !editingPaperMeta);

  const persistPaper = async (published: boolean) => {
    const validationError = validateManualPaperBuilder(effectiveTitle, sections, buildMode, visibilityMode, generationConfig);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const preparedBlueprint = prepareBlueprintForSave(blueprint);
    const trimmedTitle = effectiveTitle.trim();
    const trimmedDescription = effectiveDescription.trim() || undefined;
    const successFeedback = isQuestionBankMode
      ? (published ? "Question bank updated." : "Question bank draft saved.")
      : (published ? "Paper published successfully." : "Draft saved successfully.");
    const successToast = isQuestionBankMode
      ? (published ? "Question bank published successfully." : "Question bank draft saved successfully.")
      : (published ? "Paper published successfully." : "Draft saved successfully.");

    try {
      if (isEditing) {
        if (!editingPaperMeta) {
          throw new Error("The paper is still loading. Please wait a moment and try again.");
        }

        await updateManualPaperMutation.mutateAsync({
          id: editingPaperMeta.id,
          title: trimmedTitle,
          description: trimmedDescription,
          subject: paperSubject,
          published,
          blueprintJson: JSON.stringify(preparedBlueprint),
        });
        await Promise.all([
          utils.papers.listManualPapers.invalidate(),
          utils.papers.listAllManualPapers.invalidate(),
          utils.papers.getManualPaperDetail.invalidate({ paperId: editingPaperMeta.paperId }),
        ]);
        autosavePausedRef.current = true;
        clearPaperBuilderDraft(draftStorageKey);
        setCurrentPublished(published);
        setSaveFeedback(successFeedback);
        toast.success(successToast);
        setTimeout(() => navigate(managerHref), 1200);
        return;
      }

      const paperId = `manual-${paperSeed}`;
      await saveManualPaperMutation.mutateAsync({
        paperId,
        title: trimmedTitle,
        description: trimmedDescription,
        subject: paperSubject,
        published,
        blueprintJson: JSON.stringify(preparedBlueprint),
      });
      await Promise.all([
        utils.papers.listManualPapers.invalidate(),
        utils.papers.listAllManualPapers.invalidate(),
      ]);
      autosavePausedRef.current = true;
      clearPaperBuilderDraft(draftStorageKey);
      setCurrentPublished(published);
      setSaveFeedback(successFeedback);
      toast.success(successToast);
      setTimeout(() => navigate(managerHref), 1200);
    } catch (err: any) {
      toast.error(err?.message || (isQuestionBankMode ? "Failed to save the question bank. Please try again." : "Failed to save paper. Please try again."));
    }
  };

  const handleSaveDraft = async () => {
    await persistPaper(false);
  };

  const handlePublishPaper = async () => {
    await persistPaper(true);
  };

  const handleSaveAsCopy = async () => {
    const validationError = validateManualPaperBuilder(effectiveTitle, sections, buildMode, visibilityMode, generationConfig);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const copyTitle = createCopyTitle(effectiveTitle);
    const copySeed = createLocalId();
    const copyCreatedAt = new Date().toISOString();
    const copyBlueprint = prepareBlueprintForSave(
      buildBlueprint(copySeed, copyCreatedAt, copyTitle, effectiveDescription, sections, buildMode, visibilityMode, generationConfig),
    );

    try {
      await saveManualPaperMutation.mutateAsync({
        paperId: `manual-${copySeed}`,
        title: copyTitle,
        description: effectiveDescription.trim() || undefined,
        subject: paperSubject,
        published: false,
        blueprintJson: JSON.stringify(copyBlueprint),
      });
      await Promise.all([
        utils.papers.listManualPapers.invalidate(),
        utils.papers.listAllManualPapers.invalidate(),
      ]);
      toast.success("Draft copy created.");
      setTimeout(() => navigate(managerHref), 1200);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create a copy. Please try again.");
    }
  };

  if (isEditing && editPaperQuery.isLoading && !hasHydratedEditState) {
    return (
      <TeacherToolsLayout activeTool="paper-intake" currentSubject={paperSubject}>
        <div className="min-h-screen bg-[#F6F8FB]">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading saved paper…
              </CardContent>
            </Card>
          </div>
        </div>
      </TeacherToolsLayout>
    );
  }

  return (
    <TeacherToolsLayout activeTool="paper-intake" currentSubject={paperSubject}>
      <div className="min-h-screen bg-[#F6F8FB]">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={isEditing ? managerHref : "/"}
              className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEditing ? "Back to Paper Manager" : "Back to Assessments"}
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3A5F]">
              {isEditing ? `Edit ${PAPER_SUBJECT_LABELS[paperSubject]} Paper` : `${PAPER_SUBJECT_LABELS[paperSubject]} Paper Builder`}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 md:max-w-none md:whitespace-nowrap">
              {isEditing
                ? "Update a saved paper. The builder is prefilled with the current content so you can fix mistakes and save changes."
                : isMathPaper
                  ? "Build a math paper by part, question block, and multiple-choice items. The right side shows a student-facing preview while you work."
                  : "Build a paper manually by section, big question, and question type. The right side shows a student-facing preview while you work."}
            </p>
            {isEditing && editingPaperMeta ? (
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Editing paper ID: {editingPaperMeta.paperId}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Subject</CardTitle>
                <CardDescription>
                  {isEditing
                    ? "The subject is locked while you edit an existing paper."
                    : "Choose the subject first. The builder will switch to the matching structure."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <select
                  value={paperSubject}
                  disabled={isEditing}
                  onChange={(event) => handleSubjectSelection(event.target.value as PaperSubject)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {PAPER_SUBJECT_ORDER.map((subject) => (
                    <option key={subject} value={subject}>
                      {PAPER_SUBJECT_LABELS[subject]}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Paper Mode</CardTitle>
                <CardDescription>Choose the mode first, then the editor will show the matching input flow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <div className={`grid gap-3 ${buildMode === "generated" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                    <label className={`rounded-2xl border p-4 text-sm ${buildMode === "fixed" && visibilityMode === "student" ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"}`}>
                      <input
                        type="radio"
                        className="mr-2"
                        checked={buildMode === "fixed" && visibilityMode === "student"}
                        onChange={activateFixedMode}
                      />
                      <span className="font-medium text-slate-900">固定套卷</span>
                      <span className="mt-1 block text-xs text-slate-500">像以前一样按 section 或 part 组织整套卷子，学生直接做这一整张卷。</span>
                    </label>
                    <label className={`rounded-2xl border p-4 text-sm ${isQuestionBankMode ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"}`}>
                      <input
                        type="radio"
                        className="mr-2"
                        checked={isQuestionBankMode}
                        onChange={activateQuestionBankMode}
                      />
                      <span className="font-medium text-slate-900">题库随机</span>
                      <span className="mt-1 block text-xs text-slate-500">按一道一道题录入题库，不显示外层 section，后面可作为随机抽题来源。</span>
                    </label>
                    {buildMode === "generated" ? (
                      <label className="rounded-2xl border border-sky-300 bg-sky-50 p-4 text-sm">
                        <input
                          type="radio"
                          className="mr-2"
                          checked
                          onChange={() => {
                            setBuildMode("generated");
                            setVisibilityMode("student");
                          }}
                        />
                        <span className="font-medium text-slate-900">随机组卷模板</span>
                        <span className="mt-1 block text-xs text-slate-500">按考试体系和标签规则组合 Part，再从题库里随机抽题生成一张新卷。</span>
                      </label>
                    ) : null}
                  </div>
                </div>

                {isLegacyGeneratedMode ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    当前这张卷子是旧版随机组卷模板，下面仍会显示规则编辑器。新建题库请直接使用上面的“题库随机”模式。
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {!isQuestionBankMode ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Paper Info</CardTitle>
                  <CardDescription>Start by naming the paper and writing a short description.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paper-title">Paper Name</Label>
                    <Input
                      id="paper-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={
                        isMathPaper
                          ? "e.g. Grade 5 Math Practice"
                          : paperSubject === "vocabulary"
                            ? "e.g. Unit 4 Vocabulary Review"
                            : "e.g. PET English Assessment"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paper-description">Description</Label>
                    <Textarea
                      id="paper-description"
                      rows={4}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Describe what this paper is for."
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {isEnglishPaper && buildMode === "generated" ? (
              <GeneratedPaperConfigEditor
                value={generationConfig}
                sourcePapers={publishedEnglishSourcePapers}
                previewWarnings={generatedPreview?.warnings ?? []}
                onChange={setGenerationConfig}
              />
            ) : null}

            {buildMode === "fixed" && sections.map((section, sectionIndex) => (
              <Card key={section.id} className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{isQuestionBankMode ? `Question ${sectionIndex + 1}` : `Part ${sectionIndex + 1}`}</CardTitle>
                        {isQuestionBankMode ? (
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                            {getQuestionBankDisplayId(section)}
                          </span>
                        ) : null}
                      </div>
                      <CardDescription>
                        {isQuestionBankMode
                          ? "Record one tagged question at a time for the random question bank."
                          : isMathPaper
                          ? "Choose the part type, then add one or more question blocks below."
                          : "Choose the section type, then add one or more big questions below."}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSection(section.id)}
                      className="text-slate-500 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {!isQuestionBankMode ? (
                    <div className="space-y-2">
                      <Label>{`Part ${sectionIndex + 1} Type`}</Label>
                      <select
                        value={section.sectionType}
                        onChange={(event) =>
                          updateSection(section.id, (currentSection) => {
                            const nextSectionType = event.target.value as ManualSectionType;
                            if (!isMathPaper) {
                              return {
                                ...currentSection,
                                sectionType: nextSectionType,
                              };
                            }

                            const nextQuestionType = getLockedMathQuestionType(nextSectionType);
                            return {
                              ...currentSection,
                              sectionType: nextSectionType,
                              subsections: currentSection.subsections.map((subsection) => {
                                const nextSubsection = createSubsection(nextQuestionType);
                                return {
                                  ...subsection,
                                  questionType: nextQuestionType,
                                  wordBank: nextSubsection.wordBank,
                                  questions: nextSubsection.questions,
                                  passageText: nextSubsection.passageText,
                                  matchingDescriptions: nextSubsection.matchingDescriptions,
                                };
                              }),
                            };
                          })
                        }
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      >
                        {availableSectionTypes.map((value) => (
                          <option key={value} value={value}>
                            {MANUAL_SECTION_TYPE_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    {section.subsections.map((subsection, subsectionIndex) => (
                      <div
                        key={subsection.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                        {...getSubsectionTrackingProps(subsection.id)}
                      >
                        {(() => {
                          const isImageBlockExpanded = expandedImageBlocks[subsection.id] ?? Boolean(subsection.sceneImage);
                          return (
                            <>
                        {!isQuestionBankMode ? (
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{`Question ${subsectionIndex + 1}`}</p>
                              <p className="text-xs text-slate-500">
                                Add the instructions and the questions in this block.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSubsection(section.id, subsection.id)}
                              className="text-slate-500 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Question Type</Label>
                            {isMathPaper ? (
                              (() => {
                                const lockedQuestionType = getLockedMathQuestionType(section.sectionType);
                                const lockedLabel = MANUAL_QUESTION_TYPE_LABELS[lockedQuestionType];
                                const helperText = section.sectionType === "math-short-answer"
                                  ? "Students read the question and type the answer in a small box at the bottom-right."
                                  : section.sectionType === "math-application"
                                    ? "Students solve the problem and type the answer in a small box at the bottom-right."
                                    : "Students choose the correct answer from the listed options.";

                                return (
                                  <>
                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                                      {lockedLabel}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                      {helperText}
                                    </p>
                                  </>
                                );
                              })()
                            ) : (
                              <>
                                <select
                                  value={getDisplayedQuestionType(subsection.questionType)}
                                  onChange={(event) =>
                                    changeSubsectionQuestionType(
                                      section.id,
                                      subsection.id,
                                      event.target.value as ManualQuestionType,
                                    )
                                  }
                                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                >
                                  {questionTypeGroups.map((group) => (
                                    <optgroup key={group.label} label={group.label}>
                                      {group.values.map((value) => {
                                        const option = manualQuestionTypeOptionMap.get(value);
                                        if (!option) return null;

                                        return (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        );
                                      })}
                                    </optgroup>
                                  ))}
                                </select>
                                <p className="text-xs text-slate-500">
                                  {manualQuestionTypeOptionMap.get(getDisplayedQuestionType(subsection.questionType))?.description}
                                </p>
                              </>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Instructions</Label>
                            <Textarea
                              rows={3}
                              value={subsection.instructions}
                              onChange={(event) =>
                                updateSubsection(section.id, subsection.id, (currentSubsection) => ({
                                  ...currentSubsection,
                                  instructions: event.target.value,
                                }))
                              }
                              placeholder="Write the instructions for this big question."
                            />
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <button
                              type="button"
                              onClick={() => toggleImageBlock(subsection.id, isImageBlockExpanded)}
                              className="flex w-full items-center justify-between gap-3 text-left"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-800">Question Block Image</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {subsection.sceneImage
                                    ? `${subsection.sceneImage.fileName} · ${formatFileSize(subsection.sceneImage.size)}`
                                    : "Optional. This image will appear above all questions in this big question block."}
                                </p>
                              </div>
                              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                                {isImageBlockExpanded ? "Collapse" : "Expand"}
                                <ChevronDown className={`h-4 w-4 transition-transform ${isImageBlockExpanded ? "rotate-180" : ""}`} />
                              </span>
                            </button>

                            {isImageBlockExpanded && (
                              <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                                <div className="space-y-2">
                                  <Label>Question Block Image</Label>
                                  <p className="text-xs text-slate-500">
                                    Optional. This image will appear above all questions in this big question block.
                                  </p>
                                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#1E3A5F]/30 bg-white px-3 py-2 text-sm font-medium text-[#1E3A5F] transition-colors hover:border-[#D4A84B] hover:text-[#A97C21]">
                                    <ImagePlus className="h-4 w-4" />
                                    {subsection.sceneImage ? "Replace Image" : "Add Image"}
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp,image/gif"
                                      className="hidden"
                                      onChange={(event) =>
                                        handleSubsectionImageUpload(
                                          section.id,
                                          subsection.id,
                                          event.target.files?.[0],
                                        )
                                      }
                                    />
                                  </label>
                                  {subsection.sceneImage && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-auto px-0 text-sm text-slate-500 hover:text-red-500"
                                      onClick={() =>
                                        updateSubsection(section.id, subsection.id, (currentSubsection) => ({
                                          ...currentSubsection,
                                          sceneImage: undefined,
                                        }))
                                      }
                                    >
                                      Remove Image
                                    </Button>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label>Preview</Label>
                                  <div className="flex min-h-[108px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2">
                                    {subsection.sceneImage ? (
                                      <img
                                        src={subsection.sceneImage.previewUrl || subsection.sceneImage.dataUrl}
                                        alt="Question block preview"
                                        className="max-h-24 w-full object-contain"
                                      />
                                    ) : (
                                      <span className="px-3 text-center text-[11px] leading-tight text-slate-400">
                                        No image uploaded
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Audio upload — shown only when section type is listening */}
                          {section.sectionType === "listening" && (
                            <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Volume2 className="h-4 w-4 text-sky-700" />
                                    <Label className="text-sm font-semibold text-sky-800">Listening Audio</Label>
                                  </div>
                                  <p className="text-xs text-sky-700/80">
                                    Upload an audio clip for this big question. Students will listen to it before answering.
                                  </p>
                                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-sky-400/50 bg-white px-3 py-2 text-sm font-medium text-sky-700 transition-colors hover:border-sky-500 hover:text-sky-800">
                                    <Music className="h-4 w-4" />
                                    {subsection.audio ? "Replace Audio" : "Upload Audio"}
                                    <input
                                      type="file"
                                      accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4,audio/m4a,audio/x-m4a,audio/aac"
                                      className="hidden"
                                      onChange={(event) =>
                                        handleSubsectionAudioUpload(
                                          section.id,
                                          subsection.id,
                                          event.target.files?.[0],
                                        )
                                      }
                                    />
                                  </label>
                                  {subsection.audio && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-auto px-0 text-sm text-slate-500 hover:text-red-500"
                                      onClick={() =>
                                        updateSubsection(section.id, subsection.id, (currentSubsection) => ({
                                          ...currentSubsection,
                                          audio: undefined,
                                        }))
                                      }
                                    >
                                      Remove Audio
                                    </Button>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label>Preview</Label>
                                  {subsection.audio ? (
                                    <div className="space-y-2">
                                      <audio
                                        controls
                                        className="w-full"
                                        src={subsection.audio.previewUrl || subsection.audio.dataUrl}
                                      />
                                      <p className="text-xs text-slate-500">
                                        {subsection.audio.fileName} · {formatFileSize(subsection.audio.size)}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="flex min-h-[60px] items-center justify-center rounded-xl border border-dashed border-sky-300 bg-white p-3">
                                      <span className="text-xs text-slate-400">No audio uploaded</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Word Bank editor — shared by fill-blank and passage-fill-blank */}
                          {isWordBankSubsectionType(subsection.questionType) && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                              <div className="mb-4">
                                <div>
                                  <p className="text-sm font-semibold text-amber-800">Word Bank</p>
                                  <p className="text-xs text-amber-700/80">
                                    Letters are assigned automatically and shown in preview just like the live paper.
                                  </p>
                                </div>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                {(subsection.wordBank ?? []).map((item) => (
                                  <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-amber-100 px-2 text-sm font-semibold text-amber-800">
                                        {item.letter}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeWordBankItem(section.id, subsection.id, item.id)}
                                        className="text-slate-500 hover:text-red-500"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>{`Word ${item.letter}`}</Label>
                                      <Input
                                        value={item.word}
                                        onChange={(event) =>
                                          updateWordBankItem(section.id, subsection.id, item.id, (currentItem) => ({
                                            ...currentItem,
                                            word: event.target.value,
                                          }))
                                        }
                                        placeholder="Type the word or phrase in the bank"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 flex justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => addWordBankItem(section.id, subsection.id)}
                                  className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Word
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Matching descriptions editor — for matching-style sections */}
                          {(subsection.questionType === "passage-matching" || subsection.questionType === "heading-match") && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-amber-800">Matching Bank</p>
                                <p className="text-xs text-amber-700/80">
                                  Add labeled options students will match to each prompt below. You can use them as people/needs options or as heading choices for paragraph matching.
                                </p>
                              </div>

                              <div className="space-y-3">
                                {(subsection.matchingDescriptions ?? []).map((desc) => (
                                  <div key={desc.id} className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                                    <div className="flex items-start gap-3">
                                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
                                        {desc.label}
                                      </span>
                                      <div className="flex-1 space-y-2">
                                        <Input
                                          value={desc.name}
                                          onChange={(event) =>
                                            updateMatchingDescription(section.id, subsection.id, desc.id, (d) => ({
                                              ...d,
                                              name: event.target.value,
                                            }))
                                          }
                                          placeholder='Option title (e.g. "Marina" or "The Benefits of Exercise")'
                                          className="h-8 text-sm font-medium"
                                        />
                                        <Textarea
                                          rows={2}
                                          value={desc.text}
                                          onChange={(event) =>
                                            updateMatchingDescription(section.id, subsection.id, desc.id, (d) => ({
                                              ...d,
                                              text: event.target.value,
                                            }))
                                          }
                                          placeholder="Optional note / explanation for this option..."
                                          className="text-sm"
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeMatchingDescription(section.id, subsection.id, desc.id)}
                                        className="mt-1 h-7 w-7 shrink-0 text-slate-400 hover:text-red-500"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addMatchingDescription(section.id, subsection.id)}
                                className="mt-3 text-xs"
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Add Option
                              </Button>
                            </div>
                          )}

                          {/* Passage text editor — for passage-open-ended */}
                          {subsection.questionType === "passage-open-ended" && section.sectionType !== "math-application" && (
                            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-teal-800">Passage Text</p>
                                <p className="text-xs text-teal-700/80">
                                  Type or paste the full passage/article that students will read before answering the questions below.
                                </p>
                              </div>
                              <Textarea
                                rows={14}
                                value={subsection.passageText ?? ""}
                                onChange={(event) =>
                                  updateSubsection(section.id, subsection.id, (sub) => ({
                                    ...sub,
                                    passageText: event.target.value,
                                  }))
                                }
                                placeholder={`Example:\n\nOnce upon a time, there was a little girl who loved to read. Every day after school, she would go to the library and spend hours reading books about faraway lands and magical creatures...`}
                                className="min-h-[420px] font-mono text-sm"
                              />
                            </div>
                          )}

                          {subsection.questionType === "passage-inline-word-choice" && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-emerald-800">Passage Text</p>
                                <p className="text-xs text-emerald-700/80">
                                  Type or paste the full passage. Use <code className="rounded bg-emerald-100 px-1 py-0.5 text-emerald-900">___</code> to mark each click-choice blank. Students will click the correct word directly inside the passage.
                                </p>
                              </div>
                              <Textarea
                                rows={14}
                                value={subsection.passageText ?? ""}
                                onChange={(event) =>
                                  syncPassageInlineWordChoiceBlanksToQuestions(section.id, subsection.id, event.target.value)
                                }
                                placeholder={`Example:\n\n___ is my favourite activity because I love being in the water.\nYou’ll find the potatoes in the ___ in the kitchen.`}
                                className="min-h-[420px] font-mono text-sm"
                              />
                              <p className="mt-2 text-xs text-emerald-700">
                                {countPassageBlanks(subsection.passageText ?? "")} blank(s) detected
                              </p>
                              {isQuestionBankMode && (
                                <div className="mt-4">
                                  {renderSharedPassageTagEditor(section.id, subsection.id, subsection, section.sectionType)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Passage text editor — for passage-fill-blank and passage-mcq */}
                          {subsection.questionType === "passage-mcq" && (
                            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-violet-800">Passage Text</p>
                                <p className="text-xs text-violet-700/80">
                                  Type or paste the full passage. Use <code className="rounded bg-violet-100 px-1 py-0.5 text-violet-900">___</code> (three underscores) to mark each blank. Each blank will have its own MCQ options.
                                </p>
                              </div>
                              <Textarea
                                rows={14}
                                value={subsection.passageText ?? ""}
                                onChange={(event) =>
                                  syncPassageMCQBlanksToQuestions(section.id, subsection.id, event.target.value)
                                }
                                placeholder={`Example:\n\nLast summer, I ___ to the beach with my family. We ___ a wonderful time. The weather was ___ and sunny.`}
                                className="min-h-[420px] font-mono text-sm"
                              />
                              <p className="mt-2 text-xs text-violet-700">
                                {countPassageBlanks(subsection.passageText ?? "")} blank(s) detected
                              </p>
                              {isQuestionBankMode && (
                                <div className="mt-4">
                                  {renderSharedPassageTagEditor(section.id, subsection.id, subsection, section.sectionType)}
                                </div>
                              )}
                            </div>
                          )}

                          {subsection.questionType === "passage-fill-blank" && (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-blue-800">Passage Text</p>
                                <p className="text-xs text-blue-700/80">
                                  Type or paste the full passage. Use <code className="rounded bg-blue-100 px-1 py-0.5 text-blue-900">___</code> (three underscores) to mark each blank. Blanks are numbered automatically.
                                </p>
                              </div>
                              <Textarea
                                rows={14}
                                value={subsection.passageText ?? ""}
                                onChange={(event) =>
                                  syncPassageBlanksToQuestions(section.id, subsection.id, event.target.value)
                                }
                                placeholder={`Example:\n\nThe boy ___ to school every day. He ___ his lunch in a bag. His mother always ___ him goodbye at the door.`}
                                className="min-h-[420px] font-mono text-sm"
                              />
                              <p className="mt-2 text-xs text-blue-700">
                                {countPassageBlanks(subsection.passageText ?? "")} blank(s) detected
                              </p>
                              {isQuestionBankMode && (
                                <div className="mt-4">
                                  {renderSharedPassageTagEditor(section.id, subsection.id, subsection, section.sectionType)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Questions editor */}
                          <div className="space-y-4">
                            {/* MCQ questions */}
                            {subsection.questionType === "mcq" &&
                              subsection.questions.filter(isManualMCQQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{`Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Question type: Multiple Choice</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Question Prompt</Label>
                                      <Textarea
                                        rows={3}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateMCQQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                            ...currentQuestion,
                                            prompt: event.target.value,
                                          }))
                                        }
                                        placeholder="Type the stem of the multiple-choice question."
                                      />
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                      {question.options.map((option) => {
                                        const isCorrect = (question.correctAnswers && question.correctAnswers.length > 0
                                          ? question.correctAnswers
                                          : [question.correctAnswer]
                                        ).includes(option.label);

                                        return (
                                        <div key={option.id} className="rounded-xl border border-slate-200 p-4">
                                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-700">{`Option ${option.label}`}</p>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                removeOption(section.id, subsection.id, question.id, option.id)
                                              }
                                              className="text-slate-500 hover:text-red-500"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>

                                          <div className="space-y-3">
                                            <div className="space-y-2">
                                              <Label>{`Option ${option.label} Text`}</Label>
                                              <Input
                                                value={option.text}
                                                onChange={(event) =>
                                                  updateOption(
                                                    section.id,
                                                    subsection.id,
                                                    question.id,
                                                    option.id,
                                                    (currentOption) => ({
                                                      ...currentOption,
                                                      text: event.target.value,
                                                    }),
                                                  )
                                                }
                                                placeholder="Optional text for this option"
                                              />
                                            </div>

                                            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                              <input
                                                type="checkbox"
                                                checked={isCorrect}
                                                onChange={(event) =>
                                                  updateMCQQuestion(section.id, subsection.id, question.id, (currentQuestion) => {
                                                    const nextCorrectAnswers = event.target.checked
                                                      ? Array.from(new Set([
                                                          ...((currentQuestion.correctAnswers && currentQuestion.correctAnswers.length > 0
                                                            ? currentQuestion.correctAnswers
                                                            : [currentQuestion.correctAnswer])),
                                                          option.label,
                                                        ]))
                                                      : ((currentQuestion.correctAnswers && currentQuestion.correctAnswers.length > 0
                                                          ? currentQuestion.correctAnswers
                                                          : [currentQuestion.correctAnswer])
                                                        .filter((answer) => answer !== option.label));
                                                    const normalizedCorrectAnswers = nextCorrectAnswers.length > 0
                                                      ? nextCorrectAnswers
                                                      : [currentQuestion.options[0]?.label || "A"];

                                                    return {
                                                      ...currentQuestion,
                                                      correctAnswer: normalizedCorrectAnswers[0],
                                                      correctAnswers: normalizedCorrectAnswers,
                                                      selectionLimit: Math.max(1, normalizedCorrectAnswers.length),
                                                    };
                                                  })
                                                }
                                                className="h-4 w-4 rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                                              />
                                              Mark as correct
                                            </label>

                                            <div className="flex flex-wrap items-start gap-3">
                                              <div className="space-y-2">
                                                <Label className="text-xs text-slate-500">{`Option ${option.label} Image`}</Label>
                                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                                  {option.image ? (
                                                    <img
                                                      src={option.image.previewUrl || option.image.dataUrl}
                                                      alt={`Option ${option.label}`}
                                                      className="h-full w-full object-contain"
                                                    />
                                                  ) : (
                                                    <span className="px-2 text-center text-[10px] leading-tight text-slate-400">
                                                      No image
                                                    </span>
                                                  )}
                                                </div>
                                              </div>

                                              <div className="min-w-[140px] flex-1 space-y-2">
                                                <Label className="text-xs text-slate-500">Upload</Label>
                                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#1E3A5F]/30 bg-white px-3 py-2 text-sm font-medium text-[#1E3A5F] transition-colors hover:border-[#D4A84B] hover:text-[#A97C21]">
                                                  <ImagePlus className="h-4 w-4" />
                                                  {option.image ? "Replace Image" : "Add Image"}
                                                  <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                                    className="hidden"
                                                    onChange={(event) =>
                                                      handleOptionImageUpload(
                                                        section.id,
                                                        subsection.id,
                                                        question.id,
                                                        option.id,
                                                        event.target.files?.[0],
                                                      )
                                                    }
                                                  />
                                                </label>
                                                {option.image && (
                                                  <p className="break-all text-xs text-slate-500">
                                                    {option.image.fileName} · {formatFileSize(option.image.size)}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )})}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => addOption(section.id, subsection.id, question.id)}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Option
                                      </Button>

                                      <p className="text-sm text-slate-500">
                                        Correct option{(question.correctAnswers?.length || 1) > 1 ? "s" : ""}:{" "}
                                        <span className="font-semibold text-emerald-700">
                                          {(question.correctAnswers && question.correctAnswers.length > 0
                                            ? question.correctAnswers
                                            : [question.correctAnswer]
                                          ).join(", ")}
                                        </span>
                                      </p>
                                    </div>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}

                            {/* Fill-blank questions (sentence mode) */}
                            {subsection.questionType === "fill-blank" &&
                              subsection.questions.filter(isManualFillBlankQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{`Blank ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Question type: Word Bank Fill Blank</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                                    <div className="space-y-2">
                                      <Label>Sentence / Prompt</Label>
                                      <Textarea
                                        rows={3}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateFillBlankQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="Type the sentence and use ___ where the blank should appear."
                                      />
                                      <p className="text-xs text-slate-500">
                                        Example: I usually go to school ___ bus.
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Correct Answer</Label>
                                      <select
                                        value={question.correctAnswerWordBankId}
                                        onChange={(event) =>
                                          updateFillBlankQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              correctAnswerWordBankId: event.target.value,
                                            }),
                                          )
                                        }
                                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                      >
                                        {(subsection.wordBank ?? []).map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.letter}. {item.word || "Untitled word"}
                                          </option>
                                        ))}
                                      </select>
                                      <p className="text-xs text-slate-500">
                                        Pick the word bank item students should drag into this blank.
                                      </p>
                                    </div>
                                  </div>

                                  {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                </div>
                              ))}

                            {/* Typed fill-blank questions (direct input) */}
                            {subsection.questionType === "typed-fill-blank" &&
                              subsection.questions.filter(isManualTypedFillBlankQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{`Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Question type: Fill in Blank</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                                    <div className="space-y-2">
                                      <Label>{section.sectionType === "math-short-answer" || section.sectionType === "math-application" ? "Question Prompt" : "Sentence / Prompt"}</Label>
                                      <Textarea
                                        rows={3}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateTypedFillBlankQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder={
                                          section.sectionType === "math-short-answer" || section.sectionType === "math-application"
                                            ? "Type the math question students should answer."
                                            : "Type the sentence and use ___ where the blank should appear."
                                        }
                                      />
                                      <p className="text-xs text-slate-500">
                                        {section.sectionType === "math-short-answer" || section.sectionType === "math-application"
                                          ? "Students will answer in a small box shown at the lower-right of the question card."
                                          : "Example: The capital of France is ___."}
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Correct Answer</Label>
                                      <Input
                                        value={question.correctAnswer}
                                        onChange={(event) =>
                                          updateTypedFillBlankQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              correctAnswer: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="Type the correct answer"
                                      />
                                      <p className="text-xs text-slate-500">
                                        The answer students should type in the blank.
                                      </p>
                                    </div>
                                  </div>

                                  {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                </div>
                              ))}

                            {subsection.questionType === "picture-spelling" &&
                              subsection.questions.filter(isManualPictureSpellingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{`Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Question type: Picture Spelling</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                                    <div className="space-y-3">
                                      <Label>Picture</Label>
                                      <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                        {question.image ? (
                                          <img
                                            src={question.image.previewUrl || question.image.dataUrl}
                                            alt="Picture spelling prompt"
                                            className="h-full max-h-[160px] w-full object-contain"
                                          />
                                        ) : (
                                          <span className="px-4 text-center text-xs text-slate-400">No image uploaded</span>
                                        )}
                                      </div>
                                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#1E3A5F]/30 bg-white px-3 py-2 text-sm font-medium text-[#1E3A5F] transition-colors hover:border-[#D4A84B] hover:text-[#A97C21]">
                                        <ImagePlus className="h-4 w-4" />
                                        {question.image ? "Replace Image" : "Upload Image"}
                                        <input
                                          type="file"
                                          accept="image/png,image/jpeg,image/webp,image/gif"
                                          className="hidden"
                                          onChange={(event) =>
                                            handlePictureSpellingImageUpload(
                                              section.id,
                                              subsection.id,
                                              question.id,
                                              event.target.files?.[0],
                                            )
                                          }
                                        />
                                      </label>
                                      {question.image && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          className="h-auto px-0 text-sm text-slate-500 hover:text-red-500"
                                          onClick={() =>
                                            updatePictureSpellingQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                              ...currentQuestion,
                                              image: undefined,
                                            }))
                                          }
                                        >
                                          Remove Image
                                        </Button>
                                      )}
                                    </div>

                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>Prompt <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                        <Textarea
                                          rows={2}
                                          value={question.prompt}
                                          onChange={(event) =>
                                            updatePictureSpellingQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }))
                                          }
                                          placeholder="Optional clue or instruction for this word."
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label>Correct Word</Label>
                                        <Input
                                          value={question.correctAnswer}
                                          onChange={(event) =>
                                            updatePictureSpellingQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                              ...currentQuestion,
                                              correctAnswer: event.target.value,
                                            }))
                                          }
                                          placeholder="e.g. butterfly"
                                        />
                                        <p className="text-xs text-slate-500">
                                          Students will spell this word one letter per box.
                                        </p>
                                      </div>
                                    </div>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "word-completion" &&
                              subsection.questions.filter(isManualWordCompletionQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{`Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Question type: Word Completion</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
                                    <div className="space-y-3">
                                      <Label>Picture <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                      <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                        {question.image ? (
                                          <img
                                            src={question.image.previewUrl || question.image.dataUrl}
                                            alt="Word completion prompt"
                                            className="h-full max-h-[160px] w-full object-contain"
                                          />
                                        ) : (
                                          <span className="px-4 text-center text-xs text-slate-400">No image uploaded</span>
                                        )}
                                      </div>
                                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#1E3A5F]/30 bg-white px-3 py-2 text-sm font-medium text-[#1E3A5F] transition-colors hover:border-[#D4A84B] hover:text-[#A97C21]">
                                        <ImagePlus className="h-4 w-4" />
                                        {question.image ? "Replace Image" : "Upload Image"}
                                        <input
                                          type="file"
                                          accept="image/png,image/jpeg,image/webp,image/gif"
                                          className="hidden"
                                          onChange={(event) =>
                                            handleWordCompletionImageUpload(
                                              section.id,
                                              subsection.id,
                                              question.id,
                                              event.target.files?.[0],
                                            )
                                          }
                                        />
                                      </label>
                                      {question.image && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          className="h-auto px-0 text-sm text-slate-500 hover:text-red-500"
                                          onClick={() =>
                                            updateWordCompletionQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                              ...currentQuestion,
                                              image: undefined,
                                            }))
                                          }
                                        >
                                          Remove Image
                                        </Button>
                                      )}
                                    </div>

                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>Prompt <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                        <Textarea
                                          rows={2}
                                          value={question.prompt}
                                          onChange={(event) =>
                                            updateWordCompletionQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }))
                                          }
                                          placeholder="Optional clue or instruction for this word."
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label>Word Pattern</Label>
                                        <Input
                                          value={question.wordPattern}
                                          onChange={(event) =>
                                            updateWordCompletionQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                              ...currentQuestion,
                                              wordPattern: event.target.value,
                                            }))
                                          }
                                          placeholder="e.g. b__k or b _ _ k"
                                        />
                                        <p className="text-xs text-slate-500">
                                          Use _ for each missing letter students need to fill.
                                        </p>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Correct Word</Label>
                                      <Input
                                        value={question.correctAnswer}
                                        onChange={(event) =>
                                          updateWordCompletionQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                            ...currentQuestion,
                                            correctAnswer: event.target.value,
                                          }))
                                        }
                                        placeholder="e.g. book"
                                      />
                                      <p className="text-xs text-slate-500">
                                        Enter the full completed word.
                                      </p>
                                    </div>
                                  </div>

                                  {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                </div>
                              ))}

                            {/* Passage open-ended questions editor */}
                            {subsection.questionType === "passage-open-ended" &&
                              subsection.questions.filter(isManualPassageOpenEndedQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-teal-800">{`Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Open-ended question — students type a free-form answer.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Question</Label>
                                      <Textarea
                                        rows={2}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updatePassageOpenEndedQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="e.g. What is the main idea of the passage?"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Reference Answer <span className="text-xs font-normal text-slate-400">(optional, for grading reference)</span></Label>
                                      <Textarea
                                        rows={3}
                                        value={question.referenceAnswer}
                                        onChange={(event) =>
                                          updatePassageOpenEndedQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              referenceAnswer: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="Type a model/reference answer for grading purposes."
                                      />
                                    </div>
                                  </div>

                                  {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                </div>
                              ))}

                            {/* Passage matching questions editor */}
                            {subsection.questionType === "passage-matching" &&
                              subsection.questions.filter(isManualPassageMatchingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-amber-800">{`Match Prompt ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Add a prompt students will match to the best option above.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Match Prompt</Label>
                                      <Textarea
                                        rows={2}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updatePassageMatchingQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="e.g. Thomas and his sister enjoy eating French food. They want a restaurant that also has live music. / Paragraph A"
                                      />
                                    </div>

                                    <div className="min-w-[180px] space-y-1">
                                      <Label className="text-xs">Correct Option</Label>
                                      <select
                                        value={question.correctAnswer}
                                        onChange={(event) =>
                                          updatePassageMatchingQuestion(section.id, subsection.id, question.id, (q) => ({
                                            ...q,
                                            correctAnswer: event.target.value,
                                          }))
                                        }
                                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                                      >
                                        {(subsection.matchingDescriptions ?? []).map((desc) => (
                                          <option key={desc.id} value={desc.label}>
                                            {desc.label}. {desc.name || "Untitled"}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                </div>
                              ))}

                            {subsection.questionType === "true-false" &&
                              subsection.questions.filter(isManualTrueFalseQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-cyan-800">{`Statement Block ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Students will choose True, False, or Not Given for each statement below.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <label className="flex items-center gap-2 text-sm text-slate-600">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(question.requiresReason)}
                                        onChange={(event) =>
                                          updateTrueFalseQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                            ...currentQuestion,
                                            requiresReason: event.target.checked,
                                          }))
                                        }
                                      />
                                      Require students to explain each answer
                                    </label>

                                    <div className="space-y-3">
                                      {question.statements.map((statement) => (
                                        <div key={statement.id} className="rounded-xl border border-cyan-100 bg-cyan-50/30 p-4">
                                          <div className="mb-3 flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-cyan-800">{`Statement ${statement.label}`}</p>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => removeTrueFalseStatement(section.id, subsection.id, question.id, statement.id)}
                                              className="text-slate-500 hover:text-red-500"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>

                                          <div className="space-y-3">
                                            <Textarea
                                              rows={2}
                                              value={statement.statement}
                                              onChange={(event) =>
                                                updateTrueFalseStatement(section.id, subsection.id, question.id, statement.id, (currentStatement) => ({
                                                  ...currentStatement,
                                                  statement: event.target.value,
                                                }))
                                              }
                                              placeholder="Type the statement students will judge."
                                            />

                                            <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                                              <div className="space-y-2">
                                                <Label>Correct Answer</Label>
                                                <select
                                                  value={statement.correctAnswer}
                                                  onChange={(event) =>
                                                    updateTrueFalseStatement(section.id, subsection.id, question.id, statement.id, (currentStatement) => ({
                                                      ...currentStatement,
                                                      correctAnswer: event.target.value as ManualTruthValue,
                                                    }))
                                                  }
                                                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                                >
                                                  <option value="true">True</option>
                                                  <option value="false">False</option>
                                                  <option value="not-given">Not Given</option>
                                                </select>
                                              </div>

                                              <div className="space-y-2">
                                                <Label>Explanation <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                                <Textarea
                                                  rows={2}
                                                  value={statement.explanation ?? ""}
                                                  onChange={(event) =>
                                                    updateTrueFalseStatement(section.id, subsection.id, question.id, statement.id, (currentStatement) => ({
                                                      ...currentStatement,
                                                      explanation: event.target.value || undefined,
                                                    }))
                                                  }
                                                  placeholder="Reference explanation or marking note."
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => addTrueFalseStatement(section.id, subsection.id, question.id)}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Statement
                                    </Button>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "heading-match" &&
                              subsection.questions.filter(isManualHeadingMatchQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-indigo-800">{`Paragraph Match ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Students will choose the best heading from the heading bank above.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                                    <div className="space-y-2">
                                      <Label>Paragraph / Match Prompt</Label>
                                      <Textarea
                                        rows={2}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateHeadingMatchQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                            ...currentQuestion,
                                            prompt: event.target.value,
                                          }))
                                        }
                                        placeholder="e.g. Paragraph A / Match heading for paragraph 1"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Correct Heading</Label>
                                      <select
                                        value={question.correctAnswer}
                                        onChange={(event) =>
                                          updateHeadingMatchQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                            ...currentQuestion,
                                            correctAnswer: event.target.value,
                                          }))
                                        }
                                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                      >
                                        {(subsection.matchingDescriptions ?? []).map((desc) => (
                                          <option key={desc.id} value={desc.label}>
                                            {desc.label}. {desc.name || desc.text || "Untitled heading"}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                </div>
                              ))}

                            {subsection.questionType === "checkbox" &&
                              subsection.questions.filter(isManualCheckboxQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-emerald-800">{`Checkbox Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Students can select multiple correct options.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                                      <div className="space-y-2">
                                        <Label>Question Prompt</Label>
                                        <Textarea
                                          rows={2}
                                          value={question.prompt}
                                          onChange={(event) =>
                                            updateCheckboxQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }))
                                          }
                                          placeholder="e.g. Choose the two statements that are correct."
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label>Selection Limit</Label>
                                        <Input
                                          type="number"
                                          min={1}
                                          max={question.options.length}
                                          value={question.selectionLimit ?? ""}
                                          onChange={(event) =>
                                            updateCheckboxQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                              ...currentQuestion,
                                              selectionLimit: event.target.value
                                                ? Math.max(1, Math.min(Number(event.target.value), currentQuestion.options.length))
                                                : undefined,
                                            }))
                                          }
                                        />
                                      </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                      {question.options.map((option) => {
                                        const isCorrect = question.correctAnswers.includes(option.label);
                                        return (
                                          <div key={option.id} className="rounded-xl border border-slate-200 p-4">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                              <p className="text-sm font-semibold text-slate-700">{`Option ${option.label}`}</p>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeCheckboxOption(section.id, subsection.id, question.id, option.id)}
                                                className="text-slate-500 hover:text-red-500"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            <div className="space-y-3">
                                              <Input
                                                value={option.text}
                                                onChange={(event) =>
                                                  updateCheckboxOption(section.id, subsection.id, question.id, option.id, (currentOption) => ({
                                                    ...currentOption,
                                                    text: event.target.value,
                                                  }))
                                                }
                                                placeholder={`Type option ${option.label}`}
                                              />
                                              <label className="flex items-center gap-2 text-sm text-slate-600">
                                                <input
                                                  type="checkbox"
                                                  checked={isCorrect}
                                                  onChange={(event) =>
                                                    updateCheckboxQuestion(section.id, subsection.id, question.id, (currentQuestion) => {
                                                      const nextCorrectAnswers = event.target.checked
                                                        ? Array.from(new Set([...currentQuestion.correctAnswers, option.label]))
                                                        : currentQuestion.correctAnswers.filter((answer) => answer !== option.label);
                                                      return {
                                                        ...currentQuestion,
                                                        correctAnswers: nextCorrectAnswers,
                                                        selectionLimit: Math.max(
                                                          currentQuestion.selectionLimit ?? 2,
                                                          nextCorrectAnswers.length,
                                                        ),
                                                      };
                                                    })
                                                  }
                                                />
                                                Mark as correct
                                              </label>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => addCheckboxOption(section.id, subsection.id, question.id)}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Option
                                    </Button>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "ordering" &&
                              subsection.questions.filter(isManualOrderingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-fuchsia-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-fuchsia-800">{`Ordering Question ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Students will arrange these items into the correct sequence.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Question Prompt</Label>
                                      <Textarea
                                        rows={2}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateOrderingQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                            ...currentQuestion,
                                            prompt: event.target.value,
                                          }))
                                        }
                                        placeholder="e.g. Put the events in the correct order."
                                      />
                                    </div>

                                    <div className="space-y-3">
                                      {question.items.map((item) => (
                                        <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                                          <Input
                                            value={item.text}
                                            onChange={(event) =>
                                              updateOrderingItem(section.id, subsection.id, question.id, item.id, (currentItem) => ({
                                                ...currentItem,
                                                text: event.target.value,
                                              }))
                                            }
                                            placeholder="Type the event / step"
                                          />
                                          <select
                                            value={String(item.correctPosition)}
                                            onChange={(event) =>
                                              updateOrderingItem(section.id, subsection.id, question.id, item.id, (currentItem) => ({
                                                ...currentItem,
                                                correctPosition: Number(event.target.value),
                                              }))
                                            }
                                            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                                          >
                                            {question.items.map((_, itemIndex) => (
                                              <option key={itemIndex} value={itemIndex + 1}>
                                                Position {itemIndex + 1}
                                              </option>
                                            ))}
                                          </select>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeOrderingItem(section.id, subsection.id, question.id, item.id)}
                                            className="text-slate-500 hover:text-red-500"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => addOrderingItem(section.id, subsection.id, question.id)}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Item
                                    </Button>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "sentence-reorder" &&
                              subsection.questions.filter(isManualSentenceReorderQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-lime-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-lime-800">{`Sentence Reordering ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Students rewrite each set of scrambled words as a correct sentence.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-3">
                                      {question.items.map((item) => (
                                        <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                          <div className="mb-3 flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-700">{`Sentence ${item.label}`}</p>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => removeSentenceReorderItem(section.id, subsection.id, question.id, item.id)}
                                              className="text-slate-500 hover:text-red-500"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>

                                          <div className="space-y-3">
                                            <div className="space-y-2">
                                              <Label>Scrambled Words</Label>
                                              <Input
                                                value={item.scrambledWords}
                                                onChange={(event) =>
                                                  updateSentenceReorderItem(section.id, subsection.id, question.id, item.id, (currentItem) => ({
                                                    ...currentItem,
                                                    scrambledWords: event.target.value,
                                                  }))
                                                }
                                                placeholder="e.g. He / walks / to school / usually / with me"
                                              />
                                              <p className="text-xs text-slate-500">
                                                Use `/` between words or chunks, just like the worksheet.
                                              </p>
                                            </div>

                                            <div className="space-y-2">
                                              <Label>Correct Sentence</Label>
                                              <Input
                                                value={item.correctAnswer}
                                                onChange={(event) =>
                                                  updateSentenceReorderItem(section.id, subsection.id, question.id, item.id, (currentItem) => ({
                                                    ...currentItem,
                                                    correctAnswer: event.target.value,
                                                  }))
                                                }
                                                placeholder="e.g. He usually walks to school with me."
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => addSentenceReorderItem(section.id, subsection.id, question.id)}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Sentence
                                    </Button>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "inline-word-choice" &&
                              subsection.questions.filter(isManualInlineWordChoiceQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-emerald-800">{`Click Correct Word ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Students click the correct word directly inside each sentence.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-3">
                                      {question.items.map((item) => (
                                        <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                          <div className="mb-3 flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-700">{`Sentence ${item.label}`}</p>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => removeInlineWordChoiceItem(section.id, subsection.id, question.id, item.id)}
                                              className="text-slate-500 hover:text-red-500"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>

                                          <div className="space-y-3">
                                            <div className="space-y-2">
                                              <Label>Sentence Text</Label>
                                              <Input
                                                value={buildInlineWordChoiceSentence(item)}
                                                onChange={(event) =>
                                                  updateInlineWordChoiceItem(section.id, subsection.id, question.id, item.id, (currentItem) => ({
                                                    ...currentItem,
                                                    ...splitInlineWordChoiceSentence(event.target.value),
                                                  }))
                                                }
                                                placeholder="e.g. ___ is my favourite activity because I love being in the water."
                                              />
                                              <p className="text-xs text-slate-500">
                                                Use <code className="rounded bg-slate-100 px-1 py-0.5">___</code> to mark the clickable blank.
                                              </p>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-2">
                                              {item.options.map((option) => (
                                                <div key={option.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                                  <div className="mb-2 flex items-center justify-between gap-2">
                                                    <Label>{`Option ${option.label}`}</Label>
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="icon"
                                                      onClick={() => removeInlineWordChoiceOption(section.id, subsection.id, question.id, item.id, option.id)}
                                                      className="h-8 w-8 text-slate-500 hover:text-red-500"
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                  <Input
                                                    value={option.text}
                                                    onChange={(event) =>
                                                      updateInlineWordChoiceOption(section.id, subsection.id, question.id, item.id, option.id, (currentOption) => ({
                                                        ...currentOption,
                                                        text: event.target.value,
                                                      }))
                                                    }
                                                    placeholder={`Type option ${option.label}`}
                                                  />
                                                </div>
                                              ))}
                                            </div>

                                            <Button
                                              type="button"
                                              variant="outline"
                                              onClick={() => addInlineWordChoiceOption(section.id, subsection.id, question.id, item.id)}
                                            >
                                              <Plus className="mr-2 h-4 w-4" />
                                              Add Option
                                            </Button>

                                            <div className="space-y-2">
                                              <Label>Correct Answer</Label>
                                              <select
                                                value={item.correctAnswer}
                                                onChange={(event) =>
                                                  updateInlineWordChoiceItem(section.id, subsection.id, question.id, item.id, (currentItem) => ({
                                                    ...currentItem,
                                                    correctAnswer: event.target.value,
                                                  }))
                                                }
                                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                              >
                                                {item.options.map((option) => (
                                                  <option key={option.id} value={option.label}>
                                                    {option.label}: {option.text || `Option ${option.label}`}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => addInlineWordChoiceItem(section.id, subsection.id, question.id)}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Sentence
                                    </Button>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "passage-inline-word-choice" &&
                              subsection.questions.filter(isManualPassageInlineWordChoiceQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-emerald-800">{`Passage Click Correct Word ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Each passage blank gets its own set of clickable word choices.</p>
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-3">
                                      {question.items.map((item) => (
                                        <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                          <div className="mb-3 flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-700">{`Blank ${item.label}`}</p>
                                          </div>

                                          <div className="space-y-3">
                                            <div className="grid gap-3 md:grid-cols-2">
                                              {item.options.map((option) => (
                                                <div key={option.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                                  <div className="mb-2 flex items-center justify-between gap-2">
                                                    <Label>{`Option ${option.label}`}</Label>
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="icon"
                                                      onClick={() => removePassageInlineWordChoiceOption(section.id, subsection.id, question.id, item.id, option.id)}
                                                      className="h-8 w-8 text-slate-500 hover:text-red-500"
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                  <Input
                                                    value={option.text}
                                                    onChange={(event) =>
                                                      updatePassageInlineWordChoiceOption(section.id, subsection.id, question.id, item.id, option.id, (currentOption) => ({
                                                        ...currentOption,
                                                        text: event.target.value,
                                                      }))
                                                    }
                                                    placeholder={`Type option ${option.label}`}
                                                  />
                                                </div>
                                              ))}
                                            </div>

                                            <Button
                                              type="button"
                                              variant="outline"
                                              onClick={() => addPassageInlineWordChoiceOption(section.id, subsection.id, question.id, item.id)}
                                            >
                                              <Plus className="mr-2 h-4 w-4" />
                                              Add Option
                                            </Button>

                                            <div className="space-y-2">
                                              <Label>Correct Answer</Label>
                                              <select
                                                value={item.correctAnswer}
                                                onChange={(event) =>
                                                  updatePassageInlineWordChoiceQuestion(section.id, subsection.id, question.id, (currentQuestion) => ({
                                                    ...currentQuestion,
                                                    items: currentQuestion.items.map((currentItem) => (
                                                      currentItem.id === item.id
                                                        ? { ...currentItem, correctAnswer: event.target.value }
                                                        : currentItem
                                                    )),
                                                  }))
                                                }
                                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                              >
                                                {item.options.map((option) => (
                                                  <option key={option.id} value={option.label}>
                                                    {option.label}: {option.text || `Option ${option.label}`}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}

                            {/* Writing questions editor */}
                            {subsection.questionType === "writing" &&
                              subsection.questions.filter(isManualWritingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-rose-800">{`Writing Task ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Define the writing prompt, optional image, and word count guidelines.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Writing Prompt / Requirements</Label>
                                      <Textarea
                                        rows={4}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateWritingQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="e.g. Write a letter to your friend about your recent holiday. Include details about where you went, what you did, and how you felt."
                                      />
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                                        <div className="space-y-2">
                                          <Label>Prompt Image <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                          <p className="text-xs text-slate-500">
                                            Upload an image related to the writing task (e.g. a picture prompt).
                                          </p>
                                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-rose-300/60 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:border-rose-400 hover:text-rose-800">
                                            <ImagePlus className="h-4 w-4" />
                                            {question.image ? "Replace Image" : "Add Image"}
                                            <input
                                              type="file"
                                              accept="image/png,image/jpeg,image/webp,image/gif"
                                              className="hidden"
                                              onChange={(event) =>
                                                handleWritingImageUpload(
                                                  section.id,
                                                  subsection.id,
                                                  question.id,
                                                  event.target.files?.[0],
                                                )
                                              }
                                            />
                                          </label>
                                          {question.image && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              className="h-auto px-0 text-sm text-slate-500 hover:text-red-500"
                                              onClick={() =>
                                                updateWritingQuestion(section.id, subsection.id, question.id, (q) => ({
                                                  ...q,
                                                  image: undefined,
                                                }))
                                              }
                                            >
                                              Remove Image
                                            </Button>
                                          )}
                                        </div>

                                        <div className="space-y-2">
                                          <Label>Preview</Label>
                                          <div className="flex min-h-[100px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                                            {question.image ? (
                                              <img
                                                src={question.image.previewUrl || question.image.dataUrl}
                                                alt="Writing prompt"
                                                className="max-h-28 w-full object-contain"
                                              />
                                            ) : (
                                              <span className="px-4 text-center text-xs text-slate-400">
                                                No image
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label>Min Words <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={question.minWords ?? ""}
                                          onChange={(event) =>
                                            updateWritingQuestion(
                                              section.id,
                                              subsection.id,
                                              question.id,
                                              (currentQuestion) => ({
                                                ...currentQuestion,
                                                minWords: event.target.value ? Number(event.target.value) : undefined,
                                              }),
                                            )
                                          }
                                          placeholder="e.g. 80"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Max Words <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={question.maxWords ?? ""}
                                          onChange={(event) =>
                                            updateWritingQuestion(
                                              section.id,
                                              subsection.id,
                                              question.id,
                                              (currentQuestion) => ({
                                                ...currentQuestion,
                                                maxWords: event.target.value ? Number(event.target.value) : undefined,
                                              }),
                                            )
                                          }
                                          placeholder="e.g. 150"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Reference Answer <span className="text-xs font-normal text-slate-400">(optional, for grading reference)</span></Label>
                                      <Textarea
                                        rows={4}
                                        value={question.referenceAnswer ?? ""}
                                        onChange={(event) =>
                                          updateWritingQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              referenceAnswer: event.target.value || undefined,
                                            }),
                                          )
                                        }
                                        placeholder="Type a model/reference answer for grading purposes."
                                      />
                                    </div>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}

                            {/* Speaking questions editor */}
                            {subsection.questionType === "speaking" && (
                              <div className="space-y-4">
                                <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                                  <div className="space-y-2">
                                    <Label>Main Task Description <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                    <Textarea
                                      rows={3}
                                      value={subsection.taskDescription ?? ""}
                                      onChange={(event) =>
                                        updateSubsection(section.id, subsection.id, (currentSubsection) => ({
                                          ...currentSubsection,
                                          taskDescription: event.target.value || undefined,
                                        }))
                                      }
                                      placeholder="e.g. Look at the situation below. Think about what you want to say before you record your answer."
                                    />
                                    <p className="text-xs text-slate-500">
                                      This is the overall speaking task description shown above all prompts in this big question.
                                    </p>
                                  </div>
                                </div>

                              {subsection.questions.filter(isManualSpeakingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-sky-800">{`Speaking Task ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Students will see the prompt, review the optional image, and record their answer.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeQuestion(section.id, subsection.id, question.id)}
                                      className="text-slate-500 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Speaking Prompt</Label>
                                      <Textarea
                                        rows={4}
                                        value={question.prompt}
                                        onChange={(event) =>
                                          updateSpeakingQuestion(
                                            section.id,
                                            subsection.id,
                                            question.id,
                                            (currentQuestion) => ({
                                              ...currentQuestion,
                                              prompt: event.target.value,
                                            }),
                                          )
                                        }
                                        placeholder="e.g. Look at the picture and describe what the people are doing. Then say whether you would enjoy this activity."
                                      />
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                                        <div className="space-y-2">
                                          <Label>Prompt Image <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
                                          <p className="text-xs text-slate-500">
                                            Upload a picture students should look at before they record their answer.
                                          </p>
                                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-sky-300/60 bg-white px-3 py-2 text-sm font-medium text-sky-700 transition-colors hover:border-sky-400 hover:text-sky-800">
                                            <ImagePlus className="h-4 w-4" />
                                            {question.image ? "Replace Image" : "Add Image"}
                                            <input
                                              type="file"
                                              accept="image/png,image/jpeg,image/webp,image/gif"
                                              className="hidden"
                                              onChange={(event) =>
                                                handleSpeakingImageUpload(
                                                  section.id,
                                                  subsection.id,
                                                  question.id,
                                                  event.target.files?.[0],
                                                )
                                              }
                                            />
                                          </label>
                                          {question.image && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              className="h-auto px-0 text-sm text-slate-500 hover:text-red-500"
                                              onClick={() =>
                                                updateSpeakingQuestion(section.id, subsection.id, question.id, (q) => ({
                                                  ...q,
                                                  image: undefined,
                                                }))
                                              }
                                            >
                                              Remove Image
                                            </Button>
                                          )}
                                        </div>

                                        <div className="space-y-2">
                                          <Label>Preview</Label>
                                          <div className="flex min-h-[100px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                                            {question.image ? (
                                              <img
                                                src={question.image.previewUrl || question.image.dataUrl}
                                                alt="Speaking prompt"
                                                className="max-h-28 w-full object-contain"
                                              />
                                            ) : (
                                              <span className="px-4 text-center text-xs text-slate-400">
                                                No image
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ))}
                              </div>
                            )}

                            {/* Passage MCQ — per-blank options editor */}
                            {subsection.questionType === "passage-mcq" && (() => {
                              const passageMCQQuestions = subsection.questions.filter(isManualPassageMCQQuestion);
                              if (passageMCQQuestions.length === 0) {
                                return (
                                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                                    Add ___ blanks in the passage above to create MCQ slots.
                                  </div>
                                );
                              }
                              return passageMCQQuestions.map((question, questionIndex) => (
                                <div key={question.id} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-violet-800">{`Blank ${questionIndex + 1}`}</p>
                                      <p className="text-xs text-slate-500">Define the MCQ options for this blank.</p>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {question.options.map((option) => (
                                        <div key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">
                                            {option.label}
                                          </span>
                                          <Input
                                            value={option.text}
                                            onChange={(event) =>
                                              updatePassageMCQQuestion(section.id, subsection.id, question.id, (q) => ({
                                                ...q,
                                                options: q.options.map((o) =>
                                                  o.id === option.id ? { ...o, text: event.target.value } : o,
                                                ),
                                              }))
                                            }
                                            placeholder={`Option ${option.label} text`}
                                            className="h-8 text-sm"
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removePassageMCQOption(section.id, subsection.id, question.id, option.id)}
                                            className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-500"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addPassageMCQOption(section.id, subsection.id, question.id)}
                                        className="text-xs"
                                      >
                                        <Plus className="mr-1 h-3 w-3" />
                                        Add Option
                                      </Button>

                                      <div className="min-w-[140px] space-y-1">
                                        <Label className="text-xs">Correct Answer</Label>
                                        <select
                                          value={question.correctAnswer}
                                          onChange={(event) =>
                                            updatePassageMCQQuestion(section.id, subsection.id, question.id, (q) => ({
                                              ...q,
                                              correctAnswer: event.target.value,
                                            }))
                                          }
                                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                                        >
                                          {question.options.map((option, optionIndex) => (
                                            <option key={option.id} value={getOptionLabel(optionIndex)}>
                                              {getOptionLabel(optionIndex)}. {option.text || "—"}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    {!isQuestionBankMode && renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                  </div>
                                </div>
                              ));
                            })()}

                            {/* Passage fill-blank answer mapping */}
                            {subsection.questionType === "passage-fill-blank" && (() => {
                              const passageQuestions = subsection.questions.filter(isManualPassageFillBlankQuestion);
                              if (passageQuestions.length === 0) {
                                return (
                                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                                    Add ___ blanks in the passage above to create answer slots.
                                  </div>
                                );
                              }
                              return (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="mb-3">
                                    <p className="text-sm font-semibold text-slate-800">Answer Mapping</p>
                                    <p className="text-xs text-slate-500">
                                      Assign the correct word bank item for each blank in the passage.
                                    </p>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {passageQuestions.map((question, questionIndex) => (
                                      <div key={question.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="mb-2 text-sm font-semibold text-slate-700">Blank {questionIndex + 1}</p>
                                        <select
                                          value={question.correctAnswerWordBankId}
                                          onChange={(event) =>
                                            updatePassageFillBlankQuestion(
                                              section.id,
                                              subsection.id,
                                              question.id,
                                              (currentQuestion) => ({
                                                ...currentQuestion,
                                                correctAnswerWordBankId: event.target.value,
                                              }),
                                            )
                                          }
                                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                                        >
                                          {(subsection.wordBank ?? []).map((item) => (
                                            <option key={item.id} value={item.id}>
                                              {item.letter}. {item.word || "Untitled word"}
                                            </option>
                                          ))}
                                        </select>

                                        {!isQuestionBankMode && (
                                          <div className="mt-3">
                                            {renderQuestionTagEditor(section.id, subsection.id, question, section.sectionType)}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Add question/blank button — not shown for passage-based auto-synced types */}
                          {!isQuestionBankMode
                            && subsection.questionType !== "passage-fill-blank"
                            && subsection.questionType !== "passage-mcq"
                            && subsection.questionType !== "passage-inline-word-choice" && (
                            <Button type="button" variant="outline" onClick={() => addQuestion(section.id, subsection.id)}>
                              <FilePlus2 className="mr-2 h-4 w-4" />
                              {subsection.questionType === "fill-blank"
                                ? "Add Blank"
                                : subsection.questionType === "writing"
                                  ? "Add Writing Task"
                                  : subsection.questionType === "speaking"
                                    ? "Add Speaking Task"
                                    : subsection.questionType === "passage-matching"
                                      ? "Add Match Prompt"
                                      : subsection.questionType === "sentence-reorder"
                                        ? "Add Sentence Set"
                                      : subsection.questionType === "inline-word-choice"
                                        ? "Add Click-Word Set"
                                      : subsection.questionType === "heading-match"
                                        ? "Add Paragraph Match"
                                      : subsection.questionType === "true-false"
                                          ? "Add Statement Block"
                                          : subsection.questionType === "ordering"
                                            ? "Add Ordering Block"
                                            : subsection.questionType === "checkbox"
                                              ? "Add Checkbox Question"
                                              : "Add Question"}
                            </Button>
                          )}
                        </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  {!isQuestionBankMode ? (
                    <Button type="button" variant="outline" onClick={() => addSubsection(section.id)}>
                      <SquarePen className="mr-2 h-4 w-4" />
                      Add Question
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}

            {buildMode === "fixed" ? (
              isQuestionBankMode ? (
                <Button type="button" variant="outline" onClick={addSection}>
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={addSection} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Section
                </Button>
              )
            ) : null}
          </div>

          <div
            ref={previewColumnRef}
            className={`space-y-6 ${isStickyPreviewMode ? "xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1" : ""}`}
          >
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  {buildMode === "generated"
                    ? "Preview of the random paper assembled from your current tag rules."
                    : isQuestionBankMode
                      ? "Quick preview of the question bank items you are recording one by one."
                    : "Quick student-facing preview of the paper structure you are building."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!effectiveTitle.trim() && !effectiveDescription.trim() && previewBlueprint.sections.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                    {isQuestionBankMode ? "Start recording questions on the left." : "Start building the paper on the left."}
                  </div>
                )}

                {buildMode === "generated" && previewBlueprint.sections.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                    配好组卷分区和规则后，这里会显示一份随机生成的预览卷。
                  </div>
                ) : null}

                {!isQuestionBankMode ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-lg font-semibold text-slate-800">{effectiveTitle || "Untitled Paper"}</p>
                    <p className="mt-2 text-sm text-slate-500">{effectiveDescription || "No description yet."}</p>
                  </div>
                ) : null}

                {previewBlueprint.sections.map((section) => (
                  <div key={section.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800">
                      {section.partLabel} · {MANUAL_SECTION_TYPE_LABELS[section.sectionType]}
                    </p>

                    <div className="mt-4 space-y-4">
                      {section.subsections.map((subsection, subsectionIndex) => (
                        <div
                          key={subsection.id}
                          data-preview-subsection-id={subsection.id}
                          className={`rounded-xl p-4 transition-colors ${
                            activePreviewSubsectionId === subsection.id
                              ? "bg-sky-50 ring-2 ring-sky-200"
                              : "bg-slate-50"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800">
                                {`Question ${subsectionIndex + 1}`}
                              </p>
                              {isQuestionBankMode ? (
                                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                                  {getQuestionBankDisplayId(section)}
                                </span>
                              ) : null}
                            </div>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              {MANUAL_QUESTION_TYPE_LABELS[subsection.questionType]}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                            {subsection.instructions || "No instructions yet."}
                          </p>

                          {subsection.sceneImage && (
                            <div className="mt-4 flex justify-center rounded-2xl border border-slate-200 bg-white p-3">
                              <img
                                src={subsection.sceneImage.previewUrl || subsection.sceneImage.dataUrl}
                                alt={`Question ${subsectionIndex + 1}`}
                                className="max-h-60 w-full object-contain"
                              />
                            </div>
                          )}

                          {subsection.audio && (
                            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Volume2 className="h-3.5 w-3.5 text-sky-700" />
                                <p className="text-xs font-semibold text-sky-800">Listening Audio</p>
                              </div>
                              <audio
                                controls
                                className="w-full"
                                src={subsection.audio.previewUrl || subsection.audio.dataUrl}
                              />
                            </div>
                          )}

                          <div className="mt-4 space-y-4">
                            {subsection.questionType === "mcq" &&
                              subsection.questions.filter(isManualMCQQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <p className="text-sm font-medium text-slate-800">
                                    {`${questionIndex + 1}. ${question.prompt || "Question prompt goes here."}`}
                                  </p>
                                  {question.options.some((option) => option.image) ? (
                                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                                      {question.options.map((option) => (
                                        <div key={option.id} className="rounded-xl border border-slate-200 p-3">
                                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            {option.label}
                                          </p>
                                          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-24">
                                            {option.image ? (
                                              <img
                                                src={option.image.previewUrl || option.image.dataUrl}
                                                alt={`Preview ${option.label}`}
                                                className="h-full w-full object-contain"
                                              />
                                            ) : (
                                              <span className="px-2 text-center text-[10px] text-slate-400">No image</span>
                                            )}
                                          </div>
                                          <p className="mt-2 text-xs text-slate-600">
                                            {option.text || `Option ${option.label}`}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="mt-3 grid gap-2">
                                      {question.options.map((option) => (
                                        <div
                                          key={option.id}
                                          className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
                                        >
                                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                            {option.label}
                                          </span>
                                          <span className="text-sm text-slate-700">
                                            {option.text || `Option ${option.label}`}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <p className="mt-3 text-xs font-medium text-emerald-700">
                                    Correct answer{(question.correctAnswers?.length || 1) > 1 ? "s" : ""}:{" "}
                                    {(question.correctAnswers && question.correctAnswers.length > 0
                                      ? question.correctAnswers
                                      : [question.correctAnswer]
                                    ).join(", ")}
                                  </p>
                                </div>
                              ))}

                            {subsection.questionType === "fill-blank" && (
                              <FillBlankSubsectionPreview subsection={subsection} />
                            )}

                            {subsection.questionType === "passage-fill-blank" && (
                              <PassageFillBlankSubsectionPreview subsection={subsection} />
                            )}

                            {subsection.questionType === "passage-mcq" && (
                              <PassageMCQPreview
                                passageText={subsection.passageText ?? ""}
                                questions={subsection.questions.filter(isManualPassageMCQQuestion)}
                                sceneImageUrl={subsection.sceneImage?.previewUrl || subsection.sceneImage?.dataUrl}
                              />
                            )}

                            {subsection.questionType === "typed-fill-blank" &&
                              subsection.questions.filter(isManualTypedFillBlankQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  {section.sectionType === "math-short-answer" || section.sectionType === "math-application" ? (
                                    <div className="min-h-[170px] rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5">
                                      <p className="text-sm font-medium text-slate-800">
                                        {`${questionIndex + 1}. `}
                                        {renderTextWithFractions(
                                          (question.prompt.trim() || "Question prompt goes here.").replace(/\s*___\s*/g, " ").trim(),
                                          `math-short-answer-preview-${question.id}`,
                                        )}
                                      </p>
                                      <div className="mt-14 flex justify-end">
                                        <span className="inline-flex h-12 w-36 rounded-md border-2 border-slate-400 bg-white" />
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm font-medium text-slate-800">
                                      {`${questionIndex + 1}. `}
                                      {(() => {
                                        const prompt = question.prompt.trim() || "Question prompt goes here.";
                                        if (!prompt.includes("___")) {
                                          return <>{prompt} <span className="inline-block min-w-[80px] border-b-2 border-slate-400 align-bottom">&nbsp;</span></>;
                                        }
                                        const parts = prompt.split("___");
                                        return parts.map((part, partIndex) => (
                                          <span key={partIndex}>
                                            {part}
                                            {partIndex < parts.length - 1 && (
                                              <span className="inline-block min-w-[80px] border-b-2 border-slate-400 align-bottom">&nbsp;</span>
                                            )}
                                          </span>
                                        ));
                                      })()}
                                    </p>
                                  )}
                                  <p className="mt-2 text-xs font-medium text-emerald-700">
                                    Correct answer: {question.correctAnswer || "(not set)"}
                                  </p>
                                </div>
                              ))}

                            {subsection.questionType === "picture-spelling" && (
                              <PictureSpellingSubsectionPreview subsection={subsection} />
                            )}

                            {subsection.questionType === "word-completion" && (
                              <WordCompletionSubsectionPreview subsection={subsection} />
                            )}

                            {subsection.questionType === "passage-open-ended" && (
                              <div className="space-y-4">
                                {(subsection.passageText ?? "").trim() ? (
                                  <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-700">Passage</p>
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                      {subsection.passageText}
                                    </p>
                                  </div>
                                ) : section.sectionType !== "math-application" ? (
                                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                                    Add a passage above to preview.
                                  </div>
                                ) : null}

                                {subsection.questions.filter(isManualPassageOpenEndedQuestion).map((question, questionIndex) => (
                                  <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                    <p className="text-sm font-medium text-slate-800">
                                      {`${questionIndex + 1}. ${question.prompt || "Question goes here."}`}
                                    </p>
                                    <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
                                      Student answer area
                                    </div>
                                    {question.referenceAnswer && (
                                      <p className="mt-2 text-xs font-medium text-emerald-700">
                                        Reference answer: {question.referenceAnswer}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {subsection.questionType === "passage-matching" && (() => {
                              const descriptions = subsection.matchingDescriptions ?? [];
                              const matchingQuestions = subsection.questions.filter(isManualPassageMatchingQuestion);
                              return (
                                <div className="space-y-4">
                                  {descriptions.length > 0 ? (
                                    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Matching Bank</p>
                                      <div className="space-y-3">
                                        {descriptions.map((desc) => (
                                          <div key={desc.id} className="flex gap-3">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">
                                              {desc.label}
                                            </span>
                                            <div>
                                              <p className="text-sm font-semibold text-slate-800">{desc.name || "Untitled"}</p>
                                              <p className="text-sm leading-relaxed text-slate-600">{desc.text || "No description yet."}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                                      Add descriptions above to preview.
                                    </div>
                                  )}

                                  {matchingQuestions.map((question, questionIndex) => (
                                    <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Link2 className="h-4 w-4 text-amber-600" />
                                        <p className="text-sm font-semibold text-slate-800">{`Match Prompt ${questionIndex + 1}`}</p>
                                      </div>
                                      <p className="text-sm leading-relaxed text-slate-700">
                                        {question.prompt || "Match prompt goes here."}
                                      </p>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {descriptions.map((desc) => (
                                          <span
                                            key={desc.id}
                                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                              desc.label === question.correctAnswer
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                                : "border-slate-200 bg-white text-slate-500"
                                            }`}
                                          >
                                            {desc.label}. {desc.name || "Untitled"}
                                          </span>
                                        ))}
                                      </div>
                                      <p className="mt-2 text-xs font-medium text-emerald-700">
                                        Correct option: {question.correctAnswer}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            {subsection.questionType === "true-false" &&
                              subsection.questions.filter(isManualTrueFalseQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <div className="mb-3 flex items-center gap-2">
                                    <SquarePen className="h-4 w-4 text-cyan-600" />
                                    <p className="text-sm font-semibold text-slate-800">{`Statement Block ${questionIndex + 1}`}</p>
                                  </div>
                                  <div className="space-y-3">
                                    {question.statements.map((statement) => (
                                      <div key={statement.id} className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-4">
                                        <p className="text-sm font-medium text-slate-800">
                                          {statement.label}. {statement.statement || "Statement goes here."}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {["True", "False", "Not Given"].map((choice) => {
                                            const isCorrect =
                                              (statement.correctAnswer === "true" && choice === "True")
                                              || (statement.correctAnswer === "false" && choice === "False")
                                              || (statement.correctAnswer === "not-given" && choice === "Not Given");
                                            return (
                                              <span
                                                key={choice}
                                                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                                  isCorrect
                                                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                                    : "border-slate-200 bg-white text-slate-500"
                                                }`}
                                              >
                                                {choice}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "heading-match" && (() => {
                              const descriptions = subsection.matchingDescriptions ?? [];
                              const headingQuestions = subsection.questions.filter(isManualHeadingMatchQuestion);
                              return (
                                <div className="space-y-4">
                                  {descriptions.length > 0 ? (
                                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700">Heading Bank</p>
                                      <div className="space-y-3">
                                        {descriptions.map((desc) => (
                                          <div key={desc.id} className="flex gap-3">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-900">
                                              {desc.label}
                                            </span>
                                            <div>
                                              <p className="text-sm font-semibold text-slate-800">{desc.name || "Untitled heading"}</p>
                                              {desc.text && (
                                                <p className="text-sm leading-relaxed text-slate-600">{desc.text}</p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {headingQuestions.map((question, questionIndex) => (
                                    <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Link2 className="h-4 w-4 text-indigo-600" />
                                        <p className="text-sm font-semibold text-slate-800">{`Prompt ${questionIndex + 1}`}</p>
                                      </div>
                                      <p className="text-sm leading-relaxed text-slate-700">
                                        {question.prompt || "Paragraph prompt goes here."}
                                      </p>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {descriptions.map((desc) => (
                                          <span
                                            key={desc.id}
                                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                              desc.label === question.correctAnswer
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                                : "border-slate-200 bg-white text-slate-500"
                                            }`}
                                          >
                                            {desc.label}. {desc.name || "Untitled heading"}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            {subsection.questionType === "checkbox" &&
                              subsection.questions.filter(isManualCheckboxQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <p className="text-sm font-medium text-slate-800">
                                    {`${questionIndex + 1}. ${question.prompt || "Checkbox question goes here."}`}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Select up to {question.selectionLimit ?? Math.max(question.correctAnswers.length, 2)} option(s)
                                  </p>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {question.options.map((option) => (
                                      <div
                                        key={option.id}
                                        className={`rounded-xl border px-3 py-2 text-sm ${
                                          question.correctAnswers.includes(option.label)
                                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                            : "border-slate-200 bg-white text-slate-600"
                                        }`}
                                      >
                                        {option.label}. {option.text || `Option ${option.label}`}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "ordering" &&
                              subsection.questions.filter(isManualOrderingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <p className="text-sm font-medium text-slate-800">
                                    {`${questionIndex + 1}. ${question.prompt || "Ordering prompt goes here."}`}
                                  </p>
                                  <div className="mt-3 space-y-2">
                                    {[...question.items]
                                      .sort((a, b) => a.correctPosition - b.correctPosition)
                                      .map((item) => (
                                        <div key={item.id} className="flex items-center gap-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50/40 px-3 py-2">
                                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-200 text-xs font-bold text-fuchsia-900">
                                            {item.correctPosition}
                                          </span>
                                          <span className="text-sm text-slate-700">{item.text || "Sequence item goes here."}</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "sentence-reorder" &&
                              subsection.questions.filter(isManualSentenceReorderQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <div className="mt-4 space-y-4">
                                    {question.items.map((item) => (
                                      <div key={item.id} className="rounded-xl border border-lime-100 bg-lime-50/30 p-4">
                                        <p className="text-sm font-medium text-slate-800">
                                          {item.label}. {item.scrambledWords || "Scrambled words go here."}
                                        </p>
                                        <div className="mt-3 rounded-lg border-b-2 border-dotted border-slate-300 pb-2 text-sm text-slate-400">
                                          {item.correctAnswer || "Student types the correct sentence here."}
                                        </div>
                                        {item.correctAnswer && (
                                          <p className="mt-2 text-xs font-medium text-emerald-700">
                                            Correct answer: {item.correctAnswer}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "inline-word-choice" &&
                              subsection.questions.filter(isManualInlineWordChoiceQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <div className="space-y-4">
                                    {question.items.map((item) => (
                                      <div key={item.id} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                                        <p className="text-sm leading-relaxed text-slate-800">
                                          <span className="mr-2 font-semibold text-slate-600">{item.label}</span>
                                          {(() => {
                                            const sentenceText = buildInlineWordChoiceSentence(item);
                                            if (sentenceText.includes("___")) {
                                              const parts = sentenceText.split(/___/g);
                                              return parts.map((part, partIndex) => (
                                                <span key={`${item.id}-${partIndex}`}>
                                                  {part}
                                                  {partIndex < parts.length - 1 && (
                                                    <>
                                                      {" "}
                                                      {item.options.map((option) => (
                                                        <span
                                                          key={option.id}
                                                          className={`mx-1 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                                                            option.label === item.correctAnswer
                                                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                                              : "border-slate-200 bg-white text-slate-500"
                                                          }`}
                                                        >
                                                          {option.text || `Option ${option.label}`}
                                                        </span>
                                                      ))}
                                                      {" "}
                                                    </>
                                                  )}
                                                </span>
                                              ));
                                            }

                                            return (
                                              <>
                                                {sentenceText || "Sentence goes here."}{" "}
                                                {item.options.map((option) => (
                                                  <span
                                                    key={option.id}
                                                    className={`mx-1 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                                                      option.label === item.correctAnswer
                                                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                                        : "border-slate-200 bg-white text-slate-500"
                                                    }`}
                                                  >
                                                    {option.text || `Option ${option.label}`}
                                                  </span>
                                                ))}
                                              </>
                                            );
                                          })()}
                                        </p>
                                        <p className="mt-2 text-xs font-medium text-emerald-700">
                                          Correct answer: {item.options.find((option) => option.label === item.correctAnswer)?.text || item.correctAnswer}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}

                            {subsection.questionType === "passage-inline-word-choice" && (
                              <PassageInlineWordChoiceSubsectionPreview subsection={subsection} />
                            )}

                            {subsection.questionType === "writing" &&
                              subsection.questions.filter(isManualWritingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <PenLine className="h-4 w-4 text-rose-600" />
                                    <p className="text-sm font-semibold text-slate-800">{`Writing Task ${questionIndex + 1}`}</p>
                                  </div>

                                  {question.image && (
                                    <div className="mb-4 flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                                      <img
                                        src={question.image.previewUrl || question.image.dataUrl}
                                        alt="Writing prompt"
                                        className="max-h-48 w-full object-contain"
                                      />
                                    </div>
                                  )}

                                  <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 mb-4">
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-700">Writing Prompt</p>
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                      {question.prompt || "Writing prompt goes here."}
                                    </p>
                                    {(question.minWords || question.maxWords) && (
                                      <p className="mt-2 text-xs text-slate-500">
                                        Word count: {question.minWords ? `min ${question.minWords}` : ""}
                                        {question.minWords && question.maxWords ? " – " : ""}
                                        {question.maxWords ? `max ${question.maxWords}` : ""}
                                      </p>
                                    )}
                                  </div>

                                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-xs text-slate-400">
                                    Student writing area
                                  </div>

                                  {question.referenceAnswer && (
                                    <p className="mt-3 text-xs font-medium text-emerald-700">
                                      Reference answer: {question.referenceAnswer.length > 100 ? question.referenceAnswer.slice(0, 100) + "…" : question.referenceAnswer}
                                    </p>
                                  )}
                                </div>
                              ))}

                            {subsection.questionType === "speaking" && (
                              <div className="space-y-4">
                              {subsection.taskDescription && (
                                <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-4">
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">Main Task Description</p>
                                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                    {subsection.taskDescription}
                                  </p>
                                </div>
                              )}
                              {subsection.questions.filter(isManualSpeakingQuestion).map((question, questionIndex) => (
                                <div key={question.id} className="rounded-xl border border-white bg-white p-4">
                                  <div className="mb-3 flex items-center gap-2">
                                    <Mic className="h-4 w-4 text-sky-600" />
                                    <p className="text-sm font-semibold text-slate-800">{`Speaking Task ${questionIndex + 1}`}</p>
                                  </div>

                                  {question.image && (
                                    <div className="mb-4 flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                                      <img
                                        src={question.image.previewUrl || question.image.dataUrl}
                                        alt="Speaking prompt"
                                        className="max-h-48 w-full object-contain"
                                      />
                                    </div>
                                  )}

                                  <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-4 mb-4">
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">Speaking Prompt</p>
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                      {question.prompt || "Speaking prompt goes here."}
                                    </p>
                                  </div>

                                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
                                    Student recording area
                                  </div>
                                </div>
                              ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {showPreviewActionCard ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex flex-wrap items-center gap-2.5 text-sm">
                  <div className={`rounded-full px-3 py-1 font-semibold ${currentPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {currentPublished ? "Status: Published" : "Status: Draft"}
                  </div>
                  {saveFeedback ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-emerald-700">
                      <Check className="h-4 w-4" />
                      <span className="font-medium">{saveFeedback}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPersisting || !editingPaperMeta}
                      onClick={handleSaveAsCopy}
                      className="gap-2 border-slate-200 px-4"
                    >
                      <FilePlus2 className="h-4 w-4" />
                      Save as Copy
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    disabled={saveDisabled}
                    onClick={handleSaveDraft}
                    className="gap-2 border-slate-200 px-4"
                  >
                    {isPersisting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquarePen className="h-4 w-4" />}
                    {draftActionLabel}
                  </Button>

                  <Button
                    type="button"
                    disabled={saveDisabled}
                    onClick={handlePublishPaper}
                    className="gap-2 bg-[#1E3A5F] px-5 text-white shadow-lg transition-all hover:bg-[#2a4f7a] hover:shadow-xl"
                  >
                    {isPersisting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {publishActionLabel}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Confirm / Save Button ── */}
        {buildMode !== "fixed" ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className={`rounded-full px-3 py-1 font-semibold ${currentPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {currentPublished ? "Status: Published" : "Status: Draft"}
            </div>
            {saveFeedback ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-emerald-700">
                <Check className="h-4 w-4" />
                <span className="font-medium">{saveFeedback}</span>
              </div>
            ) : (
              <span className="text-slate-500">
                {isQuestionBankMode
                  ? "Question bank items stay hidden until you publish the bank."
                  : "Drafts stay hidden until you publish the paper."}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {isEditing ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={isPersisting || !editingPaperMeta}
                onClick={handleSaveAsCopy}
                className="gap-2 border-slate-200"
              >
                <FilePlus2 className="h-4 w-4" />
                Save as Copy
              </Button>
            ) : null}

            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={saveDisabled}
              onClick={handleSaveDraft}
              className="gap-2 border-slate-200"
            >
              {isPersisting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquarePen className="h-4 w-4" />}
              {draftActionLabel}
            </Button>

            <Button
              type="button"
              size="lg"
              disabled={saveDisabled}
              onClick={handlePublishPaper}
              className="gap-2 bg-[#1E3A5F] px-8 text-white shadow-lg transition-all hover:bg-[#2a4f7a] hover:shadow-xl"
            >
              {isPersisting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {publishActionLabel}
            </Button>
          </div>
        </div>
        ) : null}
        </div>
      </div>
    </TeacherToolsLayout>
  );
}
