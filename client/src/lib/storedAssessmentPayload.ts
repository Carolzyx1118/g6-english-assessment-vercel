export interface StoredAssessmentPayloadV2 {
  __format: "assessment_payload_v2";
  answers: Record<string, unknown>;
  paperSnapshot?: unknown;
}

export function packStoredAssessmentPayload(
  answers: Record<string, unknown>,
  paperSnapshot?: unknown,
) {
  if (!paperSnapshot) {
    return JSON.stringify(answers);
  }

  const payload: StoredAssessmentPayloadV2 = {
    __format: "assessment_payload_v2",
    answers,
    paperSnapshot,
  };
  return JSON.stringify(payload);
}

export function parseStoredAssessmentPayload(raw: string | null | undefined) {
  if (!raw) {
    return {
      answers: {} as Record<string, unknown>,
      paperSnapshot: undefined as unknown,
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed
      && typeof parsed === "object"
      && (parsed as StoredAssessmentPayloadV2).__format === "assessment_payload_v2"
    ) {
      const payload = parsed as StoredAssessmentPayloadV2;
      return {
        answers: payload.answers ?? {},
        paperSnapshot: payload.paperSnapshot,
      };
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        answers: parsed as Record<string, unknown>,
        paperSnapshot: undefined as unknown,
      };
    }
  } catch {
    // Ignore invalid JSON and return empty defaults.
  }

  return {
    answers: {} as Record<string, unknown>,
    paperSnapshot: undefined as unknown,
  };
}
