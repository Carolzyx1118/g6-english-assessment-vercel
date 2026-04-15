import {
  PAPER_SUBJECT_LABELS,
  type ManualQuestionBlock,
  type Paper,
  type PaperSubject,
  type Question,
  type Section,
} from "@/data/papers";
import {
  MANUAL_QUESTION_TYPE_LABELS,
  type ManualPaperBlueprint,
  type ManualQuestionTags,
  type ManualQuestionType,
  type ManualSectionType,
} from "@shared/manualPaperBlueprint";
import { blueprintToPaper } from "@shared/blueprintToPaper";
import {
  normalizeEnglishQuestionTagProfile,
  normalizeEnglishTagDifficulty,
  type EnglishQuestionTagProfile,
  type SubjectQuestionTagProfile,
} from "@shared/englishQuestionTags";

type RuntimeQuestion = Question & {
  blankOptions?: Array<{ label: string; text: string }>;
};

type QuestionBankPaperSource = {
  paperId: string;
  title: string;
  subject: string;
  blueprintJson: string;
};

type PracticeQuestionTagProfile = EnglishQuestionTagProfile | SubjectQuestionTagProfile;

export interface PracticeQuestionCandidate {
  id: string;
  subject: PaperSubject;
  sourcePaperId: string;
  sourcePaperTitle: string;
  sourcePaperDescription: string;
  sourceSectionTitle: string;
  sourceSectionType: ManualSectionType;
  sourceQuestionType: ManualQuestionType;
  runtimeSection: Section;
  runtimeQuestion: RuntimeQuestion;
  runtimeBlock: ManualQuestionBlock | null;
  track: string;
  entries: string[];
  unit?: string;
  examPart?: string;
  ability?: string;
  difficulty?: string;
  grammarPoints: string[];
  knowledgeTags: string[];
}

export interface PracticeFilters {
  subject: PaperSubject | "all";
  track: string | "all";
  questionType: ManualQuestionType | "all";
  difficulty: string | "all";
  knowledgeTags: string[];
}

const PRACTICE_SUPPORTED_RUNTIME_TYPES = new Set<Question["type"]>([
  "mcq",
  "picture-mcq",
  "listening-mcq",
  "fill-blank",
  "open-ended",
  "writing",
  "picture-spelling",
  "word-completion",
  "wordbank-fill",
  "story-fill",
  "true-false",
  "checkbox",
  "order",
  "sentence-reorder",
  "inline-word-choice",
  "passage-inline-word-choice",
]);

const QUESTION_TYPE_LABEL_OVERRIDES: Partial<Record<ManualQuestionType, string>> = {
  "typed-fill-blank": "Fill in Blank",
  "passage-matching": "Passage Matching",
  ordering: "Ordering",
};

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toPaperSubject(value: string): PaperSubject | null {
  if (value === "english" || value === "math" || value === "vocabulary") {
    return value;
  }
  return null;
}

function getQuestionTypeLabel(questionType: ManualQuestionType) {
  return QUESTION_TYPE_LABEL_OVERRIDES[questionType] || MANUAL_QUESTION_TYPE_LABELS[questionType] || questionType;
}

function getQuestionPrompt(question: Question) {
  if ("topic" in question && typeof question.topic === "string" && question.topic.trim()) {
    return question.topic.trim();
  }
  if ("question" in question && typeof question.question === "string" && question.question.trim()) {
    return question.question.trim();
  }
  return "Question";
}

function isPracticeCompatibleQuestion(question: Question) {
  if (!PRACTICE_SUPPORTED_RUNTIME_TYPES.has(question.type)) {
    return false;
  }

  if (question.type === "open-ended" && question.responseMode === "audio") {
    return false;
  }

  return true;
}

function normalizeTagProfile(
  subject: PaperSubject,
  tags: ManualQuestionTags | undefined,
): PracticeQuestionTagProfile | null {
  if (!tags) return null;

  if (subject === "english" && tags.english) {
    return normalizeEnglishQuestionTagProfile(tags.english);
  }

  if (subject === "math" && tags.math) {
    return tags.math;
  }

  if (subject === "vocabulary" && tags.vocabulary) {
    return tags.vocabulary;
  }

  return null;
}

function buildKnowledgeTags(
  subject: PaperSubject,
  profile: PracticeQuestionTagProfile | null,
) {
  if (!profile) return [];

  const tags = new Set<string>();
  if (profile.unit) tags.add(profile.unit);
  if (profile.examPart) tags.add(profile.examPart);

  if (subject === "english") {
    const englishProfile = profile as EnglishQuestionTagProfile;
    if (englishProfile.ability) tags.add(englishProfile.ability);
    (englishProfile.grammarPoints ?? []).forEach((point) => {
      if (point.trim()) tags.add(point.trim());
    });
  }

  return Array.from(tags);
}

