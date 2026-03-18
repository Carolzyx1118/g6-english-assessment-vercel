import type {
  ManualPaperBlueprint,
  ManualPaperBuildMode,
  ManualPaperGenerationConfig,
  ManualPaperGenerationRule,
  ManualPaperVisibilityMode,
  ManualQuestion,
  ManualQuestionType,
  ManualSection,
  ManualSectionType,
  ManualSubsection,
} from "./manualPaperBlueprint";
import {
  normalizeEnglishTagAbility,
  normalizeEnglishTagDifficulty,
  normalizeEnglishTagEntry,
  type EnglishQuestionTagProfile,
  type SubjectQuestionTagProfile,
} from "./englishQuestionTags";

type QuestionTagProfile =
  | ({ kind: "english" } & EnglishQuestionTagProfile)
  | ({ kind: "math" } & SubjectQuestionTagProfile)
  | ({ kind: "vocabulary" } & SubjectQuestionTagProfile);

type GeneratorSourcePaper = {
  paperId: string;
  title: string;
  blueprint: ManualPaperBlueprint;
};

type GenerationCandidate = {
  id: string;
  sourcePaperId: string;
  sourcePaperTitle: string;
  sectionType: ManualSectionType;
  questionType: ManualQuestionType;
  questionCount: number;
  subsection: ManualSubsection;
  questionProfiles: QuestionTagProfile[];
};

type SelectedCandidate = {
  candidate: GenerationCandidate;
  rule: ManualPaperGenerationRule | null;
};

