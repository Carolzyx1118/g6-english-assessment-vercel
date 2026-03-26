import { describe, expect, it } from "vitest";
import { blueprintToPaper } from "@shared/blueprintToPaper";
import type { ManualPaperBlueprint } from "@shared/manualPaperBlueprint";

describe("blueprintToPaper", () => {
  it("ensures runtime section ids stay unique even when source section ids repeat", () => {
    const blueprint: ManualPaperBlueprint = {
      id: "duplicate-reading-parts",
      title: "Duplicate Reading Parts",
      description: "Regression case for repeated reading section ids.",
      buildMode: "fixed",
      visibilityMode: "student",
      generationConfig: { sections: [] },
      createdAt: "2026-03-26T00:00:00.000Z",
      sections: [
        {
          id: "reading-part",
          partLabel: "Part 13",
          sectionType: "reading",
          subsections: [
            {
              id: "sub-1",
              title: "",
              instructions: "Read and answer.",
              questionType: "typed-fill-blank",
              questions: [
                {
                  id: "q-1",
                  type: "typed-fill-blank",
                  prompt: "Part 13 original question",
                  correctAnswer: "alpha",
                },
              ],
            },
          ],
        },
        {
          id: "reading-part",
          partLabel: "Part 15",
          sectionType: "reading",
          subsections: [
            {
              id: "sub-2",
              title: "",
              instructions: "Read and answer.",
              questionType: "typed-fill-blank",
              questions: [
                {
                  id: "q-2",
                  type: "typed-fill-blank",
                  prompt: "Part 15 later question",
                  correctAnswer: "beta",
                },
              ],
            },
          ],
        },
      ],
    };

    const paper = blueprintToPaper(blueprint);

    expect(paper.sections).toHaveLength(2);
    expect(paper.sections[0]?.id).toBe("reading-reading-part");
    expect(paper.sections[1]?.id).toBe("reading-reading-part__2");
    expect(paper.sections[0]?.questions[0]?.question).toBe("Part 13 original question");
    expect(paper.sections[1]?.questions[0]?.question).toBe("Part 15 later question");
  });
});
