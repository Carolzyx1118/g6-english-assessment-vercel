import { describe, expect, it } from "vitest";
import type {
  ManualPassageFillBlankQuestion,
  ManualFillBlankQuestion,
  ManualSubsection,
  ManualQuestionType,
} from "../shared/manualPaperBlueprint";
import {
  MANUAL_QUESTION_TYPE_LABELS,
  MANUAL_QUESTION_TYPE_OPTIONS,
} from "../shared/manualPaperBlueprint";

describe("manualPaperBlueprint types and labels", () => {
  it("includes passage-fill-blank in MANUAL_QUESTION_TYPE_LABELS", () => {
    expect(MANUAL_QUESTION_TYPE_LABELS["passage-fill-blank"]).toBe(
      "Passage Word Bank Fill Blank",
    );
  });

  it("includes passage-fill-blank in MANUAL_QUESTION_TYPE_OPTIONS", () => {
    const option = MANUAL_QUESTION_TYPE_OPTIONS.find(
      (o) => o.value === "passage-fill-blank",
    );
    expect(option).toBeDefined();
    expect(option!.label).toBe("Passage Word Bank Fill Blank");
    expect(option!.description).toContain("passage");
  });

  it("has all three question types in labels", () => {
    const keys = Object.keys(MANUAL_QUESTION_TYPE_LABELS);
    expect(keys).toContain("mcq");
    expect(keys).toContain("fill-blank");
    expect(keys).toContain("passage-fill-blank");
    expect(keys).toHaveLength(3);
  });

  it("has all three question types in options array", () => {
    const values = MANUAL_QUESTION_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain("mcq");
    expect(values).toContain("fill-blank");
    expect(values).toContain("passage-fill-blank");
    expect(values).toHaveLength(3);
  });

  it("passage-fill-blank question type is assignable", () => {
    const qt: ManualQuestionType = "passage-fill-blank";
    expect(qt).toBe("passage-fill-blank");
  });

  it("ManualPassageFillBlankQuestion has correct shape", () => {
    const question: ManualPassageFillBlankQuestion = {
      id: "test-1",
      type: "passage-fill-blank",
      prompt: "",
      correctAnswerWordBankId: "wb-1",
    };
    expect(question.type).toBe("passage-fill-blank");
    expect(question.correctAnswerWordBankId).toBe("wb-1");
  });

  it("ManualSubsection supports passageText field", () => {
    const subsection: ManualSubsection = {
      id: "sub-1",
      title: "Test Passage",
      instructions: "Fill in the blanks",
      questionType: "passage-fill-blank",
      questions: [
        {
          id: "q-1",
          type: "passage-fill-blank",
          prompt: "",
          correctAnswerWordBankId: "wb-1",
        },
      ],
      wordBank: [{ id: "wb-1", letter: "A", word: "walks" }],
      passageText: "The boy ___ to school every day.",
    };
    expect(subsection.passageText).toBe("The boy ___ to school every day.");
    expect(subsection.questionType).toBe("passage-fill-blank");
  });

  it("ManualSubsection passageText is optional", () => {
    const subsection: ManualSubsection = {
      id: "sub-2",
      title: "MCQ Block",
      instructions: "",
      questionType: "mcq",
      questions: [],
    };
    expect(subsection.passageText).toBeUndefined();
  });
});
