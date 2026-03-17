import type {
  ManualPaperGenerationConfig,
  ManualPaperGenerationRule,
  ManualPaperGenerationSection,
  ManualQuestionType,
  ManualSectionType,
} from "@shared/manualPaperBlueprint";
import { ENGLISH_EXAM_TAG_SCHEMAS, type EnglishExamTagTrack } from "@shared/englishQuestionTags";

export interface EnglishQuickGeneratedPartSelection {
  id: string;
  examPart: string;
  sectionType: ManualSectionType;
  questionType: ManualQuestionType;
  totalQuestions: number;
}

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `quick_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function inferEnglishSectionTypeFromExamPart(examPart: string): ManualSectionType {
  if (examPart.startsWith("听力")) return "listening";
  if (examPart.startsWith("写作")) return "writing";
  return "reading";
}

export function getQuestionTypesForEnglishExamPart(examPart: string): ManualQuestionType[] {
  const sectionType = inferEnglishSectionTypeFromExamPart(examPart);
  if (sectionType === "listening") {
    return ["mcq", "typed-fill-blank", "true-false", "checkbox", "ordering"];
  }
  if (sectionType === "writing") {
    return ["writing"];
  }
  return [
    "mcq",
    "passage-mcq",
    "typed-fill-blank",
    "passage-open-ended",
    "true-false",
    "heading-match",
    "checkbox",
    "ordering",
    "sentence-reorder",
    "passage-matching",
    "fill-blank",
    "passage-fill-blank",
    "inline-word-choice",
    "passage-inline-word-choice",
  ];
}

export function createEnglishQuickGeneratedPartSelections(track: EnglishExamTagTrack): EnglishQuickGeneratedPartSelection[] {
  return ENGLISH_EXAM_TAG_SCHEMAS[track].examParts.map((examPart) => {
    const sectionType = inferEnglishSectionTypeFromExamPart(examPart);
    return {
      id: createLocalId(),
      examPart,
      sectionType,
      questionType: getQuestionTypesForEnglishExamPart(examPart)[0],
      totalQuestions: 0,
    };
  });
}

function createRuleForPart(track: EnglishExamTagTrack, part: EnglishQuickGeneratedPartSelection): ManualPaperGenerationRule {
  return {
    id: createLocalId(),
    label: part.examPart,
    weight: 1,
    filters: {
      sectionTypes: [part.sectionType],
      questionTypes: [part.questionType],
      track,
      examPart: part.examPart,
    },
  };
}

function createSectionForPart(track: EnglishExamTagTrack, part: EnglishQuickGeneratedPartSelection): ManualPaperGenerationSection {
  return {
    id: createLocalId(),
    title: part.examPart,
    sectionType: part.sectionType,
    instructions: "",
    totalQuestions: Math.max(1, Math.round(part.totalQuestions || 0)),
    rules: [createRuleForPart(track, part)],
  };
}

export function buildEnglishQuickGeneratedConfig(
  track: EnglishExamTagTrack,
  parts: EnglishQuickGeneratedPartSelection[],
): ManualPaperGenerationConfig {
  return {
    sourcePaperIds: [],
    sections: parts
      .filter((part) => (Number.isFinite(part.totalQuestions) ? part.totalQuestions : 0) > 0)
      .map((part) => createSectionForPart(track, part)),
  };
}

export function getEnglishQuickGeneratedTitle(track: EnglishExamTagTrack) {
  return `${track.toUpperCase()} Random Assessment`;
}

export function getEnglishQuickGeneratedDescription(track: EnglishExamTagTrack) {
  const trackLabel = ENGLISH_EXAM_TAG_SCHEMAS[track].label;
  return `Auto-generated from tagged ${trackLabel} question bank parts.`;
}

export function inferTrackFromEnglishQuickGeneratedConfig(config: ManualPaperGenerationConfig | undefined): EnglishExamTagTrack {
  for (const section of config?.sections ?? []) {
    for (const rule of section.rules) {
      if (rule.filters.track === "ket" || rule.filters.track === "pet") {
        return rule.filters.track;
      }
    }
  }

  return "ket";
}

export function restoreEnglishQuickGeneratedPartSelections(
  track: EnglishExamTagTrack,
  config: ManualPaperGenerationConfig | undefined,
) {
  const baseSelections = createEnglishQuickGeneratedPartSelections(track);

  for (const section of config?.sections ?? []) {
    const firstRule = section.rules[0];
    const examPart = firstRule?.filters.examPart || section.title;
    if (!examPart) continue;

    const match = baseSelections.find((part) => part.examPart === examPart);
    if (!match) continue;

    match.sectionType = section.sectionType;
    match.totalQuestions = Math.max(0, Number(section.totalQuestions) || 0);
    match.questionType = firstRule?.filters.questionTypes?.[0] || match.questionType;
  }

  return baseSelections;
}
