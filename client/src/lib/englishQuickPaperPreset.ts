import type {
  ManualPaperGenerationConfig,
  ManualPaperGenerationRule,
  ManualPaperGenerationSection,
  ManualQuestionType,
  ManualSectionType,
} from "@shared/manualPaperBlueprint";
import { ENGLISH_EXAM_TAG_SCHEMAS, type EnglishExamTagTrack } from "@shared/englishQuestionTags";

const QUICK_GENERATED_PAPER_PRESET_KEY = "pureon_english_quick_generated_preset_v1";

export interface EnglishQuickGeneratedPartSelection {
  id: string;
  examPart: string;
  sectionType: ManualSectionType;
  questionType: ManualQuestionType;
  totalQuestions: number;
}

export interface EnglishQuickGeneratedPaperPreset {
  subject: "english";
  title: string;
  description: string;
  generationConfig: ManualPaperGenerationConfig;
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

export function createEnglishQuickGeneratedPreset(
  track: EnglishExamTagTrack,
  parts: EnglishQuickGeneratedPartSelection[],
): EnglishQuickGeneratedPaperPreset {
  const trackLabel = ENGLISH_EXAM_TAG_SCHEMAS[track].label;
  return {
    subject: "english",
    title: `${track.toUpperCase()} Random Assessment`,
    description: `Auto-generated from tagged ${trackLabel} question bank parts.`,
    generationConfig: buildEnglishQuickGeneratedConfig(track, parts),
  };
}

export function writeEnglishQuickGeneratedPreset(preset: EnglishQuickGeneratedPaperPreset) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(QUICK_GENERATED_PAPER_PRESET_KEY, JSON.stringify(preset));
  } catch {
    // Ignore storage failures.
  }
}

export function readEnglishQuickGeneratedPreset() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(QUICK_GENERATED_PAPER_PRESET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EnglishQuickGeneratedPaperPreset>;
    if (parsed.subject !== "english" || !parsed.generationConfig) return null;

    return {
      subject: "english" as const,
      title: typeof parsed.title === "string" ? parsed.title : "KET Random Assessment",
      description: typeof parsed.description === "string" ? parsed.description : "",
      generationConfig: parsed.generationConfig,
    };
  } catch {
    return null;
  }
}

export function clearEnglishQuickGeneratedPreset() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(QUICK_GENERATED_PAPER_PRESET_KEY);
  } catch {
    // Ignore storage failures.
  }
}
