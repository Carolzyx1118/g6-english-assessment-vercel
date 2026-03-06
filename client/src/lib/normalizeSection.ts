/**
 * normalizeSection.ts
 * 
 * Data normalization layer for custom (AI-parsed) papers.
 * AI-generated data often has slight structural differences from what our
 * rendering components expect. This module fixes those differences automatically
 * so that once a paper is uploaded, it "just works".
 * 
 * Key normalizations:
 * 1. grammarPassage blank format: "(21)___" → "<b>(21) ___</b>"
 * 2. fill-blank questions: ensure each has a `question` field with the sentence
 * 3. true-false questions: convert various AI formats to {label, statement, isTrue, reason}[]
 * 4. open-ended subQuestions: convert string[] to {label, question, answer}[]
 * 5. table questions: convert AI's separate arrays to {situation, thought, action, blankField, answer}[]
 * 6. reference questions: convert AI's separate arrays to {word, lineRef, answer}[]
 * 7. phrase questions: convert AI's separate arrays to {clue, answer}[]
 * 8. Ensure all question IDs are numbers (not strings)
 * 9. Normalize wordBank letter format (ensure uppercase single letters)
 * 10. Handle missing/empty section fields gracefully
 */

import type { Section, Question, TrueFalseQuestion, OpenEndedQuestion, FillBlankQuestion, TableQuestion, ReferenceQuestion, PhraseQuestion } from '@/data/papers';

/**
 * Normalize a grammarPassage to use the standard blank format: <b>(N) ___</b>
 */
function normalizeGrammarPassage(passage: string): string {
  if (!passage) return passage;
  return passage.replace(
    /(?:<b>)?\((\d+)\)\s*_+(?:<\/b>)?/g,
    '<b>($1) ___</b>'
  );
}

/**
 * Extract individual sentences from a grammarPassage for fill-blank questions.
 */
function extractSentencesFromPassage(passage: string, questionIds: number[]): Map<number, string> {
  const result = new Map<number, string>();
  if (!passage) return result;
  const plainText = passage.replace(/<[^>]+>/g, '');
  for (const qId of questionIds) {
    const regex = new RegExp(`[^.!?]*\\(${qId}\\)[^.!?]*[.!?]`, 'g');
    const match = plainText.match(regex);
    if (match) {
      const sentence = match[0].trim().replace(new RegExp(`\\(${qId}\\)\\s*_*`), '___');
      result.set(qId, sentence);
    }
  }
  return result;
}

/**
 * Normalize a true-false question from AI format to component format.
 * 
 * Handles:
 * Pattern 1 (correct): { statements: [{label, statement, isTrue, reason}] }
 * Pattern 2 (separate arrays): { statements: ["a) Stmt"], trueFalseStatements: ["a) False"], reasons: ["reason"] }
 * Pattern 3 (string array): { statements: ["a) Statement 1", "b) Statement 2"] }
 * Pattern 4 (mixed): { statements: [{statement: "...", isTrue: true}] } (missing label/reason)
 */
