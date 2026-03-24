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
  it("binds passage gaps directly to matching question ids before using prompt order", () => {
    const entries = buildInlineClozeGapEntries(
      "My name is Anna and I (23) ___ in a small house.\nEvery morning I (24) ___ breakfast.",
      [
        makeQuestion(24, "Blank 1"),
        makeQuestion(23, "Blank 99"),
      ],
    );

    expect(entries.map((entry) => entry.gapNumber)).toEqual([23, 24]);
    expect(entries.map((entry) => entry.question.id)).toEqual([23, 24]);
  });

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

  it("uses the explicit question id order when provided", () => {
    const entries = buildInlineClozeGapEntries(
      "My name is Anna and I (21) ___ in a small house.\nEvery morning I (22) ___ breakfast.",
      [
        makeQuestion(501, "Blank 2"),
        makeQuestion(502, "Blank 1"),
      ],
      [502, 501],
    );

    expect(entries.map((entry) => entry.gapNumber)).toEqual([21, 22]);
    expect(entries.map((entry) => entry.question.id)).toEqual([502, 501]);
  });

  it("falls back to sorting by prompt number when question order is scrambled", () => {
    const entries = buildInlineClozeGapEntries(
      "My name is Anna and I (21) ___ in a small house.\nEvery morning I (22) ___ breakfast.\nI (23) ___ football.",
      [
        makeQuestion(101, "Blank 23"),
        makeQuestion(102, "Blank 21"),
        makeQuestion(103, "Blank 22"),
      ],
    );

    expect(entries.map((entry) => entry.gapNumber)).toEqual([21, 22, 23]);
    expect(entries.map((entry) => entry.question.id)).toEqual([102, 103, 101]);
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
