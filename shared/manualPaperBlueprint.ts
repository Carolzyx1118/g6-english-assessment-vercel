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

export type ManualQuestionType = "mcq" | "fill-blank" | "passage-fill-blank" | "passage-mcq" | "typed-fill-blank" | "passage-open-ended";

export const MANUAL_QUESTION_TYPE_LABELS: Record<ManualQuestionType, string> = {
  mcq: "Multiple Choice",
  "fill-blank": "Word Bank Fill Blank",
  "passage-fill-blank": "Passage Word Bank Fill Blank",
  "passage-mcq": "Passage Multiple Choice",
  "typed-fill-blank": "Fill in Blank",
  "passage-open-ended": "Passage Open-Ended",
};

export const MANUAL_QUESTION_TYPE_OPTIONS: Array<{
  value: ManualQuestionType;
  label: string;
  description: string;
}> = [
  { value: "mcq", label: "Multiple Choice", description: "Each question has its own set of options." },
  { value: "fill-blank", label: "Word Bank Fill Blank", description: "Individual sentences with blanks, shared word bank." },
  { value: "typed-fill-blank", label: "Fill in Blank", description: "Individual questions with blanks — students type answers directly." },
  { value: "passage-fill-blank", label: "Passage Word Bank Fill Blank", description: "A full passage/article with numbered blanks and a shared word bank." },
  { value: "passage-mcq", label: "Passage Multiple Choice", description: "A passage with numbered blanks — click each blank to choose from MCQ options (PET-style cloze)." },
  { value: "passage-open-ended", label: "Passage Open-Ended", description: "A passage followed by open-ended questions — students read the article and type free-form answers (文章问答题)." },
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

/** Each blank in a passage-mcq has its own set of MCQ options */
export interface ManualPassageMCQOption {
  id: string;
  label: string; // "A", "B", "C", "D"
  text: string;
}

export interface ManualPassageMCQQuestion {
  id: string;
  type: "passage-mcq";
  /** Label like "Blank 1", "Blank 2" — auto-generated from passage */
  prompt: string;
  options: ManualPassageMCQOption[];
  correctAnswer: string; // label of the correct option, e.g. "A"
}

/** Fill in blank — student types the answer directly (no word bank) */
export interface ManualTypedFillBlankQuestion {
  id: string;
  type: "typed-fill-blank";
  /** The sentence/question with ___ marking the blank */
  prompt: string;
  /** The correct answer text that should go in the blank */
  correctAnswer: string;
}

/** Passage open-ended — student reads a passage then answers free-form questions */
export interface ManualPassageOpenEndedQuestion {
  id: string;
  type: "passage-open-ended";
  /** The question text, e.g. "What is the main idea of the passage?" */
  prompt: string;
  /** A reference/model answer for grading (optional — teacher may grade manually) */
  referenceAnswer: string;
}

export type ManualQuestion = ManualMCQQuestion | ManualFillBlankQuestion | ManualPassageFillBlankQuestion | ManualPassageMCQQuestion | ManualTypedFillBlankQuestion | ManualPassageOpenEndedQuestion;

/** Audio file attached to a subsection (used for listening sections) */
export interface ManualAudioFile {
  /** Base64 data URL for local fallback */
  dataUrl: string;
  /** Uploaded CDN URL (preferred for playback) */
  previewUrl?: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ManualSubsection {
  id: string;
  title: string;
  instructions: string;
  sceneImage?: ManualOptionImage;
  questionType: ManualQuestionType;
  questions: ManualQuestion[];
  wordBank?: ManualWordBankItem[];
  /** Full passage text for passage-fill-blank, passage-mcq, and passage-open-ended types. Use ___ to mark blanks (for fill/mcq types). */
  passageText?: string;
  /** Audio file for listening sections — each big question can have its own audio clip */
  audio?: ManualAudioFile;
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
