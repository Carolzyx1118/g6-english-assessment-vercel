export interface WordPatternToken {
  kind: "text" | "blank";
  value: string;
}

export function normalizeVocabularyAnswer(value: string) {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

export function getPictureSpellingCharacters(answer: string) {
  return Array.from(answer.replace(/\s+/g, ""));
}

export function parseWordPattern(pattern: string): WordPatternToken[] {
  return Array.from(pattern).map((char): WordPatternToken => {
    if (char === "_") {
      return { kind: "blank", value: "_" };
    }
    return { kind: "text", value: char };
  });
}

export function getWordPatternBlankCount(pattern: string) {
  return Array.from(pattern).filter((char) => char === "_").length;
}

function getCompactPatternCharacters(pattern: string) {
  return Array.from(pattern).filter((char) => !/\s/.test(char));
}

function getCompactAnswerCharacters(answer: string) {
  return Array.from(answer).filter((char) => !/\s/.test(char));
}

export function getWordCompletionFilledLetters(pattern: string, fullAnswer: string) {
  const compactPattern = getCompactPatternCharacters(pattern);
  const compactAnswer = getCompactAnswerCharacters(fullAnswer);

  const letters: string[] = [];
  let answerIndex = 0;

  for (const char of compactPattern) {
    if (char === "_") {
      letters.push(compactAnswer[answerIndex] ?? "");
      answerIndex += 1;
      continue;
    }

    answerIndex += 1;
  }

  return letters;
}

export function buildWordCompletionAnswer(pattern: string, filledLetters: string[]) {
  const compactPattern = getCompactPatternCharacters(pattern);
  let blankIndex = 0;

  return compactPattern
    .map((char) => {
      if (char === "_") {
        const next = filledLetters[blankIndex] ?? "";
        blankIndex += 1;
        return next;
      }
      return char;
    })
    .join("");
}
