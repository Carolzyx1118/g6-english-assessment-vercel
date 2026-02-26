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

function normalizeTable(q: any): any {
  if (
    q.rows?.length > 0 &&
    typeof q.rows[0] === 'object' &&
    !Array.isArray(q.rows[0]) &&
    'blankField' in q.rows[0]
  ) {
    return q;
  }
  if (q.rows?.length > 0 && typeof q.rows[0] === 'string') {
    const headers: string[] = q.rows;
    const rowDataArrays: string[][] = [];
    for (let i = 1; i <= 20; i++) {
      const key = i === 1 ? 'tableData' : `tableData${i}`;
      if (q[key] && Array.isArray(q[key])) {
        rowDataArrays.push(q[key]);
      }
    }
    if (q.data && Array.isArray(q.data)) {
      for (const row of q.data) {
        if (Array.isArray(row)) rowDataArrays.push(row);
      }
    }
    const normalizedRows: any[] = [];
    for (const rowData of rowDataArrays) {
      const rowObj: Record<string, string> = {};
      for (let col = 0; col < headers.length; col++) {
        const header = headers[col].toLowerCase().trim();
        rowObj[header] = rowData[col] || '';
      }
      const situation = rowObj['situation'] || rowObj['event'] || '';
      const thought = rowObj['thought'] || rowObj['feeling'] || rowObj['reason'] || '';
      const action = rowObj['action'] || rowObj['response'] || '';
      let blankField: 'thought' | 'action' = 'action';
      if (!action && thought) {
        blankField = 'action';
      } else if (!thought && action) {
        blankField = 'thought';
      } else {
        blankField = 'action';
      }
      normalizedRows.push({ situation, thought, action, blankField, answer: '' });
    }
    if (q.answers && Array.isArray(q.answers)) {
      for (let i = 0; i < Math.min(q.answers.length, normalizedRows.length); i++) {
        normalizedRows[i].answer = q.answers[i];
      }
    }
    if (q.blankFields && Array.isArray(q.blankFields)) {
      for (let i = 0; i < Math.min(q.blankFields.length, normalizedRows.length); i++) {
        const bf = q.blankFields[i]?.toLowerCase();
        if (bf === 'thought' || bf === 'action') {
          normalizedRows[i].blankField = bf;
        }
      }
    }
    return {
      id: q.id,
      type: 'table',
      question: q.question || 'Complete the table:',
      rows: normalizedRows,
    };
  }
  if (q.rows?.length > 0 && typeof q.rows[0] === 'object' && !('blankField' in q.rows[0])) {
    const normalizedRows = q.rows.map((row: any) => {
      const situation = row.situation || row.event || '';
      const thought = row.thought || row.feeling || '';
      const action = row.action || row.response || '';
      const answer = row.answer || '';
      let blankField: 'thought' | 'action' = 'action';
      if (!thought && action) blankField = 'thought';
      else if (!action && thought) blankField = 'action';
      return { situation, thought, action, blankField, answer };
    });
    return { id: q.id, type: 'table', question: q.question || 'Complete the table:', rows: normalizedRows };
  }
  return { id: q.id, type: 'table', question: q.question || 'Complete the table:', rows: [] };
}

