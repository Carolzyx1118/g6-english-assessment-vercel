export type ManualSectionType =
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "grammar"
  | "vocabulary";

export const MANUAL_SECTION_TYPE_LABELS: Record<ManualSectionType, string> = {
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
};

export type ManualQuestionType = "mcq" | "fill-blank" | "passage-fill-blank";

export const MANUAL_QUESTION_TYPE_LABELS: Record<ManualQuestionType, string> = {
  mcq: "Multiple Choice",
  "fill-blank": "Word Bank Fill Blank",
  "passage-fill-blank": "Passage Word Bank Fill Blank",
};

export const MANUAL_QUESTION_TYPE_OPTIONS: Array<{
  value: ManualQuestionType;
  label: string;
}> = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "fill-blank", label: "Word Bank Fill Blank" },
  { value: "passage-fill-blank", label: "Passage Word Bank Fill Blank" },
];

export interface ManualOptionImage {
  dataUrl: string;
  previewUrl?: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ManualMCQOption {
  id: string;
  label: string;
  text: string;
  image?: ManualOptionImage;
}

export interface ManualMCQQuestion {
  id: string;
  type: "mcq";
  prompt: string;
  options: ManualMCQOption[];
  correctAnswer: string;
}

export interface ManualWordBankItem {
  id: string;
  letter: string;
  word: string;
}

export interface ManualFillBlankQuestion {
  id: string;
  type: "fill-blank";
  prompt: string;
  correctAnswerWordBankId: string;
}

export type ManualQuestion = ManualMCQQuestion | ManualFillBlankQuestion;

export interface ManualSubsection {
  id: string;
  title: string;
  instructions: string;
  sceneImage?: ManualOptionImage;
  passageText?: string;
  questionType: ManualQuestionType;
  questions: ManualQuestion[];
  wordBank?: ManualWordBankItem[];
}

export interface ManualSection {
  id: string;
  sectionType: ManualSectionType;
  subsections: ManualSubsection[];
}

export interface ManualPaperBlueprint {
  id: string;
  title: string;
  description: string;
  sections: Array<ManualSection & { partLabel: string }>;
  createdAt: string;
}