function normalizeTrueFalse(q: any): TrueFalseQuestion {
  // Guard: if statements is missing or empty, return empty
  if (!q.statements || !Array.isArray(q.statements) || q.statements.length === 0) {
    return { id: q.id, type: 'true-false', statements: [] };
  }

  const first = q.statements[0];

  // Check if already in correct format (first element is a non-null object with expected keys)
  if (
    first !== null &&
    first !== undefined &&
    typeof first === 'object' &&
    'label' in first &&
    'statement' in first &&
    'isTrue' in first
  ) {
    const statements = q.statements.map((s: any, idx: number) => ({
      label: s?.label || String.fromCharCode(97 + idx),
      statement: s?.statement || '',
      isTrue: !!s?.isTrue,
      reason: s?.reason || '',
    }));
    return { id: q.id, type: 'true-false', statements };
  }
  
  // Pattern 4: objects but missing some fields (ensure non-null)
  if (
    first !== null &&
    first !== undefined &&
    typeof first === 'object'
  ) {
    const statements = q.statements
      .filter((s: any) => s !== null && s !== undefined)
      .map((s: any, idx: number) => ({
        label: s.label || String.fromCharCode(97 + idx),
        statement: s.statement || s.text || '',
        isTrue: s.isTrue !== undefined ? !!s.isTrue : false,
        reason: s.reason || s.explanation || '',
      }));
    return { id: q.id, type: 'true-false', statements };
  }
  
  // Pattern 2 & 3: string arrays
  const statements: TrueFalseQuestion['statements'] = [];
  const rawStatements: string[] = q.statements || [];
  const rawTF: string[] = q.trueFalseStatements || [];
  const rawReasons: string[] = q.reasons || [];
  
  for (let i = 0; i < rawStatements.length; i++) {
    if (rawStatements[i] == null) continue;
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

/**
 * Normalize an open-ended question's subQuestions.
 */
function normalizeOpenEnded(q: any): OpenEndedQuestion {
  if (!q.subQuestions || !Array.isArray(q.subQuestions) || q.subQuestions.length === 0) {
    return q as OpenEndedQuestion;
  }
  
  const first = q.subQuestions[0];
  if (
    first !== null &&
    first !== undefined &&
    typeof first === 'object' &&
    'label' in first &&
    'question' in first
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

/**
 * Normalize a table question from AI format to component format.
 * 
 * AI format (common):
 *   { rows: ["situation", "thought", "action"],
 *     tableData: ["situation1", "thought1", "action1"],
 *     tableData2: ["situation2", "thought2", "action2"] }
 * 
 * OR AI format variant:
 *   { rows: ["situation", "thought", "action"],
 *     data: [["situation1", "thought1", "action1"], ["situation2", "thought2", "action2"]] }
 * 
 * Expected format:
 *   { rows: [
 *       { situation: "situation1", thought: "thought1", action: "", blankField: "action", answer: "action1" },
 *       { situation: "situation2", thought: "", action: "action2", blankField: "thought", answer: "thought2" }
 *   ]}
 * 
 * The component also supports dynamic columns now (not just situation/thought/action).
 */
function normalizeTable(q: any): TableQuestion {
  // Already in correct format - rows is array of objects with situation/thought/action/blankField/answer
  const tableFirst = q.rows?.[0];
  if (
    q.rows?.length > 0 &&
    tableFirst !== null &&
    tableFirst !== undefined &&
    typeof tableFirst === 'object' &&
    !Array.isArray(tableFirst) &&
    'blankField' in tableFirst
  ) {
    return q as TableQuestion;
  }
  
  // AI format: rows is column headers, tableData/tableData2/... are row data
  if (q.rows?.length > 0 && typeof q.rows[0] === 'string') {
    const headers: string[] = q.rows; // e.g., ["situation", "thought", "action"]
    
    // Collect all row data arrays (tableData, tableData2, tableData3, ...)
    const rowDataArrays: string[][] = [];
    
    // Check for numbered tableData keys
    for (let i = 1; i <= 20; i++) {
      const key = i === 1 ? 'tableData' : `tableData${i}`;
      if (q[key] && Array.isArray(q[key])) {
        rowDataArrays.push(q[key]);
      }
    }
    
    // Also check for a 'data' array of arrays
    if (q.data && Array.isArray(q.data)) {
      for (const row of q.data) {
        if (Array.isArray(row)) {
          rowDataArrays.push(row);
        }
      }
    }
    
    // Also check for 'tableRows' array
    if (q.tableRows && Array.isArray(q.tableRows)) {
      for (const row of q.tableRows) {
        if (Array.isArray(row)) {
          rowDataArrays.push(row);
        }
      }
    }
    
    // Convert to the expected format
    const normalizedRows: TableQuestion['rows'] = [];
    
    for (const rowData of rowDataArrays) {
      // Map each column header to its value
      const rowObj: Record<string, string> = {};
      for (let col = 0; col < headers.length; col++) {
        const header = headers[col].toLowerCase().trim();
        rowObj[header] = rowData[col] || '';
      }
      
      // Determine which field is the blank (the one the student needs to fill in)
      // Heuristic: look for empty values, or if all filled, check for blankField hints
      const situation = rowObj['situation'] || rowObj['event'] || rowObj['what happened'] || '';
      const thought = rowObj['thought'] || rowObj['what mother thought'] || rowObj['feeling'] || rowObj['reason'] || '';
      const action = rowObj['action'] || rowObj['what mother did'] || rowObj['response'] || rowObj['what happened next'] || '';
      
      // Try to detect which field should be blank
      // If a field is empty, that's the blank
      let blankField: 'thought' | 'action' = 'action';
      let answer = '';
      
      if (!action && thought) {
        blankField = 'action';
        answer = action; // Will be empty - the answer should come from the original data
      } else if (!thought && action) {
        blankField = 'thought';
        answer = thought;
      } else {
        // Both filled - need to use answer hints if available
        // Default: action is the blank
        blankField = 'action';
        answer = action;
      }
      
      normalizedRows.push({ situation, thought, action, blankField, answer });
    }
    
    // If we couldn't determine blanks well, try using answers array if provided
    if (q.answers && Array.isArray(q.answers)) {
      for (let i = 0; i < Math.min(q.answers.length, normalizedRows.length); i++) {
        normalizedRows[i].answer = q.answers[i];
      }
    }
    
    // If we have blankFields array
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
  
  // AI format variant: rows is array of objects but without blankField
  const tableFirst2 = q.rows?.[0];
  if (q.rows?.length > 0 && tableFirst2 !== null && tableFirst2 !== undefined && typeof tableFirst2 === 'object' && !('blankField' in tableFirst2)) {
    const normalizedRows = q.rows.map((row: any) => {
      const situation = row.situation || row.event || '';
      const thought = row.thought || row.feeling || row.reason || '';
      const action = row.action || row.response || '';
      const answer = row.answer || '';
      
      // Detect blank field: if one is empty, that's the blank
      let blankField: 'thought' | 'action' = 'action';
      if (!thought && action) blankField = 'thought';
      else if (!action && thought) blankField = 'action';
      else if (row.blankField) blankField = row.blankField;
      
      return { situation, thought, action, blankField, answer };
    });
    
    return {
      id: q.id,
      type: 'table',
      question: q.question || 'Complete the table:',
      rows: normalizedRows,
    };
  }
  
  // Fallback: return as-is with empty rows
  return {
    id: q.id,
    type: 'table',
    question: q.question || 'Complete the table:',
    rows: [],
  };
}

/**
 * Normalize a reference question from AI format to component format.
 * 
 * AI format (common):
 *   { items: ["it (line 7)", "them (line 8)"], answers: ["the rain", "the taxis"] }
 * 
 * Expected format:
 *   { items: [{word: "it", lineRef: "line 7", answer: "the rain"}] }
 */
function normalizeReference(q: any): ReferenceQuestion {
  // Already in correct format
  const refFirst = q.items?.[0];
  if (
    q.items?.length > 0 &&
    refFirst !== null &&
    refFirst !== undefined &&
    typeof refFirst === 'object' &&
    'word' in refFirst
  ) {
    // Ensure answer field exists
    const items = q.items.map((item: any) => ({
      word: item.word || '',
      lineRef: item.lineRef || item.line || '',
      answer: item.answer || '',
    }));
    return { id: q.id, type: 'reference', question: q.question || 'What do these words refer to?', items };
  }
  
  // AI format: items is string array like ["it (line 7)", "them (line 8)"]
  if (q.items?.length > 0 && typeof q.items[0] === 'string') {
    const answers: string[] = q.answers || [];
    const items = q.items.map((item: string, idx: number) => {
      // Parse "it (line 7)" or "it (paragraph 1)" or "them (line 8)"
      const match = item.match(/^["']?(\w+)["']?\s*\((.+?)\)$/);
      if (match) {
        return {
          word: match[1],
          lineRef: match[2].trim(),
          answer: answers[idx] || '',
        };
      }
      // Try simpler format: just a word
      return {
        word: item.trim().replace(/['"]/g, ''),
        lineRef: '',
        answer: answers[idx] || '',
      };
    });
    return { id: q.id, type: 'reference', question: q.question || 'What do these words refer to?', items };
  }
  
  // Fallback
  return {
    id: q.id,
    type: 'reference',
    question: q.question || 'What do these words refer to?',
    items: [],
  };
}

/**
 * Normalize a phrase question from AI format to component format.
 * 
 * AI format (common):
 *   { items: ["Which phrase means...?", "Which phrase tells...?"], answers: ["phrase1", "phrase2"] }
 * 
 * Expected format:
 *   { items: [{clue: "Which phrase means...?", answer: "phrase1"}] }
 */
function normalizePhrase(q: any): PhraseQuestion {
  // Already in correct format
  const phraseFirst = q.items?.[0];
  if (
    q.items?.length > 0 &&
    phraseFirst !== null &&
    phraseFirst !== undefined &&
    typeof phraseFirst === 'object' &&
    'clue' in phraseFirst
  ) {
    const items = q.items.map((item: any) => ({
      clue: item.clue || '',
      answer: item.answer || '',
    }));
    return { id: q.id, type: 'phrase', question: q.question || 'Find the phrases:', items };
  }
  
  // AI format: items is string array of clues, answers is separate array
  if (q.items?.length > 0 && typeof q.items[0] === 'string') {
    const answers: string[] = q.answers || [];
    const items = q.items.map((clue: string, idx: number) => ({
      clue: clue,
      answer: answers[idx] || '',
    }));
    return { id: q.id, type: 'phrase', question: q.question || 'Find the phrases:', items };
  }
  
  // Fallback
  return {
    id: q.id,
    type: 'phrase',
    question: q.question || 'Find the phrases:',
    items: [],
  };
}

/**
 * Normalize fill-blank questions to ensure they have a `question` field.
 */
function normalizeFillBlanks(questions: any[], grammarPassage?: string): any[] {
  const fillBlanks = questions.filter(q => q.type === 'fill-blank');
  if (fillBlanks.length === 0) return questions;
  
  if (grammarPassage) {
    const sentenceMap = extractSentencesFromPassage(
      grammarPassage,
      fillBlanks.map(q => typeof q.id === 'string' ? parseInt(q.id, 10) : q.id)
    );
    
    return questions.map(q => {
      if (q.type === 'fill-blank' && !q.question) {
        const qId = typeof q.id === 'string' ? parseInt(q.id, 10) : q.id;
        const sentence = sentenceMap.get(qId);
        if (sentence) {
          return { ...q, question: sentence };
        }
      }
      return q;
    });
  }
  
  return questions;
}

/**
 * Normalize wordBank entries.
 */
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

/**
 * Normalize all questions in a section.
 */
function normalizeQuestions(questions: any[], grammarPassage?: string): Question[] {
  if (!questions || !Array.isArray(questions)) return [];
  
  let normalized: any[];
  try {
    normalized = normalizeFillBlanks(questions, grammarPassage);
  } catch (e) {
    console.warn('normalizeFillBlanks failed, using raw questions:', e);
    normalized = questions;
  }
  
  return normalized.map(q => {
    try {
      const id = typeof q.id === 'string' ? parseInt(q.id, 10) : (q.id || 0);
      
      switch (q.type) {
        case 'true-false':
          return { ...normalizeTrueFalse(q), id };
        case 'open-ended':
          return { ...normalizeOpenEnded(q), id };
        case 'table':
          return { ...normalizeTable(q), id };
        case 'reference':
          return { ...normalizeReference(q), id };
        case 'phrase':
          return { ...normalizePhrase(q), id };
        case 'mcq':
          return { ...q, id, correctAnswer: typeof q.correctAnswer === 'string' ? parseInt(q.correctAnswer, 10) : q.correctAnswer };
        case 'checkbox':
          return { ...q, id, correctAnswers: (q.correctAnswers || []).map((a: any) => typeof a === 'string' ? parseInt(a, 10) : a) };
        default:
          return { ...q, id };
      }
    } catch (e) {
      console.warn(`Failed to normalize question ${q.id}:`, e);
      // Return the question as-is with a safe id
      return { ...q, id: typeof q.id === 'string' ? parseInt(q.id, 10) : (q.id || 0) };
    }
  });
}

/**
 * Normalize an entire section.
 */
export function normalizeSection(section: any): Section {
  const grammarPassage = section.grammarPassage 
    ? normalizeGrammarPassage(section.grammarPassage)
    : section.grammarPassage;
  
  const wordBank = normalizeWordBank(section.wordBank);
  const questions = normalizeQuestions(section.questions, grammarPassage);
  
  return {
    id: section.id || 'section-' + Math.random().toString(36).slice(2, 8),
    title: section.title || 'Section',
    subtitle: section.subtitle || '',
    icon: section.icon || '📝',
    color: section.color || 'text-blue-600',
    bgColor: section.bgColor || 'bg-blue-50',
    description: section.description || '',
    questions,
    passage: section.passage || undefined,
    wordBank: wordBank || undefined,
    grammarPassage: grammarPassage || undefined,
    imageUrl: section.imageUrl || undefined,
    audioUrl: section.audioUrl || undefined,
    sceneImageUrl: section.sceneImageUrl || undefined,
    wordBankImageUrl: section.wordBankImageUrl || undefined,
    storyImages: section.storyImages || undefined,
    storyParagraphs: section.storyParagraphs || undefined,
  };
}

/**
 * Normalize all sections in a paper.
 */
export function normalizeSections(sections: any[]): Section[] {
  if (!sections || !Array.isArray(sections)) return [];
  return sections.map((section, idx) => {
    try {
      return normalizeSection(section);
    } catch (e) {
      console.warn(`Failed to normalize section ${idx} (${section?.title || 'unknown'}):`, e);
      // Return a minimal valid section so the rest of the paper still works
      return {
        id: section?.id || `section-error-${idx}`,
        title: section?.title || `Section ${idx + 1}`,
        subtitle: section?.subtitle || '',
        icon: section?.icon || '⚠️',
        color: section?.color || 'text-red-600',
        bgColor: section?.bgColor || 'bg-red-50',
        description: 'This section could not be loaded properly. Please re-upload the paper.',
        questions: Array.isArray(section?.questions) ? section.questions.map((q: any, qIdx: number) => ({
          ...q,
          id: typeof q.id === 'string' ? parseInt(q.id, 10) : (q.id || qIdx),
        })) : [],
      };
    }
  });
}
