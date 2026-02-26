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
 * 5. Ensure all question IDs are numbers (not strings)
 * 6. Normalize wordBank letter format (ensure uppercase single letters)
 * 7. Handle missing/empty section fields gracefully
 */

import type { Section, Question, TrueFalseQuestion, OpenEndedQuestion, FillBlankQuestion } from '@/data/papers';

/**
 * Normalize a grammarPassage to use the standard blank format: <b>(N) ___</b>
 * Handles various AI-generated formats:
 *   (21)___________
 *   (21) ___
 *   (21)________
 *   <b>(21)___</b>
 *   <b>(21) ___</b>  (already correct)
 *   ____(21)____
 */
function normalizeGrammarPassage(passage: string): string {
  if (!passage) return passage;
  
  // Replace various blank formats with the standard format
  // Pattern: optional <b>, then (number), then optional whitespace and underscores, then optional </b>
  return passage.replace(
    /(?:<b>)?\((\d+)\)\s*_+(?:<\/b>)?/g,
    '<b>($1) ___</b>'
  );
}

/**
 * Extract individual sentences from a grammarPassage for fill-blank questions
 * that don't have their own `question` field.
 * 
 * For passage-based fill-blanks, we extract the sentence containing each blank
 * so the question has context even when displayed individually (e.g., in results).
 */
function extractSentencesFromPassage(passage: string, questionIds: number[]): Map<number, string> {
  const result = new Map<number, string>();
  if (!passage) return result;
  
  // Strip HTML tags for plain text analysis
  const plainText = passage.replace(/<[^>]+>/g, '');
  
  for (const qId of questionIds) {
    // Find the sentence containing this question's blank marker
    const regex = new RegExp(`[^.!?]*\\(${qId}\\)[^.!?]*[.!?]`, 'g');
    const match = plainText.match(regex);
    if (match) {
      // Replace the blank marker with ___
      const sentence = match[0].trim().replace(new RegExp(`\\(${qId}\\)\\s*_*`), '___');
      result.set(qId, sentence);
    }
  }
  
  return result;
}

/**
 * Normalize a true-false question from AI format to component format.
 * 
 * Handles multiple AI output patterns:
 * 
 * Pattern 1 (correct): { statements: [{label, statement, isTrue, reason}] }
 * Pattern 2 (separate arrays): { statements: ["a) Stmt"], trueFalseStatements: ["a) False"], reasons: ["reason"] }
 * Pattern 3 (string array): { statements: ["a) Statement 1", "b) Statement 2"] }
 * Pattern 4 (mixed): { statements: [{statement: "...", isTrue: true}] } (missing label/reason)
 */
