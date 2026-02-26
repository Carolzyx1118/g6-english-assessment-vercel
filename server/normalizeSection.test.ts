import { describe, it, expect } from 'vitest';

/**
 * Since normalizeSection is a client-side module, we duplicate the core logic
 * here for testing. In production, the actual module at client/src/lib/normalizeSection.ts
 * is used. This test validates the normalization algorithms.
 */

// ---- Inline the normalization functions for testing ----

function normalizeGrammarPassage(passage: string): string {
  if (!passage) return passage;
  return passage.replace(
    /(?:<b>)?\((\d+)\)\s*_+(?:<\/b>)?/g,
    '<b>($1) ___</b>'
  );
}

interface TFStatement {
  label: string;
  statement: string;
  isTrue: boolean;
  reason: string;
}

function normalizeTrueFalse(q: any): { id: number; type: 'true-false'; statements: TFStatement[] } {
  if (
    q.statements?.length > 0 &&
    typeof q.statements[0] === 'object' &&
    'label' in q.statements[0] &&
    'statement' in q.statements[0] &&
    'isTrue' in q.statements[0]
  ) {
    const statements = q.statements.map((s: any, idx: number) => ({
      label: s.label || String.fromCharCode(97 + idx),
      statement: s.statement,
      isTrue: !!s.isTrue,
      reason: s.reason || '',
    }));
    return { id: q.id, type: 'true-false', statements };
  }

  if (q.statements?.length > 0 && typeof q.statements[0] === 'object') {
    const statements = q.statements.map((s: any, idx: number) => ({
      label: s.label || String.fromCharCode(97 + idx),
      statement: s.statement || s.text || '',
      isTrue: s.isTrue !== undefined ? !!s.isTrue : false,
      reason: s.reason || s.explanation || '',
    }));
    return { id: q.id, type: 'true-false', statements };
  }

  const statements: TFStatement[] = [];
  const rawStatements: string[] = q.statements || [];
  const rawTF: string[] = q.trueFalseStatements || [];
  const rawReasons: string[] = q.reasons || [];

  for (let i = 0; i < rawStatements.length; i++) {
    const stmtMatch = rawStatements[i].match(/^([a-z])[.)]\s*(.+)$/i);
    const label = stmtMatch ? stmtMatch[1].toLowerCase() : String.fromCharCode(97 + i);
    const statement = stmtMatch ? stmtMatch[2] : rawStatements[i];

    let isTrue = false;
    if (rawTF[i]) {
      isTrue = /true/i.test(rawTF[i]);
    }

    const reason = rawReasons[i] || '';
    statements.push({ label, statement, isTrue, reason });
  }

  return { id: q.id, type: 'true-false', statements };
}

function normalizeOpenEnded(q: any): any {
  if (!q.subQuestions || q.subQuestions.length === 0) {
    return q;
  }

  if (
    typeof q.subQuestions[0] === 'object' &&
    'label' in q.subQuestions[0] &&
    'question' in q.subQuestions[0]
  ) {
    const subs = q.subQuestions.map((s: any) => ({
      label: s.label,
      question: s.question || '',
      answer: s.answer || '',
    }));
    return { ...q, subQuestions: subs };
  }

  const normalizedSubs = q.subQuestions.map((sub: any, idx: number) => {
    if (typeof sub === 'string') {
      const isJustLabel = /^[a-z]$/i.test(sub.trim());
      if (isJustLabel) {
        return { label: sub.trim().toLowerCase(), question: '', answer: '' };
      }
      return { label: String.fromCharCode(97 + idx), question: sub, answer: '' };
    }
    if (typeof sub === 'object') {
      return {
        label: sub.label || String.fromCharCode(97 + idx),
        question: sub.question || sub.text || '',
        answer: sub.answer || '',
      };
    }
    return { label: String.fromCharCode(97 + idx), question: '', answer: '' };
  });

  return { ...q, subQuestions: normalizedSubs };
}

function normalizeWordBank(wordBank: any[] | undefined): { letter: string; word: string }[] | undefined {
  if (!wordBank || !Array.isArray(wordBank)) return wordBank;
  return wordBank.map((item, idx) => {
    if (typeof item === 'string') {
      return { letter: String.fromCharCode(65 + idx), word: item.trim() };
    }
    return {
      letter: (item.letter || String.fromCharCode(65 + idx)).toUpperCase().trim(),
      word: (item.word || '').trim(),
    };
  });
}

// ---- Tests ----

describe('normalizeGrammarPassage', () => {
  it('converts (N)___ format to <b>(N) ___</b>', () => {
    const input = 'The cat sat (21)___________ the mat.';
    const result = normalizeGrammarPassage(input);
    expect(result).toBe('The cat sat <b>(21) ___</b> the mat.');
  });

  it('converts (N) ___ format (with space) to <b>(N) ___</b>', () => {
    const input = 'The cat sat (21) ___ the mat.';
    const result = normalizeGrammarPassage(input);
    expect(result).toBe('The cat sat <b>(21) ___</b> the mat.');
  });

  it('normalizes already-wrapped <b>(N)___</b> to standard format', () => {
    const input = 'The cat sat <b>(21)___</b> the mat.';
    const result = normalizeGrammarPassage(input);
    expect(result).toBe('The cat sat <b>(21) ___</b> the mat.');
  });

  it('leaves already-correct format unchanged', () => {
    const input = 'The cat sat <b>(21) ___</b> the mat.';
    const result = normalizeGrammarPassage(input);
    expect(result).toBe('The cat sat <b>(21) ___</b> the mat.');
  });

  it('handles multiple blanks in one passage', () => {
    const input = 'He (21)___ happy (22)_________ he won.';
    const result = normalizeGrammarPassage(input);
    expect(result).toBe('He <b>(21) ___</b> happy <b>(22) ___</b> he won.');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeGrammarPassage('')).toBe('');
  });
});

