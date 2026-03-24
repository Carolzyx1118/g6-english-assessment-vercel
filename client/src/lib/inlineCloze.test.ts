import { describe, expect, it } from "vitest";

import type { MCQQuestion } from "@/data/papers";
import { buildInlineClozeGapEntries } from "@/lib/inlineCloze";

function makeQuestion(id: number, question: string): MCQQuestion {
  return {
    id,
    type: "mcq",
    question,
    options: ["A", "B", "C"],
    correctAnswer: 0,
  };
}

describe("buildInlineClozeGapEntries", () => {
  it("prefers passage gap numbers when the passage and question counts match", () => {
    const entries = buildInlineClozeGapEntries(
      "My name is Anna and I (21) ___ in a small house.\nEvery morning I (22) ___ breakfast.",
      [
        makeQuestion(101, "Blank 1"),
        makeQuestion(102, "Blank 2"),
      ],
    );

    expect(entries.map((entry) => entry.gapNumber)).toEqual([21, 22]);
    expect(entries.map((entry) => entry.question.id)).toEqual([101, 102]);
  });

  it("falls back to question numbering when the passage does not expose matching gap numbers", () => {
    const entries = buildInlineClozeGapEntries(
      "My name is Anna and I ___ in a small house.",
      [
        makeQuestion(101, "Blank 7"),
        makeQuestion(102, "Blank 8"),
      ],
    );

    expect(entries.map((entry) => entry.gapNumber)).toEqual([7, 8]);
  });
});
