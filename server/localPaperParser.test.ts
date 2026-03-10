import { describe, expect, it } from "vitest";

import {
  applyAnswerKeyToSections,
  extractAnswerKeyMap,
  parseMaterialsLocally,
} from "./localPaperParser";

describe("localPaperParser answer key helpers", () => {
  it("extracts numbered answers from uploaded answer text", () => {
    const answerMap = extractAnswerKeyMap(`
      --- PET答案.pdf / Page 1 ---
      1 B 2 carefully 3 True 4 no
    `);

    expect(answerMap.get(1)).toBe("B");
    expect(answerMap.get(2)).toBe("carefully");
    expect(answerMap.get(3)).toBe("True");
    expect(answerMap.get(4)).toBe("no");
  });

  it("applies answer key values to supported question types", () => {
    const { sections, appliedCount } = applyAnswerKeyToSections(
      [
        {
          id: "section-1",
          title: "Test Section",
          questions: [
            {
              id: 1,
              type: "mcq",
              question: "Choose one",
              options: ["red", "blue", "green"],
              correctAnswer: 0,
            },
            {
              id: 2,
              type: "fill-blank",
              question: "Fill the blank",
              correctAnswer: "",
            },
            {
              id: 3,
              type: "fill-blank",
              question: "Word bank blank",
              correctAnswer: "",
            },
          ],
          wordBank: [
            { letter: "A", word: "carefully" },
            { letter: "B", word: "quietly" },
          ],
        },
      ],
      new Map([
        [1, "C"],
        [2, "outside"],
        [3, "A"],
      ])
    );

    const questions = sections[0].questions as Array<Record<string, unknown>>;
    expect(appliedCount).toBe(3);
    expect(questions[0].correctAnswer).toBe(2);
    expect(questions[1].correctAnswer).toBe("outside");
    expect(questions[2].correctAnswer).toBe("carefully");
  });

  it("returns local parse metadata and answer-key stats", () => {
    const result = parseMaterialsLocally({
      textContent: "--- Demo.pdf / Page 1 ---\nNo structured exam text here.",
      answerTextContent: "--- Demo-answers.pdf / Page 1 ---\n1 B 2 C",
    });

    expect(result.parseModeUsed).toBe("local");
    expect(result.blueprintLabel).toBe("Free Local Parsed Draft");
    expect(result.answerKeyDetectedCount).toBe(2);
    expect(result.answerKeyAppliedCount).toBe(0);
  });
});
