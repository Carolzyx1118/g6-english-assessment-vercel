import { describe, expect, it } from "vitest";
import type {
  ManualPassageFillBlankQuestion,
  ManualPassageMCQQuestion,
  ManualPassageMatchingQuestion,
  ManualMatchingDescription,
  ManualFillBlankQuestion,
  ManualTypedFillBlankQuestion,
  ManualPassageOpenEndedQuestion,
  ManualWritingQuestion,
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

  it("includes passage-open-ended in MANUAL_QUESTION_TYPE_LABELS", () => {
    expect(MANUAL_QUESTION_TYPE_LABELS["passage-open-ended"]).toBe(
      "Passage Open-Ended",
    );
  });

  it("includes passage-open-ended in MANUAL_QUESTION_TYPE_OPTIONS", () => {
    const option = MANUAL_QUESTION_TYPE_OPTIONS.find(
      (o) => o.value === "passage-open-ended",
    );
    expect(option).toBeDefined();
    expect(option!.label).toBe("Passage Open-Ended");
    expect(option!.description).toContain("文章问答题");
  });

  it("includes writing in MANUAL_QUESTION_TYPE_LABELS", () => {
    expect(MANUAL_QUESTION_TYPE_LABELS["writing"]).toBe("Writing");
  });

  it("includes writing in MANUAL_QUESTION_TYPE_OPTIONS", () => {
    const option = MANUAL_QUESTION_TYPE_OPTIONS.find(
      (o) => o.value === "writing",
    );
    expect(option).toBeDefined();
    expect(option!.label).toBe("Writing");
    expect(option!.description).toContain("写作题");
  });

  it("includes passage-matching in MANUAL_QUESTION_TYPE_LABELS", () => {
    expect(MANUAL_QUESTION_TYPE_LABELS["passage-matching"]).toBe(
      "Passage Matching",
    );
  });

  it("includes passage-matching in MANUAL_QUESTION_TYPE_OPTIONS", () => {
    const option = MANUAL_QUESTION_TYPE_OPTIONS.find(
      (o) => o.value === "passage-matching",
    );
    expect(option).toBeDefined();
    expect(option!.label).toBe("Passage Matching");
  });

  it("has all eight question types in labels", () => {
    const keys = Object.keys(MANUAL_QUESTION_TYPE_LABELS);
    expect(keys).toContain("mcq");
    expect(keys).toContain("fill-blank");
    expect(keys).toContain("passage-fill-blank");
    expect(keys).toContain("passage-mcq");
    expect(keys).toContain("typed-fill-blank");
    expect(keys).toContain("passage-open-ended");
    expect(keys).toContain("writing");
    expect(keys).toContain("passage-matching");
    expect(keys).toHaveLength(8);
  });

  it("has all eight question types in options array", () => {
    const values = MANUAL_QUESTION_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain("mcq");
    expect(values).toContain("fill-blank");
    expect(values).toContain("passage-fill-blank");
    expect(values).toContain("passage-mcq");
    expect(values).toContain("typed-fill-blank");
    expect(values).toContain("passage-open-ended");
    expect(values).toContain("writing");
    expect(values).toContain("passage-matching");
    expect(values).toHaveLength(8);
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

  it("passage-open-ended question type is assignable", () => {
    const qt: ManualQuestionType = "passage-open-ended";
    expect(qt).toBe("passage-open-ended");
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

  it("ManualPassageOpenEndedQuestion has correct shape", () => {
    const question: ManualPassageOpenEndedQuestion = {
      id: "test-oe-1",
      type: "passage-open-ended",
      prompt: "What is the main idea of the passage?",
      referenceAnswer: "The passage is about the importance of reading.",
    };
    expect(question.type).toBe("passage-open-ended");
    expect(question.prompt).toContain("main idea");
    expect(question.referenceAnswer).toContain("reading");
  });

  it("ManualPassageOpenEndedQuestion works with empty referenceAnswer", () => {
    const question: ManualPassageOpenEndedQuestion = {
      id: "test-oe-2",
      type: "passage-open-ended",
      prompt: "Why did the character feel sad?",
      referenceAnswer: "",
    };
    expect(question.type).toBe("passage-open-ended");
    expect(question.referenceAnswer).toBe("");
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
    expect(subsection.wordBank).toBeUndefined();
    expect(subsection.passageText).toBeUndefined();
  });

  it("ManualSubsection supports passage-open-ended with passageText and questions", () => {
    const subsection: ManualSubsection = {
      id: "sub-oe-1",
      title: "Reading Comprehension",
      instructions: "Read the passage and answer the questions.",
      questionType: "passage-open-ended",
      questions: [
        {
          id: "q-1",
          type: "passage-open-ended",
          prompt: "What is the main idea of the passage?",
          referenceAnswer: "The passage discusses the importance of exercise.",
        },
        {
          id: "q-2",
          type: "passage-open-ended",
          prompt: "How does the author support the argument?",
          referenceAnswer: "",
        },
      ],
      passageText: "Exercise is important for maintaining good health. Regular physical activity can help prevent many chronic diseases...",
    };
    expect(subsection.questionType).toBe("passage-open-ended");
    expect(subsection.passageText).toContain("Exercise");
    expect(subsection.questions).toHaveLength(2);
    expect(subsection.wordBank).toBeUndefined();
  });

  it("ManualSubsection passage-open-ended can have 1 to 3 questions", () => {
    const subsection: ManualSubsection = {
      id: "sub-oe-2",
      title: "Short Story Questions",
      instructions: "Answer the following question.",
      questionType: "passage-open-ended",
      questions: [
        {
          id: "q-1",
          type: "passage-open-ended",
          prompt: "Describe the setting of the story.",
          referenceAnswer: "The story takes place in a small village.",
        },
      ],
      passageText: "In a small village by the river, there lived an old man...",
    };
    expect(subsection.questions).toHaveLength(1);
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

  it("ManualSubsection supports audio field for listening sections", () => {
    const subsection: ManualSubsection = {
      id: "sub-audio-1",
      title: "Listening Comprehension",
      instructions: "Listen to the audio and answer the questions.",
      questionType: "mcq",
      questions: [
        {
          id: "q-1",
          type: "mcq",
          prompt: "What did the speaker say?",
          options: [
            { id: "o1", label: "A", text: "Hello" },
            { id: "o2", label: "B", text: "Goodbye" },
          ],
          correctAnswer: "A",
        },
      ],
      audio: {
        dataUrl: "data:audio/mpeg;base64,abc123",
        previewUrl: "https://cdn.example.com/audio/clip.mp3",
        fileName: "listening-clip.mp3",
        mimeType: "audio/mpeg",
        size: 1024000,
      },
    };
    expect(subsection.audio).toBeDefined();
    expect(subsection.audio!.fileName).toBe("listening-clip.mp3");
    expect(subsection.audio!.mimeType).toBe("audio/mpeg");
    expect(subsection.audio!.size).toBe(1024000);
    expect(subsection.audio!.previewUrl).toContain("cdn.example.com");
  });

  it("ManualSubsection audio is optional", () => {
    const subsection: ManualSubsection = {
      id: "sub-no-audio",
      title: "Reading Block",
      instructions: "",
      questionType: "mcq",
      questions: [],
    };
    expect(subsection.audio).toBeUndefined();
  });

  it("ManualAudioFile previewUrl is optional", () => {
    const subsection: ManualSubsection = {
      id: "sub-audio-2",
      title: "Listening Q2",
      instructions: "Listen and answer.",
      questionType: "fill-blank",
      questions: [],
      wordBank: [],
      audio: {
        dataUrl: "data:audio/wav;base64,xyz789",
        fileName: "recording.wav",
        mimeType: "audio/wav",
        size: 512000,
      },
    };
    expect(subsection.audio).toBeDefined();
    expect(subsection.audio!.previewUrl).toBeUndefined();
    expect(subsection.audio!.mimeType).toBe("audio/wav");
  });

  it("writing question type is assignable", () => {
    const qt: ManualQuestionType = "writing";
    expect(qt).toBe("writing");
  });

  it("ManualWritingQuestion has correct shape with all fields", () => {
    const question: ManualWritingQuestion = {
      id: "test-writing-1",
      type: "writing",
      prompt: "Write a letter to your friend about your recent holiday.",
      image: {
        dataUrl: "data:image/png;base64,abc123",
        previewUrl: "https://cdn.example.com/images/holiday.png",
        fileName: "holiday.png",
        mimeType: "image/png",
        size: 204800,
      },
      minWords: 80,
      maxWords: 150,
      referenceAnswer: "Dear Tom, I had a wonderful holiday...",
    };
    expect(question.type).toBe("writing");
    expect(question.prompt).toContain("letter");
    expect(question.image).toBeDefined();
    expect(question.image!.fileName).toBe("holiday.png");
    expect(question.minWords).toBe(80);
    expect(question.maxWords).toBe(150);
    expect(question.referenceAnswer).toContain("wonderful");
  });

  it("ManualWritingQuestion works with minimal fields (no image, no word count, no reference)", () => {
    const question: ManualWritingQuestion = {
      id: "test-writing-2",
      type: "writing",
      prompt: "Describe your favorite animal.",
    };
    expect(question.type).toBe("writing");
    expect(question.prompt).toContain("animal");
    expect(question.image).toBeUndefined();
    expect(question.minWords).toBeUndefined();
    expect(question.maxWords).toBeUndefined();
    expect(question.referenceAnswer).toBeUndefined();
  });

  it("ManualSubsection supports writing question type", () => {
    const subsection: ManualSubsection = {
      id: "sub-writing-1",
      title: "Essay Writing",
      instructions: "Write an essay on the given topic.",
      questionType: "writing",
      questions: [
        {
          id: "q-1",
          type: "writing",
          prompt: "Write about your favorite place to visit.",
          minWords: 100,
          maxWords: 200,
        },
      ],
    };
    expect(subsection.questionType).toBe("writing");
    expect(subsection.questions).toHaveLength(1);
    expect(subsection.wordBank).toBeUndefined();
    expect(subsection.passageText).toBeUndefined();
  });

  it("ManualSubsection supports writing with image prompt", () => {
    const subsection: ManualSubsection = {
      id: "sub-writing-2",
      title: "Picture Writing",
      instructions: "Look at the picture and write a story.",
      questionType: "writing",
      questions: [
        {
          id: "q-1",
          type: "writing",
          prompt: "Look at the picture below and write a story about what is happening.",
          image: {
            dataUrl: "data:image/jpeg;base64,xyz",
            fileName: "scene.jpg",
            mimeType: "image/jpeg",
            size: 102400,
          },
        },
      ],
    };
    expect(subsection.questionType).toBe("writing");
    const writingQ = subsection.questions[0] as ManualWritingQuestion;
    expect(writingQ.image).toBeDefined();
    expect(writingQ.image!.fileName).toBe("scene.jpg");
  });

  it("passage-matching question type is assignable", () => {
    const qt: ManualQuestionType = "passage-matching";
    expect(qt).toBe("passage-matching");
  });

  it("ManualPassageMatchingQuestion has correct shape", () => {
    const question: ManualPassageMatchingQuestion = {
      id: "test-matching-1",
      type: "passage-matching",
      prompt: "Thomas and his sister enjoy eating French food.",
      correctAnswer: "C",
    };
    expect(question.type).toBe("passage-matching");
    expect(question.prompt).toContain("Thomas");
    expect(question.correctAnswer).toBe("C");
  });

  it("ManualMatchingDescription has correct shape", () => {
    const desc: ManualMatchingDescription = {
      id: "desc-1",
      label: "A",
      name: "Marina",
      text: "A cozy Italian restaurant with live jazz music.",
    };
    expect(desc.label).toBe("A");
    expect(desc.name).toBe("Marina");
    expect(desc.text).toContain("Italian");
  });

  it("ManualSubsection supports passage-matching with matchingDescriptions", () => {
    const subsection: ManualSubsection = {
      id: "sub-matching-1",
      title: "Restaurant Matching",
      instructions: "Match each person to the best restaurant.",
      questionType: "passage-matching",
      matchingDescriptions: [
        { id: "d1", label: "A", name: "Marina", text: "Italian food, live jazz" },
        { id: "d2", label: "B", name: "The Golden Wok", text: "Chinese food, family-friendly" },
        { id: "d3", label: "C", name: "Le Petit Bistro", text: "French food, live music" },
        { id: "d4", label: "D", name: "Sakura", text: "Japanese food, quiet atmosphere" },
        { id: "d5", label: "E", name: "El Toro", text: "Spanish food, outdoor seating" },
      ],
      questions: [
        {
          id: "q-1",
          type: "passage-matching",
          prompt: "Thomas and his sister enjoy eating French food. They want live music.",
          correctAnswer: "C",
        },
        {
          id: "q-2",
          type: "passage-matching",
          prompt: "Sarah wants a quiet place to eat Japanese food.",
          correctAnswer: "D",
        },
      ],
    };
    expect(subsection.questionType).toBe("passage-matching");
    expect(subsection.matchingDescriptions).toHaveLength(5);
    expect(subsection.matchingDescriptions![0].label).toBe("A");
    expect(subsection.matchingDescriptions![0].name).toBe("Marina");
    expect(subsection.questions).toHaveLength(2);
    expect(subsection.wordBank).toBeUndefined();
    expect(subsection.passageText).toBeUndefined();
  });

  it("ManualSubsection matchingDescriptions is optional", () => {
    const subsection: ManualSubsection = {
      id: "sub-no-matching",
      title: "MCQ Block",
      instructions: "",
      questionType: "mcq",
      questions: [],
    };
    expect(subsection.matchingDescriptions).toBeUndefined();
  });
});
