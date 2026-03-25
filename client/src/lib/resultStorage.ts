import type { AssessmentReportResult } from '@shared/assessmentReport';
import {
  packStoredAssessmentPayload,
  parseStoredAssessmentPayload,
} from './storedAssessmentPayload';

const EMBEDDED_AUDIO_PREFIX = 'data:audio/';

function isEmbeddedAudioDataUrl(value: string) {
  return value.trim().toLowerCase().startsWith(EMBEDDED_AUDIO_PREFIX);
}

function sanitizeValueForStorage(value: unknown): unknown {
  if (typeof value === 'string') {
    return isEmbeddedAudioDataUrl(value) ? '' : value;
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

export function packStoredAssessmentPayloadForResultStorage(
  answers: Record<string, unknown>,
  paperSnapshot?: unknown,
) {
  return packStoredAssessmentPayload(
    sanitizeValueForStorage(answers) as Record<string, unknown>,
    paperSnapshot,
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
        audioUrl: isEmbeddedAudioDataUrl(item.audioUrl) ? '' : item.audioUrl,
      })),
    },
  };
}