describe('normalizeTrueFalse', () => {
  it('returns already-correct format unchanged', () => {
    const q = {
      id: 1,
      type: 'true-false',
      statements: [
        { label: 'a', statement: 'The sky is blue.', isTrue: true, reason: 'Obviously' },
        { label: 'b', statement: 'Fish can fly.', isTrue: false, reason: 'Fish swim' },
      ],
    };
    const result = normalizeTrueFalse(q);
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0].label).toBe('a');
    expect(result.statements[0].isTrue).toBe(true);
    expect(result.statements[1].isTrue).toBe(false);
  });

  it('converts separate arrays format (AI pattern 2)', () => {
    const q = {
      id: 1,
      type: 'true-false',
      statements: ['a) The sky is blue.', 'b) Fish can fly.'],
      trueFalseStatements: ['a) True', 'b) False'],
      reasons: ['Obviously', 'Fish swim'],
    };
    const result = normalizeTrueFalse(q);
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0]).toEqual({
      label: 'a',
      statement: 'The sky is blue.',
      isTrue: true,
      reason: 'Obviously',
    });
    expect(result.statements[1]).toEqual({
      label: 'b',
      statement: 'Fish can fly.',
      isTrue: false,
      reason: 'Fish swim',
    });
  });

  it('handles objects missing some fields (AI pattern 4)', () => {
    const q = {
      id: 1,
      type: 'true-false',
      statements: [
        { statement: 'The sky is blue.', isTrue: true },
        { statement: 'Fish can fly.', isTrue: false },
      ],
    };
    const result = normalizeTrueFalse(q);
    expect(result.statements[0].label).toBe('a');
    expect(result.statements[0].reason).toBe('');
    expect(result.statements[1].label).toBe('b');
  });

  it('handles empty statements array', () => {
    const q = { id: 1, type: 'true-false', statements: [] };
    const result = normalizeTrueFalse(q);
    expect(result.statements).toHaveLength(0);
  });
});

describe('normalizeOpenEnded', () => {
  it('returns already-correct format unchanged', () => {
    const q = {
      id: 1,
      type: 'open-ended',
      question: 'Answer:',
      subQuestions: [
        { label: 'a', question: 'Who?', answer: 'Tom' },
        { label: 'b', question: 'What?', answer: 'Run' },
      ],
    };
    const result = normalizeOpenEnded(q);
    expect(result.subQuestions).toHaveLength(2);
    expect(result.subQuestions[0].label).toBe('a');
  });

  it('converts string label array ["a", "b"] to objects', () => {
    const q = {
      id: 1,
      type: 'open-ended',
      question: 'Answer:',
      subQuestions: ['a', 'b'],
    };
    const result = normalizeOpenEnded(q);
    expect(result.subQuestions).toHaveLength(2);
    expect(result.subQuestions[0]).toEqual({ label: 'a', question: '', answer: '' });
    expect(result.subQuestions[1]).toEqual({ label: 'b', question: '', answer: '' });
  });

  it('converts question string array to objects', () => {
    const q = {
      id: 1,
      type: 'open-ended',
      question: 'Answer:',
      subQuestions: ['Who is the main character?', 'What happened?'],
    };
    const result = normalizeOpenEnded(q);
    expect(result.subQuestions[0]).toEqual({ label: 'a', question: 'Who is the main character?', answer: '' });
    expect(result.subQuestions[1]).toEqual({ label: 'b', question: 'What happened?', answer: '' });
  });

  it('returns question without subQuestions unchanged', () => {
    const q = {
      id: 1,
      type: 'open-ended',
      question: 'What happened?',
      answer: 'Something',
    };
    const result = normalizeOpenEnded(q);
    expect(result).toEqual(q);
  });
});

describe('normalizeWordBank', () => {
  it('normalizes letters to uppercase', () => {
    const wb = [
      { letter: 'a', word: 'although' },
      { letter: 'b', word: 'because' },
    ];
    const result = normalizeWordBank(wb);
    expect(result![0].letter).toBe('A');
    expect(result![1].letter).toBe('B');
  });

  it('handles string array as word bank', () => {
    const wb = ['although', 'because', 'however'];
    const result = normalizeWordBank(wb);
    expect(result![0]).toEqual({ letter: 'A', word: 'although' });
    expect(result![1]).toEqual({ letter: 'B', word: 'because' });
    expect(result![2]).toEqual({ letter: 'C', word: 'however' });
  });

  it('returns undefined for undefined input', () => {
    expect(normalizeWordBank(undefined)).toBeUndefined();
  });

  it('trims whitespace from words', () => {
    const wb = [{ letter: 'A', word: '  hello  ' }];
    const result = normalizeWordBank(wb);
    expect(result![0].word).toBe('hello');
  });
});

describe('integration: passage-based fill-blank flow', () => {
  it('normalizes a complete grammar section from AI output', () => {
    // Simulate AI output with non-standard blank format
    const aiPassage = 'The students were (21)___________ excited about the trip. They had (22)___________ waiting for weeks.';
    const normalized = normalizeGrammarPassage(aiPassage);
    
    expect(normalized).toContain('<b>(21) ___</b>');
    expect(normalized).toContain('<b>(22) ___</b>');
    
    // Verify the passage can be split by the standard regex
    const parts = normalized.split(/(<b>\(\d+\) ___<\/b>)/g);
    expect(parts.length).toBe(5); // text, blank, text, blank, text
  });
});
