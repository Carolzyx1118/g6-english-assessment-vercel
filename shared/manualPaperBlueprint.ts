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
  description: string;
}> = [
  { value: "mcq", label: "Multiple Choice", description: "Each question has its own set of options." },
  { value: "fill-blank", label: "Word Bank Fill Blank", description: "Individual sentences with blanks, shared word bank." },
  { value: "passage-fill-blank", label: "Passage Word Bank Fill Blank", description: "A full passage/article with numbered blanks and a shared word bank." },
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

export interface ManualPassageFillBlankQuestion {
  id: string;
  type: "passage-fill-blank";
  /** Not used for passage type — the passage text is on the subsection */
  prompt: string;
  correctAnswerWordBankId: string;
}

export type ManualQuestion = ManualMCQQuestion | ManualFillBlankQuestion | ManualPassageFillBlankQuestion;

export interface ManualSubsection {
  id: string;
  title: string;
  instructions: string;
  sceneImage?: ManualOptionImage;
  questionType: ManualQuestionType;
  questions: ManualQuestion[];
  wordBank?: ManualWordBankItem[];
  /** Full passage text for passage-fill-blank type. Use ___ to mark blanks. */
  passageText?: string;
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
