// Multi-Paper System - Shared Types and Paper Registry

// ===== Question Type Interfaces =====

/** Picture-based MCQ: student sees images as options (a/b/c) */
export interface PictureMCQ {
  id: number;
  type: 'picture-mcq';
  question: string;
  options: { label: string; imageUrl: string; text?: string }[];
  correctAnswer: number;
  correctAnswers?: number[];
  selectionLimit?: number;
}

/** Standard text MCQ with optional scene image */
export interface MCQQuestion {
  id: number;
  type: 'mcq';
  question: string;
  highlightWord?: string;
  options: string[];
  correctAnswer: number | string;
  imageUrl?: string;
  correctAnswers?: number[];
  selectionLimit?: number;
}

/** Fill-in-the-blank with word bank */
export interface FillBlankQuestion {
  id: number;
  type: 'fill-blank';
  question?: string; // sentence with ___ for the blank or inline input prompt
  correctAnswer: string;
}

export interface PictureSpellingQuestion {
  id: number;
  type: 'picture-spelling';
  question: string;
  correctAnswer: string;
  imageUrl?: string;
}

export interface WordCompletionQuestion {
  id: number;
  type: 'word-completion';
  question: string;
  imageUrl?: string;
  wordPattern: string;
  correctAnswer: string;
}

/** Listening picture MCQ */
export interface ListeningMCQ {
  id: number;
  type: 'listening-mcq';
  question: string;
  options: { label: string; imageUrl: string; text?: string }[];
  correctAnswer: number;
  correctAnswers?: number[];
  selectionLimit?: number;
}

/** Word-bank fill-in for reading */
export interface WordBankFillIn {
  id: number;
  type: 'wordbank-fill';
  question: string;
  correctAnswer: string;
}

/** Story comprehension fill-in */
export interface StoryFillIn {
  id: number;
  type: 'story-fill';
  question: string;
  correctAnswer: string;
  acceptableAnswers?: string[];
}

/** Open-ended question */
export interface OpenEndedQuestion {
  id: number;
  type: 'open-ended';
  question: string;
  subQuestions?: { label: string; question: string; answer: string }[];
  answer?: string;
  correctAnswer?: string;
  imageUrl?: string;
  responseMode?: 'text' | 'audio';
}

/** True/False question */
export interface TrueFalseQuestion {
  id: number;
  type: 'true-false';
  question?: string;
  statements: {
    label: string;
    statement: string;
    isTrue?: boolean;
    correctChoice?: 'True' | 'False' | 'Not Given';
    reason?: string;
    explanation?: string;
  }[];
  choices?: Array<'True' | 'False' | 'Not Given'>;
  requiresReason?: boolean;
}

/** Table question */
export interface TableQuestion {
  id: number;
  type: 'table';
  question: string;
  rows: { situation: string; thought: string; action: string; blankField: 'thought' | 'action'; answer: string }[];
}

/** Reference question */
export interface ReferenceQuestion {
  id: number;
  type: 'reference';
  question: string;
  items: { word: string; lineRef: string; answer: string }[];
}

/** Order question */
export interface OrderQuestion {
  id: number;
  type: 'order';
  question: string;
  events: string[];
  correctOrder: number[];
}

/** Phrase question */
export interface PhraseQuestion {
  id: number;
  type: 'phrase';
  question: string;
  items: { clue: string; answer: string }[];
}

/** Sentence reordering / unscramble question */
export interface SentenceReorderQuestion {
  id: number;
  type: 'sentence-reorder';
  question: string;
  items: { label: string; scrambledWords: string; correctAnswer: string }[];
}

/** Inline word-choice question */
export interface InlineWordChoiceQuestion {
  id: number;
  type: 'inline-word-choice';
  question: string;
  items: { label: string; sentenceText?: string; beforeText: string; options: string[]; afterText: string; correctAnswer: number }[];
}

/** Passage inline word-choice question */
export interface PassageInlineWordChoiceQuestion {
  id: number;
  type: 'passage-inline-word-choice';
  question: string;
  passageText: string;
  items: { label: string; options: string[]; correctAnswer: number }[];
}

/** Checkbox question */
export interface CheckboxQuestion {
  id: number;
  type: 'checkbox';
  question: string;
  options: string[];
  correctAnswers: number[];
  selectionLimit?: number;
}

