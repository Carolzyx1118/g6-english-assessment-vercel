import {
  PAPER_SUBJECT_LABELS,
  type Paper,
  type PaperCategory,
  type PaperSubject,
  type Section,
} from "@/data/papers";
import { blueprintToPaper } from "@shared/blueprintToPaper";
import {
  normalizeEnglishTagAbility,
  type EnglishExamTagSystem,
  type SubjectTagSystem,
  type TagSystemMode,
  type TagSystemPracticeMode,
} from "@shared/englishQuestionTags";
import type {
  ManualPaperBlueprint,
  ManualPaperGenerationRule,
  ManualPaperGenerationSection,
  ManualQuestionType,
  ManualSectionType,
} from "@shared/manualPaperBlueprint";
import { generatePaperFromTaggedSources } from "@shared/taggedPaperGenerator";

type TagSystemPaperSource = {
  paperId: string;
  title: string;
  blueprint: ManualPaperBlueprint;
};

type TagSystemConfig = EnglishExamTagSystem | SubjectTagSystem;

const DEFAULT_SECTION_TYPE_BY_SUBJECT: Record<PaperSubject, ManualSectionType> = {
  english: "reading",
  math: "math-multiple-choice",
  vocabulary: "vocabulary",
};

const ICON_BY_SUBJECT: Record<PaperSubject, string> = {
  english: "📘",
  math: "🧮",
  vocabulary: "📚",
};

function inferEnglishSectionTypeFromExamPart(examPart: string | undefined) {
  const normalized = (examPart || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("reading") || normalized.includes("阅读")) return "reading";
  if (normalized.includes("listening") || normalized.includes("听力")) return "listening";
  if (normalized.includes("writing") || normalized.includes("写作")) return "writing";
  if (normalized.includes("speaking") || normalized.includes("口语")) return "speaking";
  if (normalized.includes("grammar") || normalized.includes("语法")) return "grammar";
  if (normalized.includes("vocabulary") || normalized.includes("词汇")) return "vocabulary";
  return null;
}

function inferMathSectionType(examPart: string | undefined, questionType: string | undefined): ManualSectionType {
  const normalizedExamPart = (examPart || "").trim().toLowerCase();
  if (normalizedExamPart.includes("application") || normalizedExamPart.includes("word problem") || normalizedExamPart.includes("应用")) {
    return "math-application";
  }
  if (normalizedExamPart.includes("multiple") || normalizedExamPart.includes("choice") || normalizedExamPart.includes("选择")) {
    return "math-multiple-choice";
  }
  if (questionType === "mcq") {
    return "math-multiple-choice";
  }
  if (questionType === "passage-open-ended") {
    return "math-application";
  }
  return "math-short-answer";
}

function inferEnglishSectionTypeFromQuestionType(questionType: string | undefined): ManualSectionType {
  switch (questionType) {
    case "speaking":
      return "speaking";
    case "writing":
      return "writing";
    case "picture-spelling":
    case "word-completion":
    case "fill-blank":
      return "vocabulary";
    case "typed-fill-blank":
    case "sentence-reorder":
    case "inline-word-choice":
      return "grammar";
    default:
      return "reading";
  }
}

function inferPracticeSectionType(
  subject: PaperSubject,
  practiceMode: TagSystemPracticeMode,
  filterValue: string,
): ManualSectionType {
  if (subject === "vocabulary") return "vocabulary";
  if (subject === "math") return inferMathSectionType(filterValue, filterValue);

  if (practiceMode === "skill") {
    const normalizedAbility = normalizeEnglishTagAbility(filterValue);
    if (normalizedAbility === "Listening") return "listening";
    if (normalizedAbility === "Writing") return "writing";
    if (normalizedAbility === "Speaking") return "speaking";
    if (normalizedAbility === "Grammar") return "grammar";
    if (normalizedAbility === "Vocabulary") return "vocabulary";
    return "reading";
  }

  if (practiceMode === "question-type") {
    return inferEnglishSectionTypeFromQuestionType(filterValue);
  }

  return DEFAULT_SECTION_TYPE_BY_SUBJECT[subject];
}

function inferSectionType(
  subject: PaperSubject,
  questionType: string | undefined,
  examPart: string | undefined,
  practiceMode?: TagSystemPracticeMode,
  practiceFilterValue?: string,
): ManualSectionType {
  if (practiceMode && practiceFilterValue) {
    return inferPracticeSectionType(subject, practiceMode, practiceFilterValue);
  }

  if (subject === "math") {
    return inferMathSectionType(examPart, questionType);
  }

  if (subject === "vocabulary") {
    return "vocabulary";
  }

  return (
    inferEnglishSectionTypeFromExamPart(examPart)
    || inferEnglishSectionTypeFromQuestionType(questionType)
    || "reading"
  );
}