function buildPracticeSectionFromCandidate(
  candidate: PracticeQuestionCandidate,
  questionNumber: number,
): Section {
  const question = cloneDeep(candidate.runtimeQuestion);
  const baseSection = cloneDeep(candidate.runtimeSection);
  const block = candidate.runtimeBlock ? cloneDeep(candidate.runtimeBlock) : null;

  return {
    ...baseSection,
    id: `practice-section-${questionNumber}`,
    title: `Q${questionNumber}`,
    subtitle: `${candidate.sourceSectionTitle} · ${candidate.sourcePaperTitle}`,
    description: block?.instructions || candidate.sourcePaperDescription || baseSection.description,
    taskDescription: block?.taskDescription || baseSection.taskDescription,
    questions: [question],
    passage: block?.passage || baseSection.passage,
    wordBank: block?.wordBank || baseSection.wordBank,
    grammarPassage: block?.grammarPassage || baseSection.grammarPassage,
    audioUrl: block?.audioUrl || baseSection.audioUrl,
    sceneImageUrl: block?.sceneImageUrl || baseSection.sceneImageUrl,
    inlineCloze: block?.inlineCloze || baseSection.inlineCloze,
    matchingDescriptions: block?.matchingDescriptions || baseSection.matchingDescriptions,
    manualBlocks: [
      {
        id: block?.id || `practice-block-${questionNumber}`,
        displayNumber: 1,
        questionType: candidate.sourceQuestionType,
        instructions: block?.instructions,
        taskDescription: block?.taskDescription,
        questionIds: [question.id],
        passage: block?.passage,
        wordBank: block?.wordBank,
        grammarPassage: block?.grammarPassage,
        audioUrl: block?.audioUrl,
        sceneImageUrl: block?.sceneImageUrl,
        inlineCloze: block?.inlineCloze,
        matchingDescriptions: block?.matchingDescriptions,
      },
    ],
  };
}

function buildPracticePaperTitle(subject: PaperSubject, count: number) {
  return `${PAPER_SUBJECT_LABELS[subject]} Practice Session · ${count}Q`;
}

export function buildPracticeQuestionCandidates(
  questionBankPapers: QuestionBankPaperSource[],
  allowedSubjects: PaperSubject[],
) {
  const candidates: PracticeQuestionCandidate[] = [];

  for (const source of questionBankPapers) {
    const subject = toPaperSubject(source.subject);
    if (!subject || !allowedSubjects.includes(subject)) {
      continue;
    }

    let blueprint: ManualPaperBlueprint;
    try {
      blueprint = JSON.parse(source.blueprintJson) as ManualPaperBlueprint;
    } catch {
      continue;
    }

    const runtimePaper = blueprintToPaper(blueprint, {
      subject,
      category: "practice",
    }) as Paper;

    runtimePaper.sections.forEach((runtimeSection, sectionIndex) => {
      const sourceSection = blueprint.sections[sectionIndex];
      if (!sourceSection) return;

      sourceSection.subsections.forEach((subsection, subsectionIndex) => {
        const runtimeBlock = runtimeSection.manualBlocks?.[subsectionIndex] || null;
        const questionIds = runtimeBlock?.questionIds || [];

        subsection.questions.forEach((manualQuestion, questionIndex) => {
          const runtimeQuestionId = questionIds[questionIndex];
          const runtimeQuestion = runtimeSection.questions.find((question) => question.id === runtimeQuestionId);
          if (!runtimeQuestion || !isPracticeCompatibleQuestion(runtimeQuestion)) {
            return;
          }

          const profile = normalizeTagProfile(
            subject,
            manualQuestion.tags || subsection.sharedQuestionTags,
          );
          const knowledgeTags = buildKnowledgeTags(subject, profile);
          const entries = subject === "english" && profile && "entries" in profile
            ? Array.from(new Set((profile.entries ?? []).filter(Boolean)))
            : [];

          candidates.push({
            id: `${source.paperId}:${sourceSection.id}:${subsection.id}:${manualQuestion.id}`,
            subject,
            sourcePaperId: source.paperId,
            sourcePaperTitle: source.title,
            sourcePaperDescription: blueprint.description || "",
            sourceSectionTitle: runtimeSection.title,
            sourceSectionType: sourceSection.sectionType,
            sourceQuestionType: subsection.questionType,
            runtimeSection: cloneDeep(runtimeSection),
            runtimeQuestion: cloneDeep(runtimeQuestion as RuntimeQuestion),
            runtimeBlock: runtimeBlock ? cloneDeep(runtimeBlock) : null,
            track: profile?.track || "General",
            entries,
            unit: profile?.unit,
            examPart: profile?.examPart,
            ability: subject === "english" && profile && "ability" in profile ? profile.ability : undefined,
            difficulty: subject === "english" && profile && "difficulty" in profile
              ? normalizeEnglishTagDifficulty(profile.difficulty) || undefined
              : undefined,
            grammarPoints: subject === "english" && profile && "grammarPoints" in profile
              ? [...(profile.grammarPoints ?? [])]
              : [],
            knowledgeTags,
          });
        });
      });
    });
  }

  return candidates.sort((left, right) => {
    if (left.subject !== right.subject) {
      return left.subject.localeCompare(right.subject);
    }
    if (left.track !== right.track) {
      return left.track.localeCompare(right.track);
    }
    if (left.sourcePaperTitle !== right.sourcePaperTitle) {
      return left.sourcePaperTitle.localeCompare(right.sourcePaperTitle);
    }
    return getQuestionPrompt(left.runtimeQuestion).localeCompare(getQuestionPrompt(right.runtimeQuestion));
  });
}

