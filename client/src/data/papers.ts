// Multi-Paper System - Shared Types and Paper Registry

// ===== Question Type Interfaces =====

/** Picture-based MCQ: student sees images as options (a/b/c) */
export interface PictureMCQ {
  id: number;
  type: 'picture-mcq';
  question: string;
  options: { label: string; imageUrl: string; text?: string }[];
  correctAnswer: number;
}

/** Standard text MCQ with optional scene image */
export interface MCQQuestion {
  id: number;
  type: 'mcq';
  question: string;
  highlightWord?: string;
  options: string[];
  correctAnswer: number;
  imageUrl?: string;
}

/** Fill-in-the-blank with word bank */
export interface FillBlankQuestion {
  id: number;
  type: 'fill-blank';
  question?: string; // sentence with ___ for the blank (used by custom papers)
  correctAnswer: string;
}

/** Listening picture MCQ */
export interface ListeningMCQ {
  id: number;
  type: 'listening-mcq';
  question: string;
  options: { label: string; imageUrl: string; text?: string }[];
  correctAnswer: number;
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
}

/** True/False question */
export interface TrueFalseQuestion {
  id: number;
  type: 'true-false';
  statements: { label: string; statement: string; isTrue: boolean; reason: string }[];
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

/** Checkbox question */
export interface CheckboxQuestion {
  id: number;
  type: 'checkbox';
  question: string;
  options: string[];
  correctAnswers: number[];
}

/** Writing question */
export interface WritingQuestion {
  id: number;
  type: 'writing';
  topic: string;
  instructions: string;
  wordCount: string;
  prompts: string[];
}

// Union of all question types
export type Question =
  | PictureMCQ
  | MCQQuestion
  | FillBlankQuestion
  | ListeningMCQ
  | WordBankFillIn
  | StoryFillIn
  | OpenEndedQuestion
  | TrueFalseQuestion
  | TableQuestion
  | ReferenceQuestion
  | OrderQuestion
  | PhraseQuestion
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
  questions: Question[];
  passage?: string;
  wordBank?: { letter: string; word: string }[];
  grammarPassage?: string;
  imageUrl?: string;
  audioUrl?: string;
  sceneImageUrl?: string;
  wordBankImageUrl?: string;
  storyImages?: string[];
  storyParagraphs?: { text: string; questionIds: number[] }[];
}

// Paper definition
export interface Paper {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
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
        q.type === 'checkbox'
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

export const papers: Paper[] = [widaPaper, huazhongPaper];

export function getPaperById(id: string): Paper | undefined {
  return papers.find((p) => p.id === id);
}
