export interface StoredAssessmentOwner {
  username?: string;
  displayName?: string;
}

export interface StoredAssessmentPayloadV2 {
  __format: "assessment_payload_v2";
  answers: Record<string, unknown>;
  paperSnapshot?: unknown;
  owner?: StoredAssessmentOwner;
}

export function packStoredAssessmentPayload(
  answers: Record<string, unknown>,
  paperSnapshot?: unknown,
  owner?: StoredAssessmentOwner,
) {
  const normalizedOwner = owner && typeof owner === "object"
    ? {
        username: typeof owner.username === "string" ? owner.username.trim() : "",
        displayName: typeof owner.displayName === "string" ? owner.displayName.trim() : "",
      }
    : null;
  const hasOwner = Boolean(normalizedOwner?.username || normalizedOwner?.displayName);

  if (!paperSnapshot && !hasOwner) {
    return JSON.stringify(answers);
  }

  const payload: StoredAssessmentPayloadV2 = {
    __format: "assessment_payload_v2",
    answers,
    paperSnapshot,
    owner: hasOwner
      ? {
          username: normalizedOwner?.username || undefined,
          displayName: normalizedOwner?.displayName || undefined,
        }
      : undefined,
  };
  return JSON.stringify(payload);
}

export function parseStoredAssessmentPayload(raw: string | null | undefined) {
  if (!raw) {
    return {
      answers: {} as Record<string, unknown>,
      paperSnapshot: undefined as unknown,
      owner: undefined as StoredAssessmentOwner | undefined,
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
        owner: payload.owner,
      };
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        answers: parsed as Record<string, unknown>,
        paperSnapshot: undefined as unknown,
        owner: undefined as StoredAssessmentOwner | undefined,
      };
    }
  } catch {
    // Ignore invalid JSON and return empty defaults.
  }

  return {
    answers: {} as Record<string, unknown>,
    paperSnapshot: undefined as unknown,
    owner: undefined as StoredAssessmentOwner | undefined,
  };
}
