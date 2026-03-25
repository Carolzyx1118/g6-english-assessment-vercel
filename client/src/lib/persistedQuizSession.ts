import type { Paper } from "@/data/papers";
import type { StudentInfo } from "@/contexts/QuizContext";

export interface PersistedQuizState {
  currentSectionIndex: number;
  answers: Record<string, string | number | number[]>;
  submitted: boolean;
  startTime: number | null;
  endTime: number | null;
}

export interface PersistedQuizSession {
  version: 2;
  username: string;
  selectedPaperId: string | null;
  selectedPaperSnapshot: Paper | null;
  state: PersistedQuizState;
  isStarted: boolean;
  studentInfo: StudentInfo | null;
}
