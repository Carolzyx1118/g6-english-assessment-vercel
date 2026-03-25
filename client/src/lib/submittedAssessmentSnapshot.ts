import type { Paper } from "@/data/papers";

const SUBMITTED_ASSESSMENT_SNAPSHOT_KEY = "pureon_submitted_assessment_snapshot_v1";
const SUBMITTED_ASSESSMENT_SNAPSHOT_FALLBACK_KEY = "pureon_submitted_assessment_snapshot_persisted_v1";
let inMemorySubmittedAssessmentSnapshot: SubmittedAssessmentSnapshot | null = null;

export interface SubmittedAssessmentSnapshot {
  version: 1;
  paper: Paper;
  studentInfo: {
    name: string;
    grade: string;
  };
  answers: Record<string, unknown>;
  sectionTimings: Record<string, number>;
  startTime: number | null;
  endTime: number | null;
  submittedAt: number;
}

export function writeSubmittedAssessmentSnapshot(snapshot: Omit<SubmittedAssessmentSnapshot, "version">) {
  const payload: SubmittedAssessmentSnapshot = {
    version: 1,
    ...snapshot,
  };

  inMemorySubmittedAssessmentSnapshot = payload;

  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(payload);

  try {
    window.sessionStorage.setItem(SUBMITTED_ASSESSMENT_SNAPSHOT_KEY, serialized);
  } catch {
    // Ignore storage failures in restricted browsers.
  }

  try {
    window.localStorage.setItem(SUBMITTED_ASSESSMENT_SNAPSHOT_FALLBACK_KEY, serialized);
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

function parseSubmittedAssessmentSnapshot(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SubmittedAssessmentSnapshot>;
    if (parsed.version !== 1) return null;
    if (!parsed.paper || typeof parsed.paper !== "object") return null;
    if (!parsed.studentInfo || typeof parsed.studentInfo !== "object") return null;

    return {
      version: 1,
      paper: parsed.paper as Paper,
      studentInfo: {
        name: typeof parsed.studentInfo.name === "string" ? parsed.studentInfo.name : "",
        grade: typeof parsed.studentInfo.grade === "string" ? parsed.studentInfo.grade : "",
      },
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
      sectionTimings: parsed.sectionTimings && typeof parsed.sectionTimings === "object"
        ? Object.fromEntries(
            Object.entries(parsed.sectionTimings).map(([key, value]) => [
              key,
              typeof value === "number" && Number.isFinite(value) ? value : 0,
            ]),
          )
        : {},
      startTime: typeof parsed.startTime === "number" ? parsed.startTime : null,
      endTime: typeof parsed.endTime === "number" ? parsed.endTime : null,
      submittedAt: typeof parsed.submittedAt === "number" ? parsed.submittedAt : Date.now(),
    } satisfies SubmittedAssessmentSnapshot;
  } catch {
    return null;
  }
}

export function readSubmittedAssessmentSnapshot() {
  if (inMemorySubmittedAssessmentSnapshot) {
    return inMemorySubmittedAssessmentSnapshot;
  }

  if (typeof window === "undefined") return null;

  try {
    const fromSession = parseSubmittedAssessmentSnapshot(
      window.sessionStorage.getItem(SUBMITTED_ASSESSMENT_SNAPSHOT_KEY),
    );
    if (fromSession) {
      inMemorySubmittedAssessmentSnapshot = fromSession;
      return fromSession;
    }

    const fromLocal = parseSubmittedAssessmentSnapshot(
      window.localStorage.getItem(SUBMITTED_ASSESSMENT_SNAPSHOT_FALLBACK_KEY),
    );
    if (!fromLocal) return null;

    try {
      window.sessionStorage.setItem(
        SUBMITTED_ASSESSMENT_SNAPSHOT_KEY,
        JSON.stringify(fromLocal),
      );
    } catch {
      // Ignore storage failures in restricted browsers.
    }

    const snapshot = fromLocal;
    inMemorySubmittedAssessmentSnapshot = snapshot;
    return snapshot;
  } catch {
    return null;
  }
}

export function clearSubmittedAssessmentSnapshot() {
  inMemorySubmittedAssessmentSnapshot = null;

  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(SUBMITTED_ASSESSMENT_SNAPSHOT_KEY);
  } catch {
    // Ignore storage failures in restricted browsers.
  }

  try {
    window.localStorage.removeItem(SUBMITTED_ASSESSMENT_SNAPSHOT_FALLBACK_KEY);
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}