function createRule(id: string, filters: ManualPaperGenerationRule["filters"]): ManualPaperGenerationRule {
  return {
    id,
    label: id,
    weight: 1,
    filters,
  };
}

function buildAssessmentSections(
  subject: PaperSubject,
  system: TagSystemConfig,
): ManualPaperGenerationSection[] {
  const config = system.generatedPaper;
  if (!config) return [];

  return config.parts
    .filter((part) => Math.max(0, Number(part.totalQuestions || 0)) > 0)
    .map((part, index) => ({
      id: `part-${index + 1}`,
      title: part.examPart,
      sectionType: inferSectionType(subject, part.questionType, part.examPart),
      totalQuestions: Math.max(0, Number(part.totalQuestions || 0)),
      rules: [
        createRule(`part-${index + 1}-rule`, {
          track: system.id,
          examPart: part.examPart,
          questionTypes: [part.questionType as ManualQuestionType],
          ...(subject === "english" ? { entries: ["Exam Bank"] } : {}),
        }),
      ],
    }));
}

function buildPracticeSections(
  subject: PaperSubject,
  system: TagSystemConfig,
): ManualPaperGenerationSection[] {
  const config = system.generatedPaper;
  if (!config) return [];

  return config.practiceRules
    .filter((rule) => rule.filterValue.trim().length > 0 && Math.max(0, Number(rule.totalQuestions || 0)) > 0)
    .map((rule, index) => ({
      id: `practice-${index + 1}`,
      title: rule.filterValue,
      sectionType: inferSectionType(
        subject,
        config.practiceMode === "question-type" ? rule.filterValue : undefined,
        undefined,
        config.practiceMode,
        rule.filterValue,
      ),
      totalQuestions: Math.max(0, Number(rule.totalQuestions || 0)),
      rules: [
        createRule(`practice-${index + 1}-rule`, {
          track: system.id,
          ...(subject === "english" ? { entries: ["Textbook Practice"] } : {}),
          ...(config.practiceMode === "unit" ? { unit: rule.filterValue } : {}),
          ...(config.practiceMode === "question-type" ? { questionTypes: [rule.filterValue as ManualQuestionType] } : {}),
          ...(config.practiceMode === "skill" && subject === "english"
            ? { abilities: [normalizeEnglishTagAbility(rule.filterValue)] }
            : {}),
        }),
      ],
    }));
}

function buildTagSystemBlueprint(
  subject: PaperSubject,
  system: TagSystemConfig,
): ManualPaperBlueprint {
  const systemMode: TagSystemMode = system.systemMode === "textbook-practice" ? "textbook-practice" : "assessment";
  const config = system.generatedPaper;

  const sections = systemMode === "textbook-practice"
    ? buildPracticeSections(subject, system)
    : buildAssessmentSections(subject, system);

  return {
    id: `tag-system-${subject}-${system.id}`,
    title: config?.title?.trim() || system.label,
    description: config?.description?.trim() || "",
    createdAt: new Date(0).toISOString(),
    buildMode: "generated",
    visibilityMode: "student",
    sections: [],
    generationConfig: {
      sections,
    },
  };
}

function toPaperCategory(systemMode: TagSystemMode | undefined): PaperCategory {
  return systemMode === "textbook-practice" ? "practice" : "assessment";
}

function buildTagSystemPaper(
  subject: PaperSubject,
  system: TagSystemConfig,
  sourcePapers: TagSystemPaperSource[],
): Paper {
  const template = buildTagSystemBlueprint(subject, system);
  const generated = generatePaperFromTaggedSources(template, sourcePapers);
  const converted = blueprintToPaper(generated.blueprint, {
    subject,
    category: toPaperCategory(system.systemMode),
  });

  const title = system.generatedPaper?.title?.trim() || system.label;
  const description = system.generatedPaper?.description?.trim() || converted.description;

  return {
    ...converted,
    id: `tag-system-${subject}-${system.id}`,
    title,
    description,
    icon: ICON_BY_SUBJECT[subject],
    subject,
    category: toPaperCategory(system.systemMode),
    sections: converted.sections as unknown as Section[],
    tags: [
      PAPER_SUBJECT_LABELS[subject],
      system.systemMode === "textbook-practice" ? "Practice" : "Assessment",
      system.label,
    ],
    isGeneratedPaper: true,
    generationWarnings: generated.warnings,
  } as Paper;
}

export function buildTagSystemPapers(
  subject: PaperSubject,
  systems: TagSystemConfig[],
  sourcePapers: TagSystemPaperSource[],
): Paper[] {
  return systems.map((system) => buildTagSystemPaper(subject, system, sourcePapers));
}
