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

function normalizeOptionalString(value: string | undefined) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function arePendingPayloadsEqual(
  left: PendingTestResultPayload,
  right: PendingTestResultPayload,
) {
  return left.studentName === right.studentName
    && normalizeOptionalString(left.studentGrade) === normalizeOptionalString(right.studentGrade)
    && left.paperId === right.paperId
    && left.paperTitle === right.paperTitle
    && left.totalCorrect === right.totalCorrect
    && left.totalQuestions === right.totalQuestions
    && left.totalTimeSeconds === right.totalTimeSeconds
    && left.answersJson === right.answersJson
    && normalizeOptionalString(left.scoreBySectionJson) === normalizeOptionalString(right.scoreBySectionJson)
    && normalizeOptionalString(left.sectionTimingsJson) === normalizeOptionalString(right.sectionTimingsJson);
}

export function queuePendingTestResult(payload: PendingTestResultPayload) {
  const entries = readPendingTestResults();
  const existing = entries.find((entry) => arePendingPayloadsEqual(entry.payload, payload));
  if (existing) {
    return existing.id;
  }

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

export function removeMatchingPendingTestResults(payload: PendingTestResultPayload) {
  const entries = readPendingTestResults();
  writePendingTestResults(entries.filter((entry) => !arePendingPayloadsEqual(entry.payload, payload)));
}
