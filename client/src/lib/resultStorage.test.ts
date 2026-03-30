import { describe, expect, it } from 'vitest';
import { huazhongPaper } from '@/data/huazhong-paper';
import type { Paper } from '@/data/papers';
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

  it('omits built-in paper snapshots so static papers do not bloat history uploads', () => {
    const packed = packStoredAssessmentPayloadForResultStorage(
      { 'vocabulary:1': 1 },
      huazhongPaper,
    );

    const parsed = parseStoredAssessmentPayload(packed);
    expect(parsed.answers).toEqual({ 'vocabulary:1': 1 });
    expect(parsed.paperSnapshot).toBeUndefined();
  });

  it('preserves owner metadata for student-scoped history queries', () => {
    const packed = packStoredAssessmentPayloadForResultStorage(
      { 'reading:1': 'B' },
      undefined,
      {
        username: 'student_a',
        displayName: 'Student A',
      },
    );

    const parsed = parseStoredAssessmentPayload(packed);
    expect(parsed.owner).toEqual({
      username: 'student_a',
      displayName: 'Student A',
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

  it('compacts generated paper snapshots and strips embedded media during packing', () => {
    const generatedPaper: Paper = {
      id: 'tag-system-english-ket-unit-1',
      title: 'KET Unit1 Practice',
      subtitle: 'Generated practice',
      description: 'A generated paper with embedded media.',
      icon: '🧪',
      color: '#1d4ed8',
      subject: 'english',
      category: 'practice',
      isGeneratedPaper: true,
      totalQuestions: 1,
      hasListening: false,
      hasWriting: false,
      sections: [
        {
          id: 'reading',
          title: 'Reading',
          subtitle: 'Generated reading',
          icon: '📘',
          color: 'text-sky-700',
          bgColor: 'bg-sky-50',
          description: 'Generated reading section',
          sectionType: 'reading',
          passage: 'A short generated passage.',
          questions: [
            {
              id: 1,
              type: 'picture-mcq',
              question: 'Which animal is shown?',
              options: [
                { label: 'A', imageUrl: 'data:image/png;base64,AAAA', text: 'Cat' },
                { label: 'B', imageUrl: 'https://example.com/dog.png', text: 'Dog' },
              ],
              correctAnswer: 1,
            },
          ],
        },
      ],
    };

    const packed = packStoredAssessmentPayloadForResultStorage(
      { 'reading:1': 1 },
      generatedPaper,
    );

    const parsed = parseStoredAssessmentPayload(packed);
    expect(parsed.answers).toEqual({ 'reading:1': 1 });
    expect(parsed.paperSnapshot).toEqual({
      id: 'tag-system-english-ket-unit-1',
      title: 'KET Unit1 Practice',
      subject: 'english',
      sections: [
        {
          id: 'reading',
          title: 'Reading',
          subtitle: 'Generated reading',
          sectionType: 'reading',
          description: 'Generated reading section',
          passage: 'A short generated passage.',
          questions: [
            {
              id: 1,
              type: 'picture-mcq',
              question: 'Which animal is shown?',
              options: [
                { label: 'A', imageUrl: '', text: 'Cat' },
                { label: 'B', imageUrl: 'https://example.com/dog.png', text: 'Dog' },
              ],
              correctAnswer: 1,
            },
          ],
        },
      ],
    });
  });

  it('keeps non-embedded question materials needed by history review', () => {
    const generatedPaper: Paper = {
      id: 'tag-system-english-materials',
      title: 'Generated Materials Practice',
      subtitle: 'Generated practice',
      description: 'A generated paper with review materials.',
      icon: '🧪',
      color: '#1d4ed8',
      subject: 'english',
      category: 'practice',
      isGeneratedPaper: true,
      totalQuestions: 1,
      hasListening: false,
      hasWriting: false,
      sections: [
        {
          id: 'reading',
          title: 'Reading',
          subtitle: 'Generated reading',
          icon: '📘',
          color: 'text-sky-700',
          bgColor: 'bg-sky-50',
          description: 'Generated reading section',
          taskDescription: 'Read the passage and answer the question.',
          sectionType: 'reading',
          passage: 'A full generated passage.',
          sceneImageUrl: 'https://example.com/scene.png',
          matchingDescriptions: [{ label: 'A', name: 'Alice', text: 'Likes science.' }],
          manualBlocks: [
            {
              id: 'block-1',
              displayNumber: 1,
              questionIds: [1],
              taskDescription: 'Match the note to the person.',
              passage: 'Block-level passage.',
              sceneImageUrl: 'https://example.com/block-scene.png',
              matchingDescriptions: [{ label: 'B', name: 'Ben', text: 'Likes music.' }],
            },
          ],
          questions: [
            {
              id: 1,
              type: 'open-ended',
              question: 'What does the passage say?',
              imageUrl: 'https://example.com/question.png',
              correctAnswer: 'It explains the main idea.',
            },
          ],
        },
      ],
    };

    const packed = packStoredAssessmentPayloadForResultStorage(
      { 'reading:1': 'It explains the main idea.' },
      generatedPaper,
    );

    const parsed = parseStoredAssessmentPayload(packed);
    expect(parsed.paperSnapshot).toEqual({
      id: 'tag-system-english-materials',
      title: 'Generated Materials Practice',
      subject: 'english',
      sections: [
        {
          id: 'reading',
          title: 'Reading',
          subtitle: 'Generated reading',
          description: 'Generated reading section',
          taskDescription: 'Read the passage and answer the question.',
          sectionType: 'reading',
          passage: 'A full generated passage.',
          sceneImageUrl: 'https://example.com/scene.png',
          matchingDescriptions: [{ label: 'A', name: 'Alice', text: 'Likes science.' }],
          manualBlocks: [
            {
              id: 'block-1',
              displayNumber: 1,
              questionIds: [1],
              taskDescription: 'Match the note to the person.',
              passage: 'Block-level passage.',
              sceneImageUrl: 'https://example.com/block-scene.png',
              matchingDescriptions: [{ label: 'B', name: 'Ben', text: 'Likes music.' }],
            },
          ],
          questions: [
            {
              id: 1,
              type: 'open-ended',
              question: 'What does the passage say?',
              imageUrl: 'https://example.com/question.png',
              correctAnswer: 'It explains the main idea.',
            },
          ],
        },
      ],
    });
  });

  it('sanitizes already-serialized assessment payload JSON for pending history saves', () => {
    const sanitized = sanitizeStoredAssessmentPayloadJsonForResultStorage(
      JSON.stringify({
        __format: 'assessment_payload_v2',
        answers: {
          'speaking:1': 'data:audio/webm;base64,AAAA',
          'reading:1': 'answer',
        },
        paperSnapshot: {
          id: 'tag-system-english-generated',
          title: 'Generated Practice',
          subject: 'english',
          description: 'legacy full snapshot',
          sections: [
            {
              id: 'reading',
              title: 'Reading',
              subtitle: 'legacy',
              icon: '📘',
              color: 'text-sky-700',
              bgColor: 'bg-sky-50',
              description: 'legacy section',
              sectionType: 'reading',
              passage: 'Legacy passage',
              questions: [
                {
                  id: 1,
                  type: 'picture-mcq',
                  question: 'Choose one',
                  options: [
                    { label: 'A', imageUrl: 'data:image/png;base64,BBBB', text: 'Cat' },
                  ],
                  correctAnswer: 0,
                },
              ],
            },
          ],
        },
      }),
    );

    const parsed = parseStoredAssessmentPayload(sanitized);
    expect(parsed.answers).toEqual({
      'speaking:1': '',
      'reading:1': 'answer',
    });
    expect(parsed.paperSnapshot).toEqual({
      id: 'tag-system-english-generated',
      title: 'Generated Practice',
      subject: 'english',
      sections: [
        {
          id: 'reading',
          title: 'Reading',
          subtitle: 'legacy',
          sectionType: 'reading',
          description: 'legacy section',
          passage: 'Legacy passage',
          questions: [
            {
              id: 1,
              type: 'picture-mcq',
              question: 'Choose one',
              options: [
                { label: 'A', imageUrl: '', text: 'Cat' },
              ],
              correctAnswer: 0,
            },
          ],
        },
      ],
    });
  });
});
