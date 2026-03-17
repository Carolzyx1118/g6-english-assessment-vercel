export interface SpeakingQuestionEvaluation {
  sectionId: string;
  sectionTitle: string;
  questionId: number;
  prompt: string;
  audioUrl: string;
  transcript: string;
  score: number;
  maxScore: number;
  grade: string;
  feedback_en: string;
  feedback_cn: string;
  taskCompletion_en: string;
  taskCompletion_cn: string;
  fluency_en: string;
  fluency_cn: string;
  vocabulary_en: string;
  vocabulary_cn: string;
  grammar_en: string;
  grammar_cn: string;
  pronunciation_en: string;
  pronunciation_cn: string;
  suggestions_en: string[];
  suggestions_cn: string[];
  reviewMode?: "ai" | "manual";
  manualReviewRequired?: boolean;
}

export interface SpeakingEvaluationResult {
  totalScore: number;
  totalPossible: number;
  grade: string;
  overallFeedback_en: string;
  overallFeedback_cn: string;
  evaluations: SpeakingQuestionEvaluation[];
  reviewMode?: "ai" | "manual";
  manualReviewRequired?: boolean;
}

export interface AssessmentSectionInsight {
  sectionId: string;
  sectionTitle: string;
  summary_en: string;
  summary_cn: string;
}

export interface AssessmentStudyPlanStage {
  stage_en: string;
  stage_cn: string;
  focus_en: string;
  focus_cn: string;
  actions_en: string[];
  actions_cn: string[];
}

export interface AssessmentReportResult {
  languageLevel: string;
  summary_en: string;
  summary_cn: string;
  strengths_en: string[];
  strengths_cn: string[];
  weaknesses_en: string[];
  weaknesses_cn: string[];
  recommendations_en: string[];
  recommendations_cn: string[];
  timeAnalysis_en: string;
  timeAnalysis_cn: string;
  reportTitle_en: string;
  reportTitle_cn: string;
  overallSummary_en: string;
  overallSummary_cn: string;
  abilitySnapshot_en: string[];
  abilitySnapshot_cn: string[];
  sectionInsights: AssessmentSectionInsight[];
  studyPlan: AssessmentStudyPlanStage[];
  parentFeedback_en: string;
  parentFeedback_cn: string;
  speakingEvaluation: SpeakingEvaluationResult | null;
}