const MULTI_BLANK_BLOCK_TYPES = new Set<ManualQuestionType>(["passage-fill-blank", "passage-mcq"]);

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createGeneratedId(prefix: string, index: number) {
  return `${prefix}-${index + 1}-${Math.random().toString(36).slice(2, 8)}`;
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function hasQuestionTagFilters(rule: ManualPaperGenerationRule) {
  const filters = rule.filters;
  return Boolean(
    filters.track
      || (filters.entries && filters.entries.length > 0)
      || filters.unit
      || filters.examPart
      || (filters.abilities && filters.abilities.length > 0)
      || filters.grammarUnit
      || (filters.grammarPoints && filters.grammarPoints.length > 0)
      || (filters.difficulties && filters.difficulties.length > 0),
  );
}

function getQuestionProfiles(question: ManualQuestion) {
  const profiles: QuestionTagProfile[] = [];

  if (question.tags?.english) {
    profiles.push({
      kind: "english",
      ...question.tags.english,
      entries: question.tags.english.entries.map((entry) => normalizeEnglishTagEntry(entry)),
      ability: normalizeEnglishTagAbility(question.tags.english.ability),
      difficulty: normalizeEnglishTagDifficulty(question.tags.english.difficulty),
    });
  }

  if (question.tags?.math) {
    profiles.push({
      kind: "math",
      ...question.tags.math,
    });
  }

  if (question.tags?.vocabulary) {
    profiles.push({
      kind: "vocabulary",
      ...question.tags.vocabulary,
    });
  }

  return profiles;
}

function getCandidateProfiles(subsection: ManualSubsection) {
  return subsection.questions.flatMap((question) => getQuestionProfiles(question));
}

function isGeneratedBlueprint(blueprint: ManualPaperBlueprint) {
  return getBlueprintBuildMode(blueprint) === "generated";
}

function isFixedBlueprint(blueprint: ManualPaperBlueprint) {
  return getBlueprintBuildMode(blueprint) === "fixed";
}

function matchesQuestionTagProfile(
  profile: QuestionTagProfile,
  rule: ManualPaperGenerationRule,
) {
  const filters = rule.filters;
  if (filters.track && profile.track !== filters.track) return false;
  if (filters.unit && profile.unit !== filters.unit) return false;
  // Exam part is optional in question intake. If a question leaves it unset,
  // keep it eligible for framework-based assembly instead of excluding it.
  if (filters.examPart && profile.examPart && profile.examPart !== filters.examPart) return false;

  if (profile.kind === "english") {
    if (filters.entries && filters.entries.length > 0) {
      const normalizedEntries = filters.entries.map((entry) => normalizeEnglishTagEntry(entry));
      const overlaps = normalizedEntries.some((entry) => profile.entries.includes(entry));
      if (!overlaps) return false;
    }
    if (filters.abilities && filters.abilities.length > 0) {
      const normalizedAbilities = filters.abilities.map((ability) => normalizeEnglishTagAbility(ability));
      const normalizedProfileAbility = normalizeEnglishTagAbility(profile.ability);
      if (!normalizedAbilities.includes(normalizedProfileAbility)) return false;
    }
    if (filters.grammarUnit && profile.grammarUnit !== filters.grammarUnit) return false;
    if (filters.grammarPoints && filters.grammarPoints.length > 0) {
      const overlaps = filters.grammarPoints.some((point) => profile.grammarPoints?.includes(point));
      if (!overlaps) return false;
    }
    if (filters.difficulties && filters.difficulties.length > 0) {
      const normalizedDifficulties = filters.difficulties
        .map((difficulty) => normalizeEnglishTagDifficulty(difficulty))
        .filter((difficulty): difficulty is NonNullable<typeof difficulty> => Boolean(difficulty));
      const normalizedProfileDifficulty = profile.difficulty
        ? normalizeEnglishTagDifficulty(profile.difficulty)
        : undefined;
      if (!normalizedProfileDifficulty || !normalizedDifficulties.includes(normalizedProfileDifficulty)) return false;
    }
  } else if (
    filters.entries?.length
    || filters.abilities?.length
    || filters.grammarUnit
    || filters.grammarPoints?.length
    || filters.difficulties?.length
  ) {
    return false;
  }

  return true;
}

function matchesRule(candidate: GenerationCandidate, sectionType: ManualSectionType, rule: ManualPaperGenerationRule) {
  if (candidate.sectionType !== sectionType) return false;
  if (rule.filters.sectionTypes && rule.filters.sectionTypes.length > 0 && !rule.filters.sectionTypes.includes(candidate.sectionType)) {
    return false;
  }
  if (rule.filters.questionTypes && rule.filters.questionTypes.length > 0 && !rule.filters.questionTypes.includes(candidate.questionType)) {
    return false;
  }

  if (!hasQuestionTagFilters(rule)) {
    return true;
  }

  return candidate.questionProfiles.some((profile) => matchesQuestionTagProfile(profile, rule));
}

function buildGenerationCandidates(sourcePapers: GeneratorSourcePaper[]) {
  const candidates: GenerationCandidate[] = [];

  for (const sourcePaper of sourcePapers) {
    if (!isFixedBlueprint(sourcePaper.blueprint)) continue;

    for (const section of sourcePaper.blueprint.sections) {
      for (const subsection of section.subsections) {
        if (MULTI_BLANK_BLOCK_TYPES.has(subsection.questionType)) {
          const profiles = getCandidateProfiles(subsection);
          candidates.push({
            id: `${sourcePaper.paperId}:${section.id}:${subsection.id}`,
            sourcePaperId: sourcePaper.paperId,
            sourcePaperTitle: sourcePaper.title,
            sectionType: section.sectionType,
            questionType: subsection.questionType,
            questionCount: subsection.questions.length,
            subsection: cloneDeep(subsection),
            questionProfiles: profiles,
          });
          continue;
        }

        for (const question of subsection.questions) {
          candidates.push({
            id: `${sourcePaper.paperId}:${section.id}:${subsection.id}:${question.id}`,
            sourcePaperId: sourcePaper.paperId,
            sourcePaperTitle: sourcePaper.title,
            sectionType: section.sectionType,
            questionType: subsection.questionType,
            questionCount: 1,
            subsection: cloneDeep({
              ...subsection,
              questions: [question],
            }),
            questionProfiles: getQuestionProfiles(question),
          });
        }
      }
    }
  }

  return candidates;
}

function allocateRuleTargets(totalQuestions: number, rules: ManualPaperGenerationRule[]) {
  if (rules.length === 0) return [];
  const normalizedWeights = rules.map((rule) => Math.max(1, Math.round(rule.weight || 1)));
  const totalWeight = normalizedWeights.reduce((sum, value) => sum + value, 0);
  const baseTargets = normalizedWeights.map((weight) => Math.floor((totalQuestions * weight) / totalWeight));
  const assigned = baseTargets.reduce((sum, value) => sum + value, 0);
  let remainder = Math.max(0, totalQuestions - assigned);

  const fractionalOrder = normalizedWeights
    .map((weight, index) => ({
      index,
      remainder: (totalQuestions * weight) / totalWeight - baseTargets[index],
    }))
    .sort((left, right) => right.remainder - left.remainder);

  for (const item of fractionalOrder) {
    if (remainder <= 0) break;
    baseTargets[item.index] += 1;
    remainder -= 1;
  }

  return baseTargets;
}

function cloneCandidateSubsection(selected: SelectedCandidate, sectionIndex: number, subsectionIndex: number) {
  const subsection = cloneDeep(selected.candidate.subsection);
  subsection.id = createGeneratedId(`generated-subsection-${sectionIndex + 1}`, subsectionIndex);
  subsection.questions = subsection.questions.map((question, questionIndex) => ({
    ...question,
    id: createGeneratedId(`generated-question-${sectionIndex + 1}-${subsectionIndex + 1}`, questionIndex),
  }));
  if (!subsection.title?.trim()) {
    subsection.title = selected.rule?.label?.trim() || selected.candidate.sourcePaperTitle;
  }
  return subsection;
}

export function getBlueprintBuildMode(blueprint: ManualPaperBlueprint): ManualPaperBuildMode {
  return blueprint.buildMode === "generated" ? "generated" : "fixed";
}

export function getBlueprintVisibilityMode(blueprint: ManualPaperBlueprint): ManualPaperVisibilityMode {
  return blueprint.visibilityMode === "question-bank" ? "question-bank" : "student";
}

export function isQuestionBankOnlyBlueprint(blueprint: ManualPaperBlueprint) {
  return getBlueprintVisibilityMode(blueprint) === "question-bank";
}

export function getGenerationConfigQuestionCount(config: ManualPaperGenerationConfig | undefined) {
  return (config?.sections ?? []).reduce((sum, section) => sum + Math.max(0, section.totalQuestions || 0), 0);
}

export function generatePaperFromTaggedSources(
  templateBlueprint: ManualPaperBlueprint,
  sourcePapers: GeneratorSourcePaper[],
) {
  const warnings: string[] = [];
  if (!isGeneratedBlueprint(templateBlueprint)) {
    return {
      blueprint: templateBlueprint,
      warnings,
    };
  }

  const config = templateBlueprint.generationConfig;
  if (!config || config.sections.length === 0) {
    warnings.push("This generated paper has no section rules yet.");
    return {
      blueprint: {
        ...templateBlueprint,
        sections: [],
      },
      warnings,
    };
  }

  const eligibleSourcePapers = sourcePapers.filter((paper) => {
    if (paper.paperId === templateBlueprint.id) return false;
    if (config.sourcePaperIds && config.sourcePaperIds.length > 0) {
      return config.sourcePaperIds.includes(paper.paperId);
    }
    return true;
  });

  if (eligibleSourcePapers.length === 0) {
    warnings.push("No eligible source papers were found for this generated paper.");
  }

  const candidates = buildGenerationCandidates(eligibleSourcePapers);
  const usedCandidateIds = new Set<string>();
  const generatedSections: Array<ManualSection & { partLabel: string }> = [];

  config.sections.forEach((plan, sectionIndex) => {
    const sectionWarningsPrefix = plan.title?.trim() || `Part ${sectionIndex + 1}`;
    const selected: SelectedCandidate[] = [];
    const ruleTargets = allocateRuleTargets(plan.totalQuestions, plan.rules);
    let selectedQuestionCount = 0;

    plan.rules.forEach((rule, ruleIndex) => {
      const target = ruleTargets[ruleIndex] ?? 0;
      if (target <= 0) return;

      const available = shuffle(
        candidates.filter((candidate) => !usedCandidateIds.has(candidate.id) && matchesRule(candidate, plan.sectionType, rule)),
      );
      let covered = 0;

      while (available.length > 0 && covered < target) {
        const candidate = available.shift();
        if (!candidate) break;
        selected.push({ candidate, rule });
        usedCandidateIds.add(candidate.id);
        covered += candidate.questionCount;
        selectedQuestionCount += candidate.questionCount;
      }

      if (covered < target) {
        warnings.push(`${sectionWarningsPrefix}: rule "${rule.label}" needed ${target} question(s), but only ${covered} matched.`);
      }
    });

    if (selectedQuestionCount < plan.totalQuestions) {
      const fallbackPool = shuffle(
        candidates.filter((candidate) => !usedCandidateIds.has(candidate.id) && candidate.sectionType === plan.sectionType),
      );
      while (fallbackPool.length > 0 && selectedQuestionCount < plan.totalQuestions) {
        const candidate = fallbackPool.shift();
        if (!candidate) break;
        selected.push({ candidate, rule: null });
        usedCandidateIds.add(candidate.id);
        selectedQuestionCount += candidate.questionCount;
      }
    }

    if (selectedQuestionCount < plan.totalQuestions) {
      warnings.push(`${sectionWarningsPrefix}: only assembled ${selectedQuestionCount}/${plan.totalQuestions} question(s).`);
    }

    generatedSections.push({
      id: createGeneratedId(`generated-section`, sectionIndex),
      sectionType: plan.sectionType,
      partLabel: `Part ${sectionIndex + 1}`,
      subsections: selected.map((candidate, subsectionIndex) => {
        const subsection = cloneCandidateSubsection(candidate, sectionIndex, subsectionIndex);
        if (plan.instructions?.trim()) {
          subsection.instructions = plan.instructions.trim();
        }
        return subsection;
      }),
    });
  });

  return {
    blueprint: {
      ...templateBlueprint,
      sections: generatedSections,
    },
    warnings,
  };
}
