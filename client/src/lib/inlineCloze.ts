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

function buildEntriesFromQuestionIds(passageGapNumbers: number[], questions: MCQQuestion[]) {
  if (passageGapNumbers.length === 0 || questions.length === 0) {
    return null;
  }

  const questionById = new Map(questions.map((question) => [question.id, question]));
  const matchedQuestions = passageGapNumbers
    .map((gapNumber) => questionById.get(gapNumber))
    .filter((question): question is MCQQuestion => Boolean(question));

  if (matchedQuestions.length !== passageGapNumbers.length) {
    return null;
  }

  return passageGapNumbers.map((gapNumber, index) => ({
    gapNumber,
    question: matchedQuestions[index]!,
  }));
}

function extractQuestionGapNumber(question: MCQQuestion, fallback: number) {
  const match = question.question.match(/(\d+)/);
  const parsed = match ? Number.parseInt(match[1], 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildEntriesFromOrderedQuestionIds(
  passageGapNumbers: number[],
  orderedQuestionIds: number[] | undefined,
  questions: MCQQuestion[],
) {
  if (!orderedQuestionIds || passageGapNumbers.length !== orderedQuestionIds.length) {
    return null;
  }

  const questionById = new Map(questions.map((question) => [question.id, question]));
  const orderedQuestions = orderedQuestionIds
    .map((questionId) => questionById.get(questionId))
    .filter((question): question is MCQQuestion => Boolean(question));

  if (orderedQuestions.length !== passageGapNumbers.length) {
    return null;
  }

  return passageGapNumbers.map((gapNumber, index) => ({
    gapNumber,
    question: orderedQuestions[index]!,
  }));
}

function buildEntriesFromQuestionPromptNumbers(passageGapNumbers: number[], questions: MCQQuestion[]) {
  if (passageGapNumbers.length !== questions.length) {
    return null;
  }

  const withPromptNumbers = questions.map((question, index) => ({
    question,
    promptNumber: extractQuestionGapNumber(question, index + 1),
  }));

  const uniquePromptNumbers = new Set(withPromptNumbers.map((entry) => entry.promptNumber));
  if (uniquePromptNumbers.size !== questions.length) {
    return null;
  }

  const orderedQuestions = [...withPromptNumbers]
    .sort((left, right) => left.promptNumber - right.promptNumber)
    .map((entry) => entry.question);

  return passageGapNumbers.map((gapNumber, index) => ({
    gapNumber,
    question: orderedQuestions[index]!,
  }));
}

export function buildInlineClozeGapEntries(
  passage: string | undefined,
  questions: MCQQuestion[],
  orderedQuestionIds?: number[],
): InlineClozeGapEntry[] {
  if (questions.length === 0) return [];

  const passageGapNumbers = extractPassageGapNumbers(passage);
  const questionIdEntries = buildEntriesFromQuestionIds(passageGapNumbers, questions);
  if (questionIdEntries) {
    return questionIdEntries;
  }

  const orderedIdEntries = buildEntriesFromOrderedQuestionIds(passageGapNumbers, orderedQuestionIds, questions);
  if (orderedIdEntries) {
    return orderedIdEntries;
  }

  const promptNumberEntries = buildEntriesFromQuestionPromptNumbers(passageGapNumbers, questions);
  if (promptNumberEntries) {
    return promptNumberEntries;
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
