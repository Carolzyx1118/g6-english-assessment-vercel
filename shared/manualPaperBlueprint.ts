export type ManualSectionType =
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "grammar"
  | "vocabulary"
  | "math-multiple-choice"
  | "math-short-answer"
  | "math-application";

export const MANUAL_SECTION_TYPE_LABELS: Record<ManualSectionType, string> = {
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  "math-multiple-choice": "Multiple Choice",
  "math-short-answer": "Short Answer",
  "math-application": "Application",
};

export type ManualQuestionType = "mcq" | "fill-blank" | "passage-fill-blank" | "passage-mcq" | "typed-fill-blank" | "passage-open-ended" | "writing" | "passage-matching" | "speaking" | "true-false" | "heading-match" | "checkbox" | "ordering" | "sentence-reorder" | "inline-word-choice" | "passage-inline-word-choice" | "picture-spelling" | "word-completion";

export const MANUAL_QUESTION_TYPE_LABELS: Record<ManualQuestionType, string> = {
  mcq: "Multiple Choice",
  "fill-blank": "Word Bank Fill Blank",
  "passage-fill-blank": "Passage Word Bank Fill Blank",
  "passage-mcq": "Passage Multiple Choice",
  "typed-fill-blank": "Fill in Blank",
  "passage-open-ended": "Passage Open-Ended",
  writing: "Writing",
  "passage-matching": "Passage Matching",
  speaking: "Speaking",
  "true-false": "True / False / Not Given",
  "heading-match": "Passage Matching",
  checkbox: "Multi-select Checkbox",
  ordering: "Ordering / Sequencing",
  "sentence-reorder": "Put Words in Order",
  "inline-word-choice": "Click Correct Word",
  "passage-inline-word-choice": "Passage Click Correct Word",
  "picture-spelling": "Picture Spelling",
  "word-completion": "Word Completion",
};

export const MANUAL_QUESTION_TYPE_OPTIONS: Array<{
  value: ManualQuestionType;
  label: string;
  description: string;
}> = [
  { value: "mcq", label: "Multiple Choice", description: "Each question has its own options and can be single-answer or multi-answer." },
  { value: "fill-blank", label: "Word Bank Fill Blank", description: "Individual sentences with blanks, shared word bank." },
  { value: "typed-fill-blank", label: "Fill in Blank", description: "Individual questions with blanks — students type answers directly." },
  { value: "passage-fill-blank", label: "Passage Word Bank Fill Blank", description: "A full passage/article with numbered blanks and a shared word bank." },
  { value: "passage-mcq", label: "Passage Multiple Choice", description: "A passage with numbered blanks — click each blank to choose from MCQ options (PET-style cloze)." },
  { value: "passage-open-ended", label: "Passage Open-Ended", description: "A passage followed by open-ended questions — students read the article and type free-form answers (文章问答题)." },
  { value: "passage-matching", label: "Passage Matching", description: "Match prompts or paragraphs to the best option or heading. Optional passage text is supported." },
  { value: "writing", label: "Writing", description: "A writing task with optional image and prompt — students compose an essay or short text (写作题)." },
  { value: "speaking", label: "Speaking", description: "A speaking task with prompt, optional image, and student voice recording (口语录音题)." },
  { value: "true-false", label: "True / False / Not Given", description: "A reading-style statement block where students choose True, False, or Not Given." },
  { value: "ordering", label: "Ordering / Sequencing", description: "Students put events, steps, or sentences into the correct order." },
  { value: "sentence-reorder", label: "Put Words in Order", description: "Students rewrite scrambled words into a correct sentence, like PET grammar sentence-order tasks." },
  { value: "inline-word-choice", label: "Click Correct Word", description: "Students click the correct word directly inside each sentence, like choose-the-right-word grammar tasks." },
  { value: "passage-inline-word-choice", label: "Passage Click Correct Word", description: "Students click the correct word choices directly inside a full passage with multiple blanks." },
  { value: "picture-spelling", label: "Picture Spelling", description: "Show an image and let students spell the whole word one letter at a time." },
  { value: "word-completion", label: "Word Completion", description: "Show part of a word with underscores and let students complete the missing letters." },
];

