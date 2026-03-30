import { PAPER_SUBJECT_ORDER, type PaperSubject } from "@/data/papers";
import {
  buildAssessmentReviewModel,
  type AssessmentReviewRecord,
  type QuestionReviewDetail,
  type ReviewSectionKind,
} from "@/lib/assessmentReview";

export type MistakeNotebookItem = {
  key: string;
  paperId: string;
  paperTitle: string;
  paperSubject: PaperSubject | null;
  latestRecordId: number | null;
  latestSeenAt: string;
  mistakeCount: number;
  sectionId: string;
  sectionTitle: string;
  sectionKind: ReviewSectionKind;
  questionId: string;
  questionNum: string;
  questionType: QuestionReviewDetail["questionType"];
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  explanationEn?: string;
  explanationCn?: string;
  tipEn?: string;
  tipCn?: string;
  context?: string;
};

function inferSubjectFromPaperId(paperId: string): PaperSubject | null {
  const normalized = paperId.trim().toLowerCase();
  const matched = PAPER_SUBJECT_ORDER.find((subject) => normalized.includes(subject));
  return matched ?? null;
}

function toTimestamp(value: string | Date | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function buildMistakeNotebook(records: AssessmentReviewRecord[]) {
  const sortedRecords = [...records].sort((left, right) => (
    toTimestamp(right.createdAt) - toTimestamp(left.createdAt)
  ));
  const notebook = new Map<string, MistakeNotebookItem>();

  for (const record of sortedRecords) {
    const model = buildAssessmentReviewModel(record);
    const paperId = model.paper?.id || record.paperId;
    const paperTitle = model.paper?.title || record.paperTitle;
    const paperSubject = model.paper?.subject || inferSubjectFromPaperId(record.paperId);
    const latestSeenAt = new Date(record.createdAt).toISOString();

    for (const section of model.sections) {
      if (section.kind === "writing" || section.kind === "speaking") {
        continue;
      }

      for (const detail of section.details) {
        if (!detail.isAnswered || detail.isCorrect) {
          continue;
        }

        const key = `${paperId}::${detail.id}`;
        const existing = notebook.get(key);

        if (existing) {
          existing.mistakeCount += 1;
          continue;
        }

        notebook.set(key, {
          key,
          paperId,
          paperTitle,
          paperSubject,
          latestRecordId: record.id ?? null,
          latestSeenAt,
          mistakeCount: 1,
          sectionId: detail.sectionId,
          sectionTitle: detail.sectionTitle,
          sectionKind: detail.sectionKind,
          questionId: detail.id,
          questionNum: detail.questionNum,
          questionType: detail.questionType,
          questionText: detail.questionText,
          userAnswer: detail.userAnswer,
          correctAnswer: detail.correctAnswer,
          explanationEn: detail.explanationEn,
          explanationCn: detail.explanationCn,
          tipEn: detail.tipEn,
          tipCn: detail.tipCn,
          context: detail.context,
        });
      }
    }
  }

  return Array.from(notebook.values()).sort((left, right) => (
    toTimestamp(right.latestSeenAt) - toTimestamp(left.latestSeenAt)
  ));
}