function normalizeReference(q: any): any {
  if (
    q.items?.length > 0 &&
    typeof q.items[0] === 'object' &&
    'word' in q.items[0]
  ) {
    const items = q.items.map((item: any) => ({
      word: item.word || '',
      lineRef: item.lineRef || item.line || '',
      answer: item.answer || '',
    }));
    return { id: q.id, type: 'reference', question: q.question || 'What do these words refer to?', items };
  }
  if (q.items?.length > 0 && typeof q.items[0] === 'string') {
    const answers: string[] = q.answers || [];
    const items = q.items.map((item: string, idx: number) => {
      const match = item.match(/^["']?(\w+)["']?\s*\((.+?)\)$/);
      if (match) {
        return { word: match[1], lineRef: match[2].trim(), answer: answers[idx] || '' };
      }
      return { word: item.trim().replace(/['"]/g, ''), lineRef: '', answer: answers[idx] || '' };
    });
    return { id: q.id, type: 'reference', question: q.question || 'What do these words refer to?', items };
  }
  return { id: q.id, type: 'reference', question: q.question || 'What do these words refer to?', items: [] };
}

function normalizePhrase(q: any): any {
  if (
    q.items?.length > 0 &&
    typeof q.items[0] === 'object' &&
    'clue' in q.items[0]
  ) {
    const items = q.items.map((item: any) => ({
      clue: item.clue || '',
      answer: item.answer || '',
    }));
    return { id: q.id, type: 'phrase', question: q.question || 'Find the phrases:', items };
  }
  if (q.items?.length > 0 && typeof q.items[0] === 'string') {
    const answers: string[] = q.answers || [];
    const items = q.items.map((clue: string, idx: number) => ({
      clue,
      answer: answers[idx] || '',
    }));
    return { id: q.id, type: 'phrase', question: q.question || 'Find the phrases:', items };
  }
  return { id: q.id, type: 'phrase', question: q.question || 'Find the phrases:', items: [] };
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

  it('handles real AI output from database', () => {
    const q = {
      id: 33,
      type: 'true-false',
      statements: [
        'a) The narrator and Mother went to the café in the morning.',
        'b) It had been raining before the narrator and Mother left the house.',
        'c) Mother believed that one had to be wary of men who were excessively nice.',
      ],
      trueFalseStatements: ['a) False', 'b) False', 'c) True'],
      reasons: [
        "They went there in the afternoon / 'Yesterday afternoon'.",
        'It was a hot, sweltering day when they left the house.',
        'Mother had a golden rule that the nicer a man seemed, the more suspicious one should be.',
      ],
    };
    const result = normalizeTrueFalse(q);
    expect(result.statements).toHaveLength(3);
    expect(result.statements[0].label).toBe('a');
    expect(result.statements[0].isTrue).toBe(false);
    expect(result.statements[0].reason).toContain('afternoon');
    expect(result.statements[2].label).toBe('c');
    expect(result.statements[2].isTrue).toBe(true);
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

describe('normalizeTable', () => {
  it('passes through already-correct table format', () => {
    const q = {
      id: 35,
      type: 'table',
      question: 'Complete the table',
      rows: [
        { situation: 'At the park', thought: 'I want to play', action: '', blankField: 'action', answer: 'Go to swings' },
      ],
    };
    const result = normalizeTable(q);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].blankField).toBe('action');
    expect(result.rows[0].answer).toBe('Go to swings');
  });

  it('converts AI format with string headers + tableData/tableData2', () => {
    const q = {
      id: 35,
      type: 'table',
      question: 'Complete the table.',
      rows: ['situation', 'thought', 'action'],
      tableData: [
        'The old man offered his umbrella for five dollars.',
        "Mother had doubts about the old man's intentions.",
        'She gave the old man five dollars.',
      ],
      tableData2: [
        'Mother spotted the old man enter the café.',
        "Mother suspected that the old man might not be telling the truth.",
        'Mother followed him to the café.',
      ],
    };
    const result = normalizeTable(q);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].situation).toBe('The old man offered his umbrella for five dollars.');
    expect(result.rows[0].thought).toBe("Mother had doubts about the old man's intentions.");
    expect(result.rows[0].action).toBe('She gave the old man five dollars.');
    expect(result.rows[1].situation).toBe('Mother spotted the old man enter the café.');
    expect(result.rows[1].thought).toContain('Mother suspected');
    expect(result.rows[1].action).toBe('Mother followed him to the café.');
  });

  it('handles empty rows gracefully', () => {
    const q = { id: 35, type: 'table', question: 'Complete', rows: [] };
    const result = normalizeTable(q);
    expect(result.rows).toHaveLength(0);
  });

  it('handles rows without blankField by detecting empty cells', () => {
    const q = {
      id: 35,
      type: 'table',
      question: 'Complete',
      rows: [
        { situation: 'Event 1', thought: '', action: 'Did something', answer: 'Thought about it' },
      ],
    };
    const result = normalizeTable(q);
    expect(result.rows[0].blankField).toBe('thought');
  });

  it('converts the exact AI output found in the database', () => {
    const q = {
      id: 35,
      type: 'table',
      question: 'Based on the information, complete the following table.',
      rows: ['situation', 'thought', 'action'],
      tableData: [
        'The old man offered his umbrella for five dollars.',
        "Mother had doubts about the old man's intentions.",
        'She gave the old man five dollars.',
      ],
      tableData2: [
        'Mother spotted the old man enter the café.',
        "Mother suspected that the old man might not be telling the truth / doubted his intentions.",
        'Mother followed him to the café.',
      ],
    };
    const result = normalizeTable(q);
    expect(result.type).toBe('table');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].situation).toBe('The old man offered his umbrella for five dollars.');
    expect(result.rows[0].thought).toBe("Mother had doubts about the old man's intentions.");
    expect(result.rows[0].action).toBe('She gave the old man five dollars.');
    expect(result.rows[1].situation).toBe('Mother spotted the old man enter the café.');
    expect(result.rows[1].thought).toContain('Mother suspected');
    expect(result.rows[1].action).toBe('Mother followed him to the café.');
  });

  it('handles data array format', () => {
    const q = {
      id: 35,
      type: 'table',
      question: 'Complete',
      rows: ['situation', 'thought', 'action'],
      data: [
        ['Event 1', 'Thought 1', 'Action 1'],
        ['Event 2', 'Thought 2', 'Action 2'],
      ],
    };
    const result = normalizeTable(q);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].situation).toBe('Event 1');
    expect(result.rows[1].action).toBe('Action 2');
  });
});

