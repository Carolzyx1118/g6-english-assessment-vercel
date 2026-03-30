import type { AssessmentReportResult } from '@shared/assessmentReport';
import { getPaperById, type ManualQuestionBlock, type Paper, type Question, type Section } from '@/data/papers';
import {
  packStoredAssessmentPayload,
  parseStoredAssessmentPayload,
  type StoredAssessmentOwner,
} from './storedAssessmentPayload';

const EMBEDDED_DATA_URL_PREFIX = 'data:';

function isEmbeddedDataUrl(value: string) {
  return value.trim().toLowerCase().startsWith(EMBEDDED_DATA_URL_PREFIX);
}

function sanitizeValueForStorage(value: unknown): unknown {
  if (typeof value === 'string') {
    return isEmbeddedDataUrl(value) ? '' : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValueForStorage(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        sanitizeValueForStorage(nestedValue),
      ]),
    );
  }

  return value;
}

function compactQuestionForStorage(question: Question) {
  switch (question.type) {
    case 'mcq':
      return sanitizeValueForStorage({
        id: question.id,
        type: question.type,
        question: question.question,
        highlightWord: question.highlightWord,
        options: question.options,
        correctAnswer: question.correctAnswer,
        correctAnswers: question.correctAnswers,
        selectionLimit: question.selectionLimit,
        imageUrl: question.imageUrl,
      });
    case 'picture-mcq':
    case 'listening-mcq':
      return sanitizeValueForStorage({
        id: question.id,
        type: question.type,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        correctAnswers: question.correctAnswers,
        selectionLimit: question.selectionLimit,
      });
    case 'fill-blank':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        correctAnswer: question.correctAnswer,
      };
    case 'picture-spelling':
      return sanitizeValueForStorage({
        id: question.id,
        type: question.type,
        question: question.question,
        correctAnswer: question.correctAnswer,
        imageUrl: question.imageUrl,
      });
    case 'word-completion':
      return sanitizeValueForStorage({
        id: question.id,
        type: question.type,
        question: question.question,
        imageUrl: question.imageUrl,
        wordPattern: question.wordPattern,
        correctAnswer: question.correctAnswer,
      });
    case 'wordbank-fill':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        correctAnswer: question.correctAnswer,
      };
    case 'story-fill':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        correctAnswer: question.correctAnswer,
        acceptableAnswers: question.acceptableAnswers,
      };
    case 'open-ended':
      return sanitizeValueForStorage({
        id: question.id,
        type: question.type,
        question: question.question,
        subQuestions: question.subQuestions,
        answer: question.answer,
        correctAnswer: question.correctAnswer,
        imageUrl: question.imageUrl,
        responseMode: question.responseMode,
      });
    case 'true-false':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        statements: question.statements,
      };
    case 'table':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        rows: question.rows,
      };
    case 'reference':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        items: question.items,
      };
    case 'order':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        events: question.events,
        correctOrder: question.correctOrder,
      };
    case 'phrase':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        items: question.items,
      };
    case 'sentence-reorder':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        items: question.items,
      };
    case 'inline-word-choice':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        items: question.items,
      };
    case 'passage-inline-word-choice':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        passageText: question.passageText,
        items: question.items,
      };
    case 'checkbox':
      return {
        id: question.id,
        type: question.type,
        question: question.question,
        options: question.options,
        correctAnswers: question.correctAnswers,
        selectionLimit: question.selectionLimit,
      };
    case 'writing':
      return sanitizeValueForStorage({
        id: question.id,
        type: question.type,
        topic: question.topic,
        instructions: question.instructions,
        wordCount: question.wordCount,
        prompts: question.prompts,
        imageUrl: question.imageUrl,
        minWords: question.minWords,
        maxWords: question.maxWords,
        referenceAnswer: question.referenceAnswer,
      });
  }
}

function compactManualBlockForStorage(block: ManualQuestionBlock) {
  return sanitizeValueForStorage({
    id: block.id,
    displayNumber: block.displayNumber,
    questionType: block.questionType,
    instructions: block.instructions,
    taskDescription: block.taskDescription,
    questionIds: block.questionIds,
    passage: block.passage,
    wordBank: block.wordBank,
    grammarPassage: block.grammarPassage,
    audioUrl: block.audioUrl,
    sceneImageUrl: block.sceneImageUrl,
    inlineCloze: block.inlineCloze,
    matchingDescriptions: block.matchingDescriptions,
  });
}

function compactSectionForStorage(section: Section) {
  return sanitizeValueForStorage({
    id: section.id,
    title: section.title,
    subtitle: section.subtitle,
    description: section.description,
    taskDescription: section.taskDescription,
    sectionType: section.sectionType,
    passage: section.passage,
    grammarPassage: section.grammarPassage,
    imageUrl: section.imageUrl,
    audioUrl: section.audioUrl,
    sceneImageUrl: section.sceneImageUrl,
    inlineCloze: section.inlineCloze,
    matchingDescriptions: section.matchingDescriptions,
    wordBank: section.wordBank,
    manualBlocks: section.manualBlocks?.map((block) => compactManualBlockForStorage(block)),
    questions: section.questions.map((question) => compactQuestionForStorage(question)),
  });
}

function compactPaperSnapshotForResultStorage(paperSnapshot?: unknown) {
  if (!paperSnapshot || typeof paperSnapshot !== 'object' || Array.isArray(paperSnapshot)) {
    return undefined;
  }

  const snapshot = paperSnapshot as Partial<Paper>;
  const snapshotId = typeof snapshot.id === 'string' ? snapshot.id.trim() : '';
  if (snapshotId && getPaperById(snapshotId)) {
    return undefined;
  }

  if (!Array.isArray(snapshot.sections)) {
    return sanitizeValueForStorage({
      id: snapshotId || undefined,
      title: typeof snapshot.title === 'string' ? snapshot.title : undefined,
      subject: typeof snapshot.subject === 'string' ? snapshot.subject : undefined,
    });
  }

  return sanitizeValueForStorage({
    id: snapshotId || undefined,
    title: typeof snapshot.title === 'string' ? snapshot.title : undefined,
    subject: typeof snapshot.subject === 'string' ? snapshot.subject : undefined,
    sections: snapshot.sections.map((section) => compactSectionForStorage(section as Section)),
  });
}

export function packStoredAssessmentPayloadForResultStorage(
  answers: Record<string, unknown>,
  paperSnapshot?: unknown,
  owner?: StoredAssessmentOwner,
) {
  return packStoredAssessmentPayload(
    sanitizeValueForStorage(answers) as Record<string, unknown>,
    compactPaperSnapshotForResultStorage(paperSnapshot),
    owner,
  );
}

export function sanitizeStoredAssessmentPayloadJsonForResultStorage(raw: string) {
  const parsed = parseStoredAssessmentPayload(raw);
  return packStoredAssessmentPayloadForResultStorage(
    parsed.answers,
    parsed.paperSnapshot,
    parsed.owner,
  );
}

export function sanitizeReportForStorage(
  report: AssessmentReportResult,
): AssessmentReportResult {
  if (!report.speakingEvaluation) {
    return report;
  }

  return {
    ...report,
    speakingEvaluation: {
      ...report.speakingEvaluation,
      evaluations: report.speakingEvaluation.evaluations.map((item) => ({
        ...item,
        audioUrl: isEmbeddedDataUrl(item.audioUrl) ? '' : item.audioUrl,
      })),
    },
  };
}
