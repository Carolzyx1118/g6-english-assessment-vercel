import type { Paper } from '@/data/papers';

type PaperReadinessInput = Pick<Paper, 'sections' | 'totalQuestions'> & {
  generationWarnings?: string[];
};

export function isPaperReadyToStart(paper: PaperReadinessInput): boolean {
  return paper.sections.length > 0 && paper.totalQuestions > 0;
}

export function getPaperReadinessMessage(paper: PaperReadinessInput): string {
  if (paper.generationWarnings?.length) {
    return paper.generationWarnings[0];
  }

  return 'Add question counts and matching tagged question-bank items first.';
}
