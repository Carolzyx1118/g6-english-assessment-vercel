const LATEST_RESULT_ID_STORAGE_KEY = "pureon_latest_assessment_result_id_v1";

export function readLatestSavedResultId() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(LATEST_RESULT_ID_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
}