/** Writing question */
export interface WritingQuestion {
  id: number;
  type: 'writing';
  topic: string;
  instructions: string;
  wordCount: string;
  prompts: string[];
  imageUrl?: string;
  minWords?: number;
  maxWords?: number;
  referenceAnswer?: string;
}

export interface ManualQuestionBlock {
  id: string;
  displayNumber: number;
  questionType?: string;
  instructions?: string;
  taskDescription?: string;
  questionIds: number[];
  passage?: string;
  wordBank?: { letter: string; word: string }[];
  grammarPassage?: string;
  audioUrl?: string;
  sceneImageUrl?: string;
  inlineCloze?: boolean;
  matchingDescriptions?: { label: string; name: string; text: string }[];
}

// Union of all question types
export type Question =
  | PictureMCQ
  | MCQQuestion
  | FillBlankQuestion
  | PictureSpellingQuestion
  | WordCompletionQuestion
  | ListeningMCQ
  | WordBankFillIn
  | StoryFillIn
  | OpenEndedQuestion
  | TrueFalseQuestion
  | TableQuestion
  | ReferenceQuestion
  | OrderQuestion
  | PhraseQuestion
  | SentenceReorderQuestion
  | InlineWordChoiceQuestion
  | PassageInlineWordChoiceQuestion
  | CheckboxQuestion
  | WritingQuestion;

// Section definition
export interface Section {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  taskDescription?: string;
  questions: Question[];
  passage?: string;
  wordBank?: { letter: string; word: string }[];
  grammarPassage?: string;
  imageUrl?: string;
  audioUrl?: string;
  sceneImageUrl?: string;
  sectionType?:
    | 'reading'
    | 'listening'
    | 'writing'
    | 'speaking'
    | 'grammar'
    | 'vocabulary'
    | 'math-multiple-choice'
    | 'math-short-answer'
    | 'math-application';
  inlineCloze?: boolean;
  matchingDescriptions?: { label: string; name: string; text: string }[];
  manualBlocks?: ManualQuestionBlock[];
  wordBankImageUrl?: string;
  storyImages?: string[];
  storyParagraphs?: { text: string; questionIds: number[] }[];
}

// Paper definition
export type PaperSubject = 'english' | 'math' | 'vocabulary';
export type PaperCategory = 'assessment' | 'practice' | 'memorization';

export const PAPER_SUBJECT_ORDER: PaperSubject[] = ['english', 'math', 'vocabulary'];

export const PAPER_SUBJECT_LABELS: Record<PaperSubject, string> = {
  english: 'English',
  math: 'Math',
  vocabulary: 'Vocabulary',
};

export const PAPER_CATEGORY_LABELS: Record<PaperCategory, string> = {
  assessment: 'Assessment',
  practice: 'Practice',
  memorization: 'Memorization',
};

export interface Paper {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  subject: PaperSubject;
  category: PaperCategory;
  tags?: string[];
  hiddenFromStudentSelection?: boolean;
  isGeneratedPaper?: boolean;
  generationWarnings?: string[];
  sections: Section[];
  readingWordBank?: { word: string; imageUrl: string }[];
  totalQuestions: number;
  hasListening: boolean;
  hasWriting: boolean;
}

// Helper to get total auto-gradable questions count for a paper
export function getAutoGradableCount(paper: Paper): number {
  let count = 0;
  for (const section of paper.sections) {
    for (const q of section.questions) {
      if (
        q.type === 'mcq' ||
        q.type === 'picture-mcq' ||
        q.type === 'listening-mcq' ||
        q.type === 'fill-blank' ||
        q.type === 'wordbank-fill' ||
        q.type === 'story-fill' ||
        q.type === 'checkbox' ||
        q.type === 'sentence-reorder' ||
        q.type === 'inline-word-choice' ||
        q.type === 'passage-inline-word-choice' ||
        q.type === 'true-false' ||
        q.type === 'order'
      ) {
        count++;
      }
    }
  }
  return count;
}

// Paper registry - import and register all papers here
import { widaPaper } from './wida-paper';
import { huazhongPaper } from './huazhong-paper';
import { petPaper } from './pet-paper';

export const papers: Paper[] = [widaPaper, huazhongPaper, petPaper];

export function getPaperById(id: string): Paper | undefined {
  return papers.find((p) => p.id === id);
}

export function getAvailablePaperSubjects(availablePapers: Paper[]): PaperSubject[] {
  return PAPER_SUBJECT_ORDER.filter((subject) => availablePapers.some((paper) => paper.subject === subject));
}
