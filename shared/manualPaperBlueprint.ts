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

export type ManualQuestionType = "mcq";

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
  type: ManualQuestionType;
  prompt: string;
  options: ManualMCQOption[];
  correctAnswer: string;
}

export interface ManualSubsection {
  id: string;
  title: string;
  instructions: string;
  questions: ManualMCQQuestion[];
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
