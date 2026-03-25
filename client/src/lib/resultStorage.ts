import type { AssessmentReportResult } from '@shared/assessmentReport';
import { getPaperById, type Paper, type Question, type Section } from '@/data/papers';
import {
  packStoredAssessmentPayload,
  parseStoredAssessmentPayload,
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
      });
    case 'word-completion':
      return sanitizeValueForStorage({
        id: question.id,
        type: question.type,
        question: question.question,
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
      });
  }
}

function compactSectionForStorage(section: Section) {
  return sanitizeValueForStorage({
    id: section.id,
    title: section.title,
    sectionType: section.sectionType,
    passage: section.passage,
    wordBank: section.wordBank,
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
) {
  return packStoredAssessmentPayload(
    sanitizeValueForStorage(answers) as Record<string, unknown>,
    compactPaperSnapshotForResultStorage(paperSnapshot),
  );
}

export function sanitizeStoredAssessmentPayloadJsonForResultStorage(raw: string) {
  const parsed = parseStoredAssessmentPayload(raw);
  return packStoredAssessmentPayloadForResultStorage(
    parsed.answers,
    parsed.paperSnapshot,
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
