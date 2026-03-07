import { describe, expect, it } from "vitest";

import {
  createEditablePaperFromBlueprint,
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
