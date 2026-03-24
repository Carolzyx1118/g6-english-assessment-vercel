import { describe, expect, it } from 'vitest';

import { getPaperReadinessMessage, isPaperReadyToStart } from './paperReadiness';

describe('paperReadiness', () => {
  it('treats papers with no generated sections as not ready', () => {
    expect(isPaperReadyToStart({
      sections: [],
      totalQuestions: 0,
      generationWarnings: [],
    })).toBe(false);
  });

  it('surfaces generation warnings before the generic fallback copy', () => {
    expect(getPaperReadinessMessage({
      sections: [],
      totalQuestions: 0,
      generationWarnings: ['Practice Part 1: only assembled 0/1 question(s).'],
    })).toBe('Practice Part 1: only assembled 0/1 question(s).');
  });

  it('falls back to generic copy when no warnings exist', () => {
    expect(getPaperReadinessMessage({
      sections: [],
      totalQuestions: 0,
      generationWarnings: [],
    })).toBe('Add question counts and matching tagged question-bank items first.');
  });
});