export function getPracticeTrackOptions(candidates: PracticeQuestionCandidate[]) {
  return Array.from(new Set(candidates.map((candidate) => candidate.track).filter(Boolean))).sort();
}

export function getPracticeQuestionTypeOptions(candidates: PracticeQuestionCandidate[]) {
  return Array.from(new Set(candidates.map((candidate) => candidate.sourceQuestionType))).sort((left, right) => (
    getQuestionTypeLabel(left).localeCompare(getQuestionTypeLabel(right))
  ));
}

export function getPracticeDifficultyOptions(candidates: PracticeQuestionCandidate[]) {
  return Array.from(new Set(candidates.map((candidate) => candidate.difficulty).filter(Boolean) as string[])).sort();
}

export function getPracticeKnowledgeTagOptions(candidates: PracticeQuestionCandidate[]) {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    candidate.knowledgeTags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([tag]) => tag);
}

export function filterPracticeQuestionCandidates(
  candidates: PracticeQuestionCandidate[],
  filters: PracticeFilters,
) {
  return candidates.filter((candidate) => {
    if (filters.subject !== "all" && candidate.subject !== filters.subject) {
      return false;
    }
    if (filters.track !== "all" && candidate.track !== filters.track) {
      return false;
    }
    if (filters.questionType !== "all" && candidate.sourceQuestionType !== filters.questionType) {
      return false;
    }
    if (filters.difficulty !== "all" && candidate.difficulty !== filters.difficulty) {
      return false;
    }
    if (filters.knowledgeTags.length > 0) {
      return filters.knowledgeTags.every((tag) => candidate.knowledgeTags.includes(tag));
    }
    return true;
  });
}

export function getPracticeQuestionTypeLabel(questionType: ManualQuestionType) {
  return getQuestionTypeLabel(questionType);
}

export function buildPracticePaperFromCandidates(
  selectedCandidates: PracticeQuestionCandidate[],
  ownerSubject?: PaperSubject,
): Paper | null {
  if (selectedCandidates.length === 0) {
    return null;
  }

  const subject = ownerSubject || selectedCandidates[0].subject;
  const sections = selectedCandidates.map((candidate, index) => buildPracticeSectionFromCandidate(candidate, index + 1));
  const title = buildPracticePaperTitle(subject, selectedCandidates.length);
  const knowledgeTags = Array.from(new Set(selectedCandidates.flatMap((candidate) => candidate.knowledgeTags))).slice(0, 6);

  return {
    id: `student-practice-${subject}-${Date.now()}`,
    title,
    subtitle: `${selectedCandidates.length} questions · Instant feedback`,
    description: "Practice mode reveals the answer and explanation after each completed question and saves mistakes to your mistake book when the session is submitted.",
    icon: "📚",
    color: "text-[var(--pureon-teal)]",
    subject,
    category: "practice",
    tags: knowledgeTags,
    isGeneratedPaper: true,
    isEphemeralPaper: true,
    instantFeedbackMode: true,
    configuredSectionsCount: sections.length,
    configuredQuestionsCount: sections.length,
    sections,
    totalQuestions: sections.length,
    hasListening: sections.some((section) => Boolean(section.audioUrl)),
    hasWriting: sections.some((section) => section.questions.some((question) => question.type === "writing")),
  };
}

export function estimatePracticeDurationMinutes(questionCount: number) {
  return Math.max(5, Math.round(questionCount * 1.2));
}

export function getPracticeQuestionPreviewText(candidate: PracticeQuestionCandidate) {
  const prompt = getQuestionPrompt(candidate.runtimeQuestion);
  return prompt.length > 160 ? `${prompt.slice(0, 157)}...` : prompt;
}
