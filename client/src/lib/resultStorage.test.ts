import { describe, expect, it } from 'vitest';
import { parseStoredAssessmentPayload } from './storedAssessmentPayload';
import {
  packStoredAssessmentPayloadForResultStorage,
  sanitizeReportForStorage,
  sanitizeStoredAssessmentPayloadJsonForResultStorage,
} from './resultStorage';

describe('resultStorage', () => {
  it('removes embedded audio data URLs before packing stored assessment results', () => {
    const packed = packStoredAssessmentPayloadForResultStorage({
      'speaking:1': 'data:audio/webm;base64,AAAA',
      'reading:1': 'exercise',
      nested: {
        clip: 'data:audio/mp3;base64,BBBB',
      },
    });

    const parsed = parseStoredAssessmentPayload(packed);
    expect(parsed.answers).toEqual({
      'speaking:1': '',
      'reading:1': 'exercise',
      nested: {
        clip: '',
      },
    });
  });

  it('removes embedded speaking audio URLs from report storage payloads', () => {
    const sanitized = sanitizeReportForStorage({
      summary_en: 'Good progress',
      summary_cn: '表现不错',
      strengths_en: [],
      strengths_cn: [],
      weaknesses_en: [],
      weaknesses_cn: [],
      recommendations_en: [],
      recommendations_cn: [],
      timeAnalysis_en: '',
      timeAnalysis_cn: '',
      reportTitle_en: 'Assessment Feedback Report',
      reportTitle_cn: '测评反馈报告',
      overallSummary_en: '',
      overallSummary_cn: '',
      abilitySnapshot_en: [],
      abilitySnapshot_cn: [],
      sectionInsights: [],
      studyPlan: [],
      parentFeedback_en: '',
      parentFeedback_cn: '',
      speakingEvaluation: {
        totalScore: 4,
        totalPossible: 5,
        grade: 'B',
        overallFeedback_en: 'Clear response.',
        overallFeedback_cn: '回答清楚。',
        evaluations: [
          {
            sectionId: 'speaking',
            sectionTitle: 'Speaking',
            questionId: 1,
            prompt: 'Talk about your weekend.',
            audioUrl: 'data:audio/wav;base64,CCCC',
            transcript: 'I played football.',
            score: 4,
            maxScore: 5,
            grade: 'B',
            feedback_en: 'Relevant answer.',
            feedback_cn: '回答切题。',
            taskCompletion_en: 'Answered the question.',
            taskCompletion_cn: '回答了问题。',
            fluency_en: 'Mostly smooth.',
            fluency_cn: '整体较流畅。',
            vocabulary_en: 'Simple and appropriate.',
            vocabulary_cn: '词汇基础但合适。',
            grammar_en: 'Mostly controlled.',
            grammar_cn: '语法整体可控。',
            pronunciation_en: 'Generally clear.',
            pronunciation_cn: '整体较清楚。',
            suggestions_en: [],
            suggestions_cn: [],
          },
        ],
      },
    });

    expect(sanitized.speakingEvaluation?.evaluations[0]?.audioUrl).toBe('');
  });

  it('sanitizes already-serialized assessment payload JSON for pending history saves', () => {
    const sanitized = sanitizeStoredAssessmentPayloadJsonForResultStorage(
      JSON.stringify({
        __format: 'assessment_payload_v2',
        answers: {
          'speaking:1': 'data:audio/webm;base64,AAAA',
          'reading:1': 'answer',
        },
        paperSnapshot: { id: 'paper-1' },
      }),
    );

    const parsed = parseStoredAssessmentPayload(sanitized);
    expect(parsed.answers).toEqual({
      'speaking:1': '',
      'reading:1': 'answer',
    });
    expect(parsed.paperSnapshot).toEqual({ id: 'paper-1' });
  });
});