export const MANUAL_QUESTION_TYPE_GROUPS: Array<{
  label: string;
  values: ManualQuestionType[];
}> = [
  {
    label: "Choice & Selection",
    values: ["mcq", "passage-mcq", "inline-word-choice", "passage-inline-word-choice", "true-false"],
  },
  {
    label: "Fill in the Blank",
    values: ["fill-blank", "typed-fill-blank", "passage-fill-blank"],
  },
  {
    label: "Matching & Ordering",
    values: ["passage-matching", "ordering", "sentence-reorder"],
  },
  {
    label: "Response Tasks",
    values: ["passage-open-ended", "writing", "speaking"],
  },
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
  correctAnswers?: string[];
  selectionLimit?: number;
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

export interface ManualPictureSpellingQuestion {
  id: string;
  type: "picture-spelling";
  prompt: string;
  image?: ManualOptionImage;
  correctAnswer: string;
}

export interface ManualWordCompletionQuestion {
  id: string;
  type: "word-completion";
  prompt: string;
  image?: ManualOptionImage;
  wordPattern: string;
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

/** Writing question — student writes an essay/composition based on a prompt */
export interface ManualWritingQuestion {
  id: string;
  type: "writing";
  /** The writing prompt/requirements, e.g. "Write a letter to your friend about your holiday." */
  prompt: string;
  /** Optional image for the writing task (e.g. a picture prompt) */
  image?: ManualOptionImage;
  /** Minimum word count suggestion (optional) */
  minWords?: number;
  /** Maximum word count suggestion (optional) */
  maxWords?: number;
  /** A model/reference answer for grading (optional) */
  referenceAnswer?: string;
}

/** Speaking question — student responds by recording audio */
export interface ManualSpeakingQuestion {
  id: string;
  type: "speaking";
  prompt: string;
  image?: ManualOptionImage;
}

export type ManualTruthValue = "true" | "false" | "not-given";

export interface ManualTrueFalseStatement {
  id: string;
  label: string;
  statement: string;
  correctAnswer: ManualTruthValue;
  explanation?: string;
}

export interface ManualTrueFalseQuestion {
  id: string;
  type: "true-false";
  prompt: string;
  statements: ManualTrueFalseStatement[];
  requiresReason?: boolean;
}

export interface ManualCheckboxOption {
  id: string;
  label: string;
  text: string;
}

export interface ManualCheckboxQuestion {
  id: string;
  type: "checkbox";
  prompt: string;
  options: ManualCheckboxOption[];
  correctAnswers: string[];
  selectionLimit?: number;
}

export interface ManualOrderingItem {
  id: string;
  text: string;
  correctPosition: number;
}

export interface ManualOrderingQuestion {
  id: string;
  type: "ordering";
  prompt: string;
  items: ManualOrderingItem[];
}

export interface ManualSentenceReorderItem {
  id: string;
  label: string;
  scrambledWords: string;
  correctAnswer: string;
}

export interface ManualSentenceReorderQuestion {
  id: string;
  type: "sentence-reorder";
  prompt: string;
  items: ManualSentenceReorderItem[];
}

export interface ManualInlineWordChoiceOption {
  id: string;
  label: string;
  text: string;
}

export interface ManualInlineWordChoiceItem {
  id: string;
  label: string;
  sentenceText?: string;
  beforeText: string;
  options: ManualInlineWordChoiceOption[];
  afterText: string;
  correctAnswer: string;
}

export interface ManualInlineWordChoiceQuestion {
  id: string;
  type: "inline-word-choice";
  prompt: string;
  items: ManualInlineWordChoiceItem[];
}

export interface ManualPassageInlineWordChoiceItem {
  id: string;
  label: string;
  options: ManualInlineWordChoiceOption[];
  correctAnswer: string;
}

export interface ManualPassageInlineWordChoiceQuestion {
  id: string;
  type: "passage-inline-word-choice";
  prompt: string;
  items: ManualPassageInlineWordChoiceItem[];
}

/** A labeled description item in a passage-matching subsection (e.g. "A - Marina") */
export interface ManualMatchingDescription {
  id: string;
  /** Label like "A", "B", "C", etc. */
  label: string;
  /** The name/title of the description */
  name: string;
  /** The full description text */
  text: string;
}

/** Passage matching — match person descriptions to labeled descriptions (PET Reading Part 2) */
export interface ManualPassageMatchingQuestion {
  id: string;
  type: "passage-matching";
  /** The person description with criteria, e.g. "Thomas and his sister enjoy eating French food..." */
  prompt: string;
  /** The label of the correct matching description, e.g. "D" */
  correctAnswer: string;
}

export interface ManualHeadingMatchQuestion {
  id: string;
  type: "heading-match";
  /** The paragraph / passage excerpt students should match */
  prompt: string;
  /** The label of the correct heading option, e.g. "1" */
  correctAnswer: string;
}

export type ManualQuestion = ManualMCQQuestion | ManualFillBlankQuestion | ManualPassageFillBlankQuestion | ManualPassageMCQQuestion | ManualTypedFillBlankQuestion | ManualPictureSpellingQuestion | ManualWordCompletionQuestion | ManualPassageOpenEndedQuestion | ManualWritingQuestion | ManualPassageMatchingQuestion | ManualSpeakingQuestion | ManualTrueFalseQuestion | ManualCheckboxQuestion | ManualOrderingQuestion | ManualHeadingMatchQuestion | ManualSentenceReorderQuestion | ManualInlineWordChoiceQuestion | ManualPassageInlineWordChoiceQuestion;

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
  taskDescription?: string;
  sceneImage?: ManualOptionImage;
  questionType: ManualQuestionType;
  questions: ManualQuestion[];
  wordBank?: ManualWordBankItem[];
  /** Full passage text for passage-fill-blank, passage-mcq, passage-inline-word-choice, and passage-open-ended types. Use ___ to mark blanks where applicable. */
  passageText?: string;
  /** Audio file for listening sections — each big question can have its own audio clip */
  audio?: ManualAudioFile;
  /** Labeled descriptions for passage-matching type (A-H descriptions of places/items) */
  matchingDescriptions?: ManualMatchingDescription[];
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
