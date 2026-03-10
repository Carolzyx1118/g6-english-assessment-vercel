import { describe, expect, it } from "vitest";
import type {
  ManualPassageFillBlankQuestion,
  ManualPassageMCQQuestion,
  ManualFillBlankQuestion,
  ManualTypedFillBlankQuestion,
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

  it("includes passage-mcq in MANUAL_QUESTION_TYPE_LABELS", () => {
    expect(MANUAL_QUESTION_TYPE_LABELS["passage-mcq"]).toBe(
      "Passage Multiple Choice",
    );
  });

  it("includes passage-mcq in MANUAL_QUESTION_TYPE_OPTIONS", () => {
    const option = MANUAL_QUESTION_TYPE_OPTIONS.find(
      (o) => o.value === "passage-mcq",
    );
    expect(option).toBeDefined();
    expect(option!.label).toBe("Passage Multiple Choice");
    expect(option!.description).toContain("PET");
  });

  it("includes typed-fill-blank in MANUAL_QUESTION_TYPE_LABELS", () => {
    expect(MANUAL_QUESTION_TYPE_LABELS["typed-fill-blank"]).toBe(
      "Fill in Blank",
    );
  });

  it("includes typed-fill-blank in MANUAL_QUESTION_TYPE_OPTIONS", () => {
    const option = MANUAL_QUESTION_TYPE_OPTIONS.find(
      (o) => o.value === "typed-fill-blank",
    );
    expect(option).toBeDefined();
    expect(option!.label).toBe("Fill in Blank");
    expect(option!.description).toContain("type answers directly");
  });

  it("has all five question types in labels", () => {
    const keys = Object.keys(MANUAL_QUESTION_TYPE_LABELS);
    expect(keys).toContain("mcq");
    expect(keys).toContain("fill-blank");
    expect(keys).toContain("passage-fill-blank");
    expect(keys).toContain("passage-mcq");
    expect(keys).toContain("typed-fill-blank");
    expect(keys).toHaveLength(5);
  });

  it("has all five question types in options array", () => {
    const values = MANUAL_QUESTION_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain("mcq");
    expect(values).toContain("fill-blank");
    expect(values).toContain("passage-fill-blank");
    expect(values).toContain("passage-mcq");
    expect(values).toContain("typed-fill-blank");
    expect(values).toHaveLength(5);
  });

  it("passage-fill-blank question type is assignable", () => {
    const qt: ManualQuestionType = "passage-fill-blank";
    expect(qt).toBe("passage-fill-blank");
  });

  it("passage-mcq question type is assignable", () => {
    const qt: ManualQuestionType = "passage-mcq";
    expect(qt).toBe("passage-mcq");
  });

  it("typed-fill-blank question type is assignable", () => {
    const qt: ManualQuestionType = "typed-fill-blank";
    expect(qt).toBe("typed-fill-blank");
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

  it("ManualPassageMCQQuestion has correct shape", () => {
    const question: ManualPassageMCQQuestion = {
      id: "test-mcq-1",
      type: "passage-mcq",
      prompt: "Blank 1",
      options: [
        { id: "opt-a", label: "A", text: "went" },
        { id: "opt-b", label: "B", text: "goes" },
        { id: "opt-c", label: "C", text: "going" },
        { id: "opt-d", label: "D", text: "gone" },
      ],
      correctAnswer: "A",
    };
    expect(question.type).toBe("passage-mcq");
    expect(question.options).toHaveLength(4);
    expect(question.options[0].label).toBe("A");
    expect(question.options[0].text).toBe("went");
    expect(question.correctAnswer).toBe("A");
  });

  it("ManualPassageMCQQuestion options can have varying count", () => {
    const question: ManualPassageMCQQuestion = {
      id: "test-mcq-2",
      type: "passage-mcq",
      prompt: "Blank 2",
      options: [
        { id: "opt-a", label: "A", text: "happy" },
        { id: "opt-b", label: "B", text: "sad" },
        { id: "opt-c", label: "C", text: "angry" },
      ],
      correctAnswer: "B",
    };
    expect(question.options).toHaveLength(3);
    expect(question.correctAnswer).toBe("B");
  });

  it("ManualTypedFillBlankQuestion has correct shape", () => {
    const question: ManualTypedFillBlankQuestion = {
      id: "test-typed-1",
      type: "typed-fill-blank",
      prompt: "The capital of France is ___.",
      correctAnswer: "Paris",
    };
    expect(question.type).toBe("typed-fill-blank");
    expect(question.prompt).toContain("___");
    expect(question.correctAnswer).toBe("Paris");
  });

  it("ManualTypedFillBlankQuestion works without blank marker in prompt", () => {
    const question: ManualTypedFillBlankQuestion = {
      id: "test-typed-2",
      type: "typed-fill-blank",
      prompt: "What is 2 + 2?",
      correctAnswer: "4",
    };
    expect(question.type).toBe("typed-fill-blank");
    expect(question.prompt).not.toContain("___");
    expect(question.correctAnswer).toBe("4");
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

  it("ManualSubsection supports passage-mcq with passageText", () => {
    const subsection: ManualSubsection = {
      id: "sub-mcq-1",
      title: "PET Cloze Test",
      instructions: "Read the passage and choose the best word for each blank.",
      questionType: "passage-mcq",
      questions: [
        {
          id: "q-1",
          type: "passage-mcq",
          prompt: "Blank 1",
          options: [
            { id: "opt-a", label: "A", text: "went" },
            { id: "opt-b", label: "B", text: "goes" },
            { id: "opt-c", label: "C", text: "going" },
          ],
          correctAnswer: "A",
        },
        {
          id: "q-2",
          type: "passage-mcq",
          prompt: "Blank 2",
          options: [
            { id: "opt-a2", label: "A", text: "had" },
            { id: "opt-b2", label: "B", text: "have" },
            { id: "opt-c2", label: "C", text: "has" },
          ],
          correctAnswer: "B",
        },
      ],
      passageText: "Last summer, I ___ to the beach. We ___ a wonderful time.",
    };
    expect(subsection.questionType).toBe("passage-mcq");
    expect(subsection.passageText).toContain("___");
    expect(subsection.questions).toHaveLength(2);
    // No wordBank for passage-mcq
    expect(subsection.wordBank).toBeUndefined();
  });

  it("ManualSubsection supports typed-fill-blank questions", () => {
    const subsection: ManualSubsection = {
      id: "sub-typed-1",
      title: "Grammar Fill in Blank",
      instructions: "Type the correct answer in each blank.",
      questionType: "typed-fill-blank",
      questions: [
        {
          id: "q-1",
          type: "typed-fill-blank",
          prompt: "She ___ to school every day.",
          correctAnswer: "goes",
        },
        {
          id: "q-2",
          type: "typed-fill-blank",
          prompt: "They ___ playing football.",
          correctAnswer: "are",
        },
      ],
    };
    expect(subsection.questionType).toBe("typed-fill-blank");
    expect(subsection.questions).toHaveLength(2);
    // No wordBank or passageText for typed-fill-blank
    expect(subsection.wordBank).toBeUndefined();
    expect(subsection.passageText).toBeUndefined();
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
