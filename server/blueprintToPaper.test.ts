import { describe, it, expect } from "vitest";
import { blueprintToPaper, countBlueprintQuestions, blueprintHasListening, blueprintHasWriting } from "@shared/blueprintToPaper";
import type { ManualPaperBlueprint } from "@shared/manualPaperBlueprint";

function makeBlueprint(overrides?: Partial<ManualPaperBlueprint>): ManualPaperBlueprint {
  return {
    id: "test-paper-1",
    title: "Test Paper",
    description: "A test paper",
    createdAt: "2026-01-01T00:00:00.000Z",
    sections: [],
    ...overrides,
  };
}

describe("blueprintToPaper", () => {
  it("converts an empty blueprint to a paper with no sections", () => {
    const result = blueprintToPaper(makeBlueprint());
    expect(result.id).toBe("test-paper-1");
    expect(result.title).toBe("Test Paper");
    expect(result.sections).toHaveLength(0);
    expect(result.totalQuestions).toBe(0);
    expect(result.hasListening).toBe(false);
    expect(result.hasWriting).toBe(false);
    expect(result.isManualPaper).toBe(true);
  });

  it("converts MCQ questions correctly", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "reading",
          subsections: [
            {
              id: "sub1",
              title: "Reading Comprehension",
              instructions: "Answer the questions",
              questionType: "mcq",
              questions: [
                {
                  id: "q1",
                  type: "mcq",
                  prompt: "What is 1+1?",
                  options: [
                    { label: "A", text: "1" },
                    { label: "B", text: "2" },
                    { label: "C", text: "3" },
                  ],
                  correctAnswer: "B",
                },
              ],
              wordBank: [],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections).toHaveLength(1);
    expect(result.totalQuestions).toBe(1);

    const q = result.sections[0].questions[0];
    expect(q.type).toBe("mcq");
    expect(q.question).toBe("What is 1+1?");
    expect(q.options).toEqual(["1", "2", "3"]);
    expect(q.correctAnswer).toBe(1); // index of "B"
  });

  it("converts fill-blank questions with word bank", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "grammar",
          subsections: [
            {
              id: "sub1",
              title: "Fill in the blanks",
              instructions: "",
              questionType: "fill-blank",
              questions: [
                {
                  id: "q1",
                  type: "fill-blank",
                  prompt: "The cat ___ on the mat.",
                  correctAnswerWordBankId: "wb1",
                },
              ],
              wordBank: [
                { id: "wb1", letter: "A", word: "sat" },
                { id: "wb2", letter: "B", word: "ran" },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    const q = result.sections[0].questions[0];
    expect(q.type).toBe("wordbank-fill");
    expect(q.correctAnswer).toBe("sat");
  });

  it("converts typed-fill-blank questions", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "grammar",
          subsections: [
            {
              id: "sub1",
              title: "Type the answer",
              instructions: "",
              questionType: "typed-fill-blank",
              questions: [
                {
                  id: "q1",
                  type: "typed-fill-blank",
                  prompt: "The capital of France is ___.",
                  correctAnswer: "Paris",
                },
              ],
              wordBank: [],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    const q = result.sections[0].questions[0];
    expect(q.type).toBe("fill-blank");
    expect(q.correctAnswer).toBe("Paris");
    expect(q.correctAnswerText).toBe("Paris");
  });

  it("converts writing questions with image and word limits", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "writing",
          subsections: [
            {
              id: "sub1",
              title: "Essay",
              instructions: "",
              questionType: "writing",
              questions: [
                {
                  id: "q1",
                  type: "writing",
                  prompt: "Describe your favorite holiday.",
                  minWords: 100,
                  maxWords: 200,
                  referenceAnswer: "Sample answer",
                },
              ],
              wordBank: [],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.hasWriting).toBe(true);
    const q = result.sections[0].questions[0];
    expect(q.type).toBe("writing");
    expect(q.minWords).toBe(100);
    expect(q.maxWords).toBe(200);
    expect(q.wordCount).toBe("100-200 words");
  });

  it("detects listening sections", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "listening",
          subsections: [
            {
              id: "sub1",
              title: "Listen and answer",
              instructions: "",
              questionType: "mcq",
              questions: [
                {
                  id: "q1",
                  type: "mcq",
                  prompt: "What did the speaker say?",
                  options: [
                    { label: "A", text: "Hello" },
                    { label: "B", text: "Goodbye" },
                  ],
                  correctAnswer: "A",
                },
              ],
              wordBank: [],
              audio: { fileName: "audio.mp3", dataUrl: "data:audio/mp3;base64,abc", previewUrl: "https://example.com/audio.mp3" },
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.hasListening).toBe(true);
    expect(result.sections[0].audioUrl).toBe("https://example.com/audio.mp3");
  });

  it("converts passage-open-ended questions", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "reading",
          subsections: [
            {
              id: "sub1",
              title: "Read and answer",
              instructions: "",
              questionType: "passage-open-ended",
              passageText: "Once upon a time...",
              questions: [
                {
                  id: "q1",
                  type: "passage-open-ended",
                  prompt: "What happened next?",
                  referenceAnswer: "They lived happily ever after.",
                },
              ],
              wordBank: [],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].passage).toBe("Once upon a time...");
    const q = result.sections[0].questions[0];
    expect(q.type).toBe("open-ended");
    expect(q.referenceAnswer).toBe("They lived happily ever after.");
  });

  it("converts passage-matching questions", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "reading",
          subsections: [
            {
              id: "sub1",
              title: "Match the descriptions",
              instructions: "",
              questionType: "passage-matching",
              questions: [
                {
                  id: "q1",
                  type: "passage-matching",
                  prompt: "Alice wants a quiet restaurant.",
                  correctAnswer: "A",
                },
              ],
              wordBank: [],
              matchingDescriptions: [
                { id: "d1", label: "A", name: "The Garden", text: "A quiet place" },
                { id: "d2", label: "B", name: "The Club", text: "A noisy place" },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    const q = result.sections[0].questions[0];
    expect(q.type).toBe("mcq");
    expect(q.matchingCorrectLabel).toBe("A");
    expect(result.sections[0].matchingDescriptions).toHaveLength(2);
  });

  it("uses custom subject and category from options", () => {
    const result = blueprintToPaper(makeBlueprint(), {
      subject: "math",
      category: "practice",
    });
    expect(result.subject).toBe("math");
    expect(result.category).toBe("practice");
  });
});

describe("countBlueprintQuestions", () => {
  it("counts questions across all sections and subsections", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "reading",
          subsections: [
            {
              id: "sub1",
              title: "Q1",
              instructions: "",
              questionType: "mcq",
              questions: [
                { id: "q1", type: "mcq", prompt: "Q1", options: [{ label: "A", text: "a" }], correctAnswer: "A" },
                { id: "q2", type: "mcq", prompt: "Q2", options: [{ label: "A", text: "a" }], correctAnswer: "A" },
              ],
              wordBank: [],
            },
          ],
        },
        {
          id: "s2",
          partLabel: "Part 2",
          sectionType: "grammar",
          subsections: [
            {
              id: "sub2",
              title: "Q3",
              instructions: "",
              questionType: "typed-fill-blank",
              questions: [
                { id: "q3", type: "typed-fill-blank", prompt: "Q3", correctAnswer: "answer" },
              ],
              wordBank: [],
            },
          ],
        },
      ],
    });

    expect(countBlueprintQuestions(blueprint)).toBe(3);
  });
});

describe("blueprintHasListening", () => {
  it("returns true when a section is listening type", () => {
    const blueprint = makeBlueprint({
      sections: [{ id: "s1", partLabel: "P1", sectionType: "listening", subsections: [] }],
    });
    expect(blueprintHasListening(blueprint)).toBe(true);
  });

  it("returns false when no listening sections", () => {
    const blueprint = makeBlueprint({
      sections: [{ id: "s1", partLabel: "P1", sectionType: "reading", subsections: [] }],
    });
    expect(blueprintHasListening(blueprint)).toBe(false);
  });
});

describe("blueprintHasWriting", () => {
  it("returns true when a section is writing type", () => {
    const blueprint = makeBlueprint({
      sections: [{ id: "s1", partLabel: "P1", sectionType: "writing", subsections: [] }],
    });
    expect(blueprintHasWriting(blueprint)).toBe(true);
  });

  it("returns true when a subsection has writing question type", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "P1",
          sectionType: "reading",
          subsections: [
            { id: "sub1", title: "T", instructions: "", questionType: "writing", questions: [], wordBank: [] },
          ],
        },
      ],
    });
    expect(blueprintHasWriting(blueprint)).toBe(true);
  });
});
