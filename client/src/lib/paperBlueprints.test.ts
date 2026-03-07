import { describe, expect, it } from "vitest";

import {
  createEditablePaperFromBlueprint,
  createEditablePaperFromParsed,
  getBlueprintById,
  stripEditablePaper,
  suggestBlueprint,
} from "./paperBlueprints";

describe("paperBlueprints", () => {
  it("builds the G2-3 blueprint from the existing paper structure", () => {
    const blueprint = getBlueprintById("g2-3");

    expect(blueprint).toBeDefined();
    expect(blueprint?.sections.map((section) => section.id)).toEqual([
      "vocabulary",
      "grammar",
      "listening",
      "reading",
    ]);
    expect(blueprint?.sections[0].supportedQuestionTypes).toEqual(["picture-mcq"]);
    expect(blueprint?.sections[1].supportedQuestionTypes).toEqual([
      "mcq",
      "picture-mcq",
      "fill-blank",
    ]);
    expect(blueprint?.sections[2].supportedQuestionTypes).toEqual(["listening-mcq"]);
    expect(blueprint?.sections[3].supportedQuestionTypes).toEqual([
      "wordbank-fill",
      "story-fill",
    ]);
  });

  it("creates an editable G6 draft with empty but structured question slots", () => {
    const paper = createEditablePaperFromBlueprint("g6");
    const readingSection = paper.sections.find((section) => section.id === "reading");

    expect(paper.title).toBe("G6 English Assessment");
    expect(readingSection?.questions).toHaveLength(10);
    expect(readingSection?.questions[0].type).toBe("open-ended");
    expect(readingSection?.questions[2].type).toBe("true-false");
    expect((readingSection?.questions[2] as any).statements).toHaveLength(3);
    expect((readingSection?.questions[4] as any).rows).toHaveLength(2);
    expect((readingSection?.questions[6] as any).items).toHaveLength(3);
  });

  it("keeps only runtime paper fields when stripping editable metadata", () => {
    const editable = createEditablePaperFromBlueprint("g2-3");
    const cleanPaper = stripEditablePaper(editable);
    const firstSection = cleanPaper.sections[0] as any;

    expect(cleanPaper.totalQuestions).toBe(editable.totalQuestions);
    expect(firstSection.supportedQuestionTypes).toBeUndefined();
    expect(firstSection.blueprintSummary).toBeUndefined();
  });

  it("converts an AI parsed payload into an editable draft", () => {
    const editable = createEditablePaperFromParsed({
      title: "Parsed Paper",
      sections: [
        {
          id: "reading",
          title: "Reading",
          subtitle: "",
          icon: "📚",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          description: "Read and answer",
          questions: [
            { id: 1, type: "mcq", question: "Q1", options: ["A", "B"], correctAnswer: 0 },
            {
              id: 2,
              type: "true-false",
              statements: [{ label: "a", statement: "Test", isTrue: true, reason: "Because" }],
            },
          ],
        },
      ],
      readingWordBank: [{ word: "coffee", imageUrl: "https://example.com/coffee.png" }],
    });

    expect(editable.blueprintId).toBe("ai-parsed");
    expect(editable.sections[0].supportedQuestionTypes).toEqual(["mcq", "true-false"]);
    expect(editable.readingWordBank).toHaveLength(1);
  });

  it("normalizes malformed parsed image fields so the editor can still render", () => {
    const editable = createEditablePaperFromParsed({
      title: "Messy Parsed Paper",
      sections: [
        {
          id: "reading",
          title: "Reading",
          subtitle: "",
          icon: "📚",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          description: "Read and answer",
          sceneImageUrl: { url: "https://example.com/scene.png" },
          wordBankImageUrl: { imageUrl: "https://example.com/bank.png" },
          storyImages: { url: "https://example.com/story-1.png" },
          storyParagraphs: [
            "Paragraph one",
            { paragraph: "Paragraph two", questions: ["3", 4] },
          ],
          questions: [
            { id: 1, type: "mcq", question: "Q1", options: ["A", "B"], correctAnswer: 0 },
          ],
        },
      ],
      readingWordBank: [
        "coffee",
        { label: "a dentist", url: "https://example.com/dentist.png" },
      ] as any,
    });

    expect(editable.sections[0].sceneImageUrl).toBe("https://example.com/scene.png");
    expect(editable.sections[0].wordBankImageUrl).toBe("https://example.com/bank.png");
    expect(editable.sections[0].storyImages).toEqual(["https://example.com/story-1.png"]);
    expect(editable.sections[0].storyParagraphs).toEqual([
      { text: "Paragraph one", questionIds: [] },
      { text: "Paragraph two", questionIds: [3, 4] },
    ]);
    expect(editable.readingWordBank).toEqual([
      { word: "coffee", imageUrl: "" },
      { word: "a dentist", imageUrl: "https://example.com/dentist.png" },
    ]);
  });

  it("suggests G2-3 when audio assets are uploaded", () => {
    const result = suggestBlueprint([
      { name: "listening-part.mp3", type: "audio/mpeg" },
    ]);

    expect(result.blueprintId).toBe("g2-3");
  });

  it("suggests G6 when file names mention composition or grade 6", () => {
    const result = suggestBlueprint(
      [{ name: "G6 composition paper.pdf", type: "application/pdf" }],
      "Secondary entrance writing paper"
    );

    expect(result.blueprintId).toBe("g6");
  });
});
