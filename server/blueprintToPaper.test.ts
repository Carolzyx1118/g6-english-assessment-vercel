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

  it("groups multiple manual subsections into one runtime section per part", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "grouped-part",
          partLabel: "Part 1",
          sectionType: "reading",
          subsections: [
            {
              id: "sub-1",
              title: "",
              instructions: "Read the first set.",
              questionType: "mcq",
              questions: [
                {
                  id: "q1",
                  type: "mcq",
                  prompt: "Question A?",
                  options: [
                    { label: "A", text: "One" },
                    { label: "B", text: "Two" },
                  ],
                  correctAnswer: "A",
                },
              ],
              wordBank: [],
            },
            {
              id: "sub-2",
              title: "",
              instructions: "Read the second set.",
              questionType: "typed-fill-blank",
              questions: [
                {
                  id: "q2",
                  type: "typed-fill-blank",
                  prompt: "Type the answer: ___",
                  correctAnswer: "Hello",
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
    expect(result.sections[0].questions).toHaveLength(2);
    expect(result.sections[0].manualBlocks).toHaveLength(2);
    expect(result.sections[0].manualBlocks?.map((block) => block.displayNumber)).toEqual([1, 2]);
    expect(result.sections[0].manualBlocks?.map((block) => block.questionIds.length)).toEqual([1, 1]);
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
    expect(q.type).toBe("fill-blank");
    expect(q.question).toBe("The cat ___ on the mat.");
    expect(q.correctAnswer).toBe("sat");
    expect(result.sections[0].wordBank).toEqual([
      { letter: "A", word: "sat" },
      { letter: "B", word: "ran" },
    ]);
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

  it("converts passage fill-blank questions into drag-drop grammar sections", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 2",
          sectionType: "grammar",
          subsections: [
            {
              id: "sub1",
              title: "Passage word bank",
              instructions: "",
              questionType: "passage-fill-blank",
              passageText: "Tom ___ to school. He ___ his homework.",
              questions: [
                {
                  id: "q1",
                  type: "passage-fill-blank",
                  prompt: "Blank 1",
                  correctAnswerWordBankId: "wb1",
                },
                {
                  id: "q2",
                  type: "passage-fill-blank",
                  prompt: "Blank 2",
                  correctAnswerWordBankId: "wb2",
                },
              ],
              wordBank: [
                { id: "wb1", letter: "A", word: "walked" },
                { id: "wb2", letter: "B", word: "finished" },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].grammarPassage).toBe("Tom <b>(1) ___</b> to school. He <b>(2) ___</b> his homework.");
    expect(result.sections[0].questions.map((q) => q.correctAnswer)).toEqual(["A", "B"]);
  });

  it("converts passage mcq into inline cloze sections", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 3",
          sectionType: "reading",
          subsections: [
            {
              id: "sub1",
              title: "Passage cloze",
              instructions: "",
              questionType: "passage-mcq",
              passageText: "It was ___ day, so we ___ home.",
              questions: [
                {
                  id: "q1",
                  type: "passage-mcq",
                  prompt: "Blank 1",
                  options: [
                    { id: "o1", label: "A", text: "sunny" },
                    { id: "o2", label: "B", text: "storm" },
                  ],
                  correctAnswer: "A",
                },
                {
                  id: "q2",
                  type: "passage-mcq",
                  prompt: "Blank 2",
                  options: [
                    { id: "o3", label: "A", text: "stay" },
                    { id: "o4", label: "B", text: "stayed" },
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
    expect(result.sections[0].inlineCloze).toBe(true);
    expect(result.sections[0].passage).toBe("It was (1) ___ day, so we (2) ___ home.");
    expect(result.sections[0].questions[0].type).toBe("mcq");
  });

  it("converts image mcq into picture-mcq", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "reading",
          subsections: [
            {
              id: "sub1",
              title: "Picture question",
              instructions: "",
              questionType: "mcq",
              questions: [
                {
                  id: "q1",
                  type: "mcq",
                  prompt: "Choose the picture.",
                  options: [
                    { label: "A", text: "Cat", image: { fileName: "a.png", dataUrl: "data:image/png;base64,aaa", mimeType: "image/png", size: 1 } },
                    { label: "B", text: "Dog" },
                  ],
                  correctAnswer: "A",
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
    expect(q.type).toBe("picture-mcq");
    expect(q.options).toEqual([
      { label: "A", text: "Cat", imageUrl: "data:image/png;base64,aaa" },
      { label: "B", text: "Dog", imageUrl: "" },
    ]);
  });

  it("converts listening mcq into listening-mcq", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "listening",
          subsections: [
            {
              id: "sub1",
              title: "Listen",
              instructions: "",
              questionType: "mcq",
              questions: [
                {
                  id: "q1",
                  type: "mcq",
                  prompt: "What do you hear?",
                  options: [
                    { label: "A", text: "Hello" },
                    { label: "B", text: "Goodbye" },
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
    expect(result.sections[0].questions[0].type).toBe("listening-mcq");
  });

  it("converts speaking questions into open-ended prompts with images", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s1",
          partLabel: "Part 1",
          sectionType: "speaking",
          subsections: [
            {
              id: "sub1",
              title: "Speaking prompt",
              instructions: "Record your answer.",
              questionType: "speaking",
              questions: [
                {
                  id: "q1",
                  type: "speaking",
                  prompt: "Describe what you can see in the picture.",
                  image: {
                    fileName: "speaking.png",
                    dataUrl: "data:image/png;base64,bbb",
                    mimeType: "image/png",
                    size: 1,
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].sectionType).toBe("speaking");
    expect(result.sections[0].questions[0]).toMatchObject({
      type: "open-ended",
      question: "Describe what you can see in the picture.",
      imageUrl: "data:image/png;base64,bbb",
      responseMode: "audio",
    });
  });

  it("recovers legacy speaking subsections that were saved with old mcq payloads", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "legacy",
          partLabel: "Part 1",
          sectionType: "speaking",
          subsections: [
            {
              id: "sub-legacy",
              title: "",
              instructions: "Talk about the picture.",
              questionType: "speaking",
              questions: [
                {
                  id: "legacy-q",
                  type: "mcq",
                  prompt: "",
                  options: [
                    { id: "a", label: "A", text: "" },
                    { id: "b", label: "B", text: "" },
                    { id: "c", label: "C", text: "" },
                  ],
                  correctAnswer: "A",
                },
              ],
              sceneImage: {
                fileName: "scene.png",
                dataUrl: "data:image/png;base64,legacy",
                mimeType: "image/png",
                size: 1,
              },
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].questions[0]).toMatchObject({
      type: "open-ended",
      question: "Talk about the picture.",
      imageUrl: "data:image/png;base64,legacy",
      responseMode: "audio",
    });
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

  it("converts true-false question blocks with not-given choices", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s-tf",
          partLabel: "Part 2",
          sectionType: "reading",
          subsections: [
            {
              id: "sub-tf",
              title: "True False Not Given",
              instructions: "",
              questionType: "true-false",
              questions: [
                {
                  id: "tf-1",
                  type: "true-false",
                  prompt: "Read the passage and choose the best answer.",
                  requiresReason: true,
                  statements: [
                    { id: "s1", label: "1", statement: "Tom likes football.", correctAnswer: "true" },
                    { id: "s2", label: "2", statement: "Jane hates music.", correctAnswer: "false" },
                    { id: "s3", label: "3", statement: "The passage says where Tom lives.", correctAnswer: "not-given" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].questions[0]).toMatchObject({
      type: "true-false",
      question: "Read the passage and choose the best answer.",
      choices: ["True", "False", "Not Given"],
      requiresReason: true,
    });
    expect(result.sections[0].questions[0].statements?.[2].correctChoice).toBe("Not Given");
  });

  it("converts heading-match subsections into passage mcq with numbered headings", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s-heading",
          partLabel: "Part 3",
          sectionType: "reading",
          subsections: [
            {
              id: "sub-heading",
              title: "Matching Headings",
              instructions: "",
              questionType: "heading-match",
              passageText: "A First paragraph.\n\nB Second paragraph.",
              questions: [
                {
                  id: "hm-1",
                  type: "heading-match",
                  prompt: "Paragraph A",
                  correctAnswer: "2",
                },
              ],
              matchingDescriptions: [
                { id: "h1", label: "1", name: "A New Hobby", text: "" },
                { id: "h2", label: "2", name: "A Busy Weekend", text: "" },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].passage).toBe("A First paragraph.\n\nB Second paragraph.");
    expect(result.sections[0].questions[0]).toMatchObject({
      type: "mcq",
      question: "Paragraph A",
      matchingCorrectLabel: "2",
    });
    expect(result.sections[0].matchingDescriptions?.[0].label).toBe("1");
  });

  it("converts checkbox questions with multiple correct answers", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s-checkbox",
          partLabel: "Part 1",
          sectionType: "reading",
          subsections: [
            {
              id: "sub-checkbox",
              title: "Select the correct answers",
              instructions: "",
              questionType: "checkbox",
              questions: [
                {
                  id: "cb-1",
                  type: "checkbox",
                  prompt: "Choose the two correct statements.",
                  options: [
                    { id: "a", label: "A", text: "Dogs are mammals." },
                    { id: "b", label: "B", text: "Fish can fly." },
                    { id: "c", label: "C", text: "Birds lay eggs." },
                  ],
                  correctAnswers: ["A", "C"],
                  selectionLimit: 2,
                },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].questions[0]).toMatchObject({
      type: "checkbox",
      options: ["Dogs are mammals.", "Fish can fly.", "Birds lay eggs."],
      correctAnswers: [0, 2],
      selectionLimit: 2,
    });
  });

  it("converts ordering questions into runtime order questions", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s-order",
          partLabel: "Part 4",
          sectionType: "reading",
          subsections: [
            {
              id: "sub-order",
              title: "Put the events in order",
              instructions: "",
              questionType: "ordering",
              questions: [
                {
                  id: "order-1",
                  type: "ordering",
                  prompt: "Put these events in the correct order.",
                  items: [
                    { id: "o1", text: "He arrived at school.", correctPosition: 2 },
                    { id: "o2", text: "He woke up.", correctPosition: 1 },
                    { id: "o3", text: "He ate lunch.", correctPosition: 3 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].questions[0]).toMatchObject({
      type: "order",
      events: ["He arrived at school.", "He woke up.", "He ate lunch."],
      correctOrder: [2, 1, 3],
    });
  });

  it("converts sentence reordering questions into runtime sentence-reorder questions", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s-reorder",
          partLabel: "Part 2",
          sectionType: "grammar",
          subsections: [
            {
              id: "sub-reorder",
              title: "",
              instructions: "Put the words in order to make correct sentences.",
              questionType: "sentence-reorder",
              questions: [
                {
                  id: "sr-1",
                  type: "sentence-reorder",
                  prompt: "Put the words in order to make correct sentences.",
                  items: [
                    {
                      id: "item-1",
                      label: "1",
                      scrambledWords: "He / walks / to school / usually / with me",
                      correctAnswer: "He usually walks to school with me.",
                    },
                    {
                      id: "item-2",
                      label: "2",
                      scrambledWords: "I / visited / ago / a long time / the museum",
                      correctAnswer: "I visited the museum a long time ago.",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].questions[0]).toMatchObject({
      type: "sentence-reorder",
      question: "Put the words in order to make correct sentences.",
    });
    expect(result.sections[0].questions[0].items).toEqual([
      {
        label: "1",
        scrambledWords: "He / walks / to school / usually / with me",
        correctAnswer: "He usually walks to school with me.",
      },
      {
        label: "2",
        scrambledWords: "I / visited / ago / a long time / the museum",
        correctAnswer: "I visited the museum a long time ago.",
      },
    ]);
  });

  it("converts inline word choice questions into runtime inline-word-choice questions", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s-inline-choice",
          partLabel: "Part 3",
          sectionType: "grammar",
          subsections: [
            {
              id: "sub-inline-choice",
              title: "",
              instructions: "Choose the correct word in each sentence.",
              questionType: "inline-word-choice",
              questions: [
                {
                  id: "iwc-1",
                  type: "inline-word-choice",
                  prompt: "Choose the correct word to complete each sentence.",
                  items: [
                    {
                      id: "item-1",
                      label: "1",
                      beforeText: "",
                      options: [
                        { id: "o1", label: "A", text: "Skateboarding" },
                        { id: "o2", label: "B", text: "Surfing" },
                      ],
                      afterText: "is my favourite activity because I love being in the water.",
                      correctAnswer: "B",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].questions[0]).toMatchObject({
      type: "inline-word-choice",
      question: "Choose the correct word to complete each sentence.",
      items: [
        {
          label: "1",
          beforeText: "",
          options: ["Skateboarding", "Surfing"],
          afterText: "is my favourite activity because I love being in the water.",
          correctAnswer: 1,
        },
      ],
    });
  });

  it("converts passage inline word choice questions into runtime passage-inline-word-choice questions", () => {
    const blueprint = makeBlueprint({
      sections: [
        {
          id: "s-passage-inline-choice",
          partLabel: "Part 4",
          sectionType: "reading",
          subsections: [
            {
              id: "sub-passage-inline-choice",
              title: "",
              instructions: "Choose the correct word for each blank.",
              questionType: "passage-inline-word-choice",
              passageText: "___ is my favourite activity because I love being in the water. You’ll find the potatoes in the ___.",
              questions: [
                {
                  id: "piwc-1",
                  type: "passage-inline-word-choice",
                  prompt: "Choose the correct word for each blank in the passage.",
                  items: [
                    {
                      id: "item-1",
                      label: "1",
                      options: [
                        { id: "o1", label: "A", text: "Skateboarding" },
                        { id: "o2", label: "B", text: "Surfing" },
                      ],
                      correctAnswer: "B",
                    },
                    {
                      id: "item-2",
                      label: "2",
                      options: [
                        { id: "o3", label: "A", text: "cupboard" },
                        { id: "o4", label: "B", text: "bookshelf" },
                      ],
                      correctAnswer: "A",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = blueprintToPaper(blueprint);
    expect(result.sections[0].questions[0]).toMatchObject({
      type: "passage-inline-word-choice",
      question: "Choose the correct word for each blank in the passage.",
      passageText: "___ is my favourite activity because I love being in the water. You’ll find the potatoes in the ___.",
      items: [
        {
          label: "1",
          options: ["Skateboarding", "Surfing"],
          correctAnswer: 1,
        },
        {
          label: "2",
          options: ["cupboard", "bookshelf"],
          correctAnswer: 0,
        },
      ],
    });
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