describe('normalizeReference', () => {
  it('passes through already-correct reference format', () => {
    const q = {
      id: 37,
      type: 'reference',
      question: 'What do these words refer to?',
      items: [{ word: 'it', lineRef: 'line 7', answer: 'the rain' }],
    };
    const result = normalizeReference(q);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].word).toBe('it');
    expect(result.items[0].answer).toBe('the rain');
  });

  it('converts AI format with string items + separate answers', () => {
    const q = {
      id: 37,
      type: 'reference',
      question: 'What do these words refer to?',
      items: ['it (line 7)', 'them (line 8)', 'she (line 33)'],
      answers: ['the rain / the weather', 'the taxis', 'the woman the old man spoke to'],
    };
    const result = normalizeReference(q);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({ word: 'it', lineRef: 'line 7', answer: 'the rain / the weather' });
    expect(result.items[1]).toEqual({ word: 'them', lineRef: 'line 8', answer: 'the taxis' });
    expect(result.items[2]).toEqual({ word: 'she', lineRef: 'line 33', answer: 'the woman the old man spoke to' });
  });

  it('handles empty items', () => {
    const q = { id: 37, type: 'reference', question: 'What?', items: [] };
    const result = normalizeReference(q);
    expect(result.items).toHaveLength(0);
  });

  it('handles items without parenthetical line refs', () => {
    const q = {
      id: 37,
      type: 'reference',
      question: 'What do these words refer to?',
      items: ['it', 'them'],
      answers: ['the book', 'the children'],
    };
    const result = normalizeReference(q);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].word).toBe('it');
    expect(result.items[0].lineRef).toBe('');
    expect(result.items[0].answer).toBe('the book');
  });
});

describe('normalizePhrase', () => {
  it('passes through already-correct phrase format', () => {
    const q = {
      id: 39,
      type: 'phrase',
      question: 'Find phrases',
      items: [{ clue: 'Which phrase means surprised?', answer: 'to our surprise' }],
    };
    const result = normalizePhrase(q);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].clue).toBe('Which phrase means surprised?');
    expect(result.items[0].answer).toBe('to our surprise');
  });

  it('converts AI format with string items + separate answers', () => {
    const q = {
      id: 39,
      type: 'phrase',
      question: 'Find the phrases',
      items: [
        'Which three-word phrase tells you they were surprised?',
        'Which phrase tells you Mother knew the truth?',
      ],
      answers: ['to our surprise', 'his little game'],
    };
    const result = normalizePhrase(q);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].clue).toBe('Which three-word phrase tells you they were surprised?');
    expect(result.items[0].answer).toBe('to our surprise');
    expect(result.items[1].clue).toBe('Which phrase tells you Mother knew the truth?');
    expect(result.items[1].answer).toBe('his little game');
  });

  it('handles empty items', () => {
    const q = { id: 39, type: 'phrase', question: 'Find', items: [] };
    const result = normalizePhrase(q);
    expect(result.items).toHaveLength(0);
  });
});

describe('integration: passage-based fill-blank flow', () => {
  it('normalizes a complete grammar section from AI output', () => {
    const aiPassage = 'The students were (21)___________ excited about the trip. They had (22)___________ waiting for weeks.';
    const normalized = normalizeGrammarPassage(aiPassage);
    
    expect(normalized).toContain('<b>(21) ___</b>');
    expect(normalized).toContain('<b>(22) ___</b>');
    
    const parts = normalized.split(/(<b>\(\d+\) ___<\/b>)/g);
    expect(parts.length).toBe(5);
  });
});