function normalizeTrueFalse(q: any): TrueFalseQuestion {
  // Check if already in correct format
  if (
    q.statements?.length > 0 &&
    typeof q.statements[0] === 'object' &&
    'label' in q.statements[0] &&
    'statement' in q.statements[0] &&
    'isTrue' in q.statements[0]
  ) {
    // Ensure reason field exists
    const statements = q.statements.map((s: any, idx: number) => ({
      label: s.label || String.fromCharCode(97 + idx),
      statement: s.statement,
      isTrue: !!s.isTrue,
      reason: s.reason || '',
    }));
    return { id: q.id, type: 'true-false', statements };
  }
  
  // Pattern 4: objects but missing some fields
  if (q.statements?.length > 0 && typeof q.statements[0] === 'object') {
    const statements = q.statements.map((s: any, idx: number) => ({
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
    // Extract label and statement text from "a) Statement text" or "a. Statement text"
    const stmtMatch = rawStatements[i].match(/^([a-z])[.)]\s*(.+)$/i);
    const label = stmtMatch ? stmtMatch[1].toLowerCase() : String.fromCharCode(97 + i);
    const statement = stmtMatch ? stmtMatch[2] : rawStatements[i];
    
    // Extract true/false from various formats
    let isTrue = false;
    if (rawTF[i]) {
      const tfText = rawTF[i].toLowerCase();
      // Handle "a) True", "True", "a) False", "False"
      isTrue = /true/i.test(tfText);
    }
    
    const reason = rawReasons[i] || '';
    
    statements.push({ label, statement, isTrue, reason });
  }
  
  return {
    id: q.id,
    type: 'true-false',
    statements,
  };
}

/**
 * Normalize an open-ended question's subQuestions.
 * 
 * Handles:
 * - Already correct: [{label, question, answer}]
 * - String array: ["a", "b"] or ["What is...?", "Why did...?"]
 * - Mixed: [{label: "a"}] (missing question/answer fields)
 */
function normalizeOpenEnded(q: any): OpenEndedQuestion {
  if (!q.subQuestions || q.subQuestions.length === 0) {
    return q as OpenEndedQuestion;
  }
  
  // Already in correct format
  if (
    typeof q.subQuestions[0] === 'object' &&
    'label' in q.subQuestions[0] &&
    'question' in q.subQuestions[0]
  ) {
    // Ensure answer field exists
    const subs = q.subQuestions.map((s: any) => ({
      label: s.label,
      question: s.question || '',
      answer: s.answer || '',
    }));
    return { ...q, subQuestions: subs };
  }
  
  // Convert string array to object array
  const normalizedSubs = q.subQuestions.map((sub: any, idx: number) => {
    if (typeof sub === 'string') {
      // Check if the string is just a label like "a" or "b"
      const isJustLabel = /^[a-z]$/i.test(sub.trim());
      if (isJustLabel) {
        return { label: sub.trim().toLowerCase(), question: '', answer: '' };
      }
      // Otherwise it might be a question text
      return { label: String.fromCharCode(97 + idx), question: sub, answer: '' };
    }
    // Object but missing fields
    if (typeof sub === 'object') {
      return {
        label: sub.label || String.fromCharCode(97 + idx),
        question: sub.question || sub.text || '',
        answer: sub.answer || '',
      };
    }
    return { label: String.fromCharCode(97 + idx), question: '', answer: '' };
  });
  
  return {
    ...q,
    subQuestions: normalizedSubs,
  };
}

/**
 * Normalize fill-blank questions to ensure they have a `question` field.
 * If the section has a grammarPassage, extract sentences for each blank.
 */
function normalizeFillBlanks(questions: any[], grammarPassage?: string): any[] {
  const fillBlanks = questions.filter(q => q.type === 'fill-blank');
  
  if (fillBlanks.length === 0) return questions;
  
  // If there's a grammar passage, extract sentences for questions without `question` field
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
 * Ensures letters are uppercase single characters and words are trimmed.
 */
function normalizeWordBank(wordBank: any[] | undefined): { letter: string; word: string }[] | undefined {
  if (!wordBank || !Array.isArray(wordBank)) return wordBank;
  
  return wordBank.map((item, idx) => {
    if (typeof item === 'string') {
      // Handle case where wordBank is just an array of words
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
 * Ensures all question data matches the expected component interfaces.
 */
function normalizeQuestions(questions: any[], grammarPassage?: string): Question[] {
  if (!questions || !Array.isArray(questions)) return [];
  
  // First normalize fill-blanks (may need passage context)
  let normalized = normalizeFillBlanks(questions, grammarPassage);
  
  // Then normalize individual question types
  return normalized.map(q => {
    // Ensure ID is a number
    const id = typeof q.id === 'string' ? parseInt(q.id, 10) : q.id;
    
    switch (q.type) {
      case 'true-false':
        return { ...normalizeTrueFalse(q), id };
      case 'open-ended':
        return { ...normalizeOpenEnded(q), id };
      case 'mcq':
        // Ensure correctAnswer is a number
        return { ...q, id, correctAnswer: typeof q.correctAnswer === 'string' ? parseInt(q.correctAnswer, 10) : q.correctAnswer };
      case 'checkbox':
        // Ensure correctAnswers are numbers
        return { ...q, id, correctAnswers: (q.correctAnswers || []).map((a: any) => typeof a === 'string' ? parseInt(a, 10) : a) };
      default:
        return { ...q, id };
    }
  });
}

/**
 * Normalize an entire section.
 * This is the main entry point - call this on each section from a custom paper.
 */
export function normalizeSection(section: any): Section {
  // Normalize grammar passage format
  const grammarPassage = section.grammarPassage 
    ? normalizeGrammarPassage(section.grammarPassage)
    : section.grammarPassage;
  
  // Normalize word bank
  const wordBank = normalizeWordBank(section.wordBank);
  
  // Normalize all questions
  const questions = normalizeQuestions(section.questions, grammarPassage);
  
  // Ensure required section fields have defaults
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
  return sections.map(normalizeSection);
}
