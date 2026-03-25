const LATEST_RESULT_ID_STORAGE_KEY = "pureon_latest_assessment_result_id_v1";

export function readLatestSavedResultId() {
  if (typeof window === "undefined") return null;

  try {
    const fromSession = window.sessionStorage.getItem(LATEST_RESULT_ID_STORAGE_KEY);
    const parsedSession = fromSession ? Number(fromSession) : NaN;
    if (Number.isFinite(parsedSession) && parsedSession > 0) {
      return parsedSession;
    }
  } catch {
    // Ignore storage failures in restricted browsers.
  }

  try {
    const fromLocal = window.localStorage.getItem(LATEST_RESULT_ID_STORAGE_KEY);
    const parsedLocal = fromLocal ? Number(fromLocal) : NaN;
    return Number.isFinite(parsedLocal) && parsedLocal > 0 ? parsedLocal : null;
  } catch {
    return null;
  }
}

export function writeLatestSavedResultId(resultId: number) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(LATEST_RESULT_ID_STORAGE_KEY, String(resultId));
  } catch {
    // Ignore storage failures in restricted browsers.
  }

  try {
    window.localStorage.setItem(LATEST_RESULT_ID_STORAGE_KEY, String(resultId));
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}
