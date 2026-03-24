export type ResultSavePayload = {
  studentName: string;
  studentGrade?: string;
  paperId: string;
  paperTitle: string;
  totalCorrect: number;
  totalQuestions: number;
  totalTimeSeconds?: number;
  answersJson: string;
  scoreBySectionJson: string;
  sectionTimingsJson: string;
};

const PENDING_RESULT_SAVE_STORAGE_KEY = 'pureon_pending_result_save_v1';

export function readPendingResultSave(): ResultSavePayload | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(PENDING_RESULT_SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ResultSavePayload>;
    if (
      typeof parsed.studentName !== 'string'
      || typeof parsed.paperId !== 'string'
      || typeof parsed.paperTitle !== 'string'
      || typeof parsed.totalCorrect !== 'number'
      || typeof parsed.totalQuestions !== 'number'
      || typeof parsed.answersJson !== 'string'
      || typeof parsed.scoreBySectionJson !== 'string'
      || typeof parsed.sectionTimingsJson !== 'string'
    ) {
      return null;
    }

    return {
      studentName: parsed.studentName,
      studentGrade: typeof parsed.studentGrade === 'string' ? parsed.studentGrade : undefined,
      paperId: parsed.paperId,
      paperTitle: parsed.paperTitle,
      totalCorrect: parsed.totalCorrect,
      totalQuestions: parsed.totalQuestions,
      totalTimeSeconds: typeof parsed.totalTimeSeconds === 'number' ? parsed.totalTimeSeconds : undefined,
      answersJson: parsed.answersJson,
      scoreBySectionJson: parsed.scoreBySectionJson,
      sectionTimingsJson: parsed.sectionTimingsJson,
    };
  } catch {
    return null;
  }
}

export function writePendingResultSave(payload: ResultSavePayload) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PENDING_RESULT_SAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures.
  }
}

export function clearPendingResultSave() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(PENDING_RESULT_SAVE_STORAGE_KEY);
  } catch {
    // Ignore storage delete failures.
  }
}
