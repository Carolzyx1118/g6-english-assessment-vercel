import type { MCQQuestion } from "@/data/papers";

export type InlineClozeGapEntry = {
  gapNumber: number;
  question: MCQQuestion;
};

function extractPassageGapNumbers(passage?: string) {
  if (!passage) return [];
  return Array.from(passage.matchAll(/\((\d+)\)\s*___/g))
    .map((match) => Number.parseInt(match[1] || "", 10))
    .filter((value) => Number.isFinite(value));
}

function extractQuestionGapNumber(question: MCQQuestion, fallback: number) {
  const match = question.question.match(/(\d+)/);
  const parsed = match ? Number.parseInt(match[1], 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildInlineClozeGapEntries(passage: string | undefined, questions: MCQQuestion[]): InlineClozeGapEntry[] {
  if (questions.length === 0) return [];

  const passageGapNumbers = extractPassageGapNumbers(passage);
  if (passageGapNumbers.length > 0) {
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const idMatchedEntries = passageGapNumbers.flatMap((gapNumber) => {
      const question = questionById.get(gapNumber);
      return question ? [{ gapNumber, question }] : [];
    });

    if (idMatchedEntries.length === passageGapNumbers.length) {
      return idMatchedEntries;
    }
  }

  if (passageGapNumbers.length === questions.length) {
    return passageGapNumbers.map((gapNumber, index) => ({
      gapNumber,
      question: questions[index]!,
    }));
  }

  return questions.map((question, index) => ({
    gapNumber: extractQuestionGapNumber(question, index + 1),
    question,
  }));
}
