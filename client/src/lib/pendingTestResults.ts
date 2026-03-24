export interface PendingTestResultPayload {
  studentName: string;
  studentGrade?: string;
  paperId: string;
  paperTitle: string;
  totalCorrect: number;
  totalQuestions: number;
  totalTimeSeconds?: number;
  answersJson: string;
  scoreBySectionJson?: string;
  sectionTimingsJson?: string;
}

export interface PendingTestResultEntry {
  id: string;
  createdAt: number;
  payload: PendingTestResultPayload;
}

const STORAGE_KEY = 'pureon_pending_test_results_v1';

function hasWindow() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function buildPendingEntryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readPendingTestResults(): PendingTestResultEntry[] {
  if (!hasWindow()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is PendingTestResultEntry => {
      return Boolean(
        entry
        && typeof entry === 'object'
        && typeof (entry as PendingTestResultEntry).id === 'string'
        && typeof (entry as PendingTestResultEntry).createdAt === 'number'
        && (entry as PendingTestResultEntry).payload
        && typeof (entry as PendingTestResultEntry).payload === 'object',
      );
    });
  } catch {
    return [];
  }
}

function writePendingTestResults(entries: PendingTestResultEntry[]) {
  if (!hasWindow()) return;

  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage write failures in restricted browsers.
  }
}

export function queuePendingTestResult(payload: PendingTestResultPayload) {
  const entries = readPendingTestResults();
  const entry: PendingTestResultEntry = {
    id: buildPendingEntryId(),
    createdAt: Date.now(),
    payload,
  };
  writePendingTestResults([...entries, entry]);
  return entry.id;
}

export function removePendingTestResult(id: string) {
  const entries = readPendingTestResults();
  writePendingTestResults(entries.filter((entry) => entry.id !== id));
}
