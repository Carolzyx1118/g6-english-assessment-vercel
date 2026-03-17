import { describe, expect, it } from "vitest";
import { countBlueprintQuestions } from "@shared/blueprintToPaper";
import { generatePaperFromTaggedSources, getBlueprintBuildMode } from "@shared/taggedPaperGenerator";
import type { ManualPaperBlueprint } from "@shared/manualPaperBlueprint";

function makeFixedBlueprint(id: string, prompt: string, unit: string): ManualPaperBlueprint {
  return {
    id,
    title: id,
    description: "Question bank source",
    createdAt: "2026-03-17T00:00:00.000Z",
    buildMode: "fixed",
    visibilityMode: "question-bank",
    sections: [
      {
        id: `${id}-section`,
        partLabel: "Part 1",
        sectionType: "reading",
        subsections: [
          {
            id: `${id}-subsection`,
            title: "",
            instructions: "",
            questionType: "mcq",
            questions: [
              {
                id: `${id}-question`,
                type: "mcq",
                prompt,
                options: [
                  { id: `${id}-a`, label: "A", text: "A" },
                  { id: `${id}-b`, label: "B", text: "B" },
                ],
                correctAnswer: "A",
                tags: {
                  english: {
                    track: "ket",
                    entries: ["教材配套"],
                    unit,
                    ability: "阅读理解",
                    grammarPoints: [],
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("tagged random paper generation", () => {
  it("builds a generated paper from matching tagged source questions", () => {
    const sourceA = makeFixedBlueprint("source-a", "Read question A", "Unit 1");
    const sourceB = makeFixedBlueprint("source-b", "Read question B", "Unit 2");
    const generatedBlueprint: ManualPaperBlueprint = {
      id: "generated-paper",
      title: "Generated Paper",
      description: "Randomized from tags",
      createdAt: "2026-03-17T00:00:00.000Z",
      buildMode: "generated",
      visibilityMode: "student",
      sections: [],
      generationConfig: {
        sourcePaperIds: ["source-a", "source-b"],
        sections: [
          {
            id: "generated-section",
            title: "Reading Mix",
            sectionType: "reading",
            totalQuestions: 2,
            rules: [
              {
                id: "rule-1",
                label: "KET Reading Units",
                weight: 1,
                filters: {
                  track: "ket",
                  abilities: ["阅读理解"],
                  questionTypes: ["mcq"],
                },
              },
            ],
          },
        ],
      },
    };

    const result = generatePaperFromTaggedSources(generatedBlueprint, [
      { paperId: "source-a", title: "Source A", blueprint: sourceA },
      { paperId: "source-b", title: "Source B", blueprint: sourceB },
    ]);

    expect(getBlueprintBuildMode(result.blueprint)).toBe("generated");
    expect(result.blueprint.sections).toHaveLength(1);
    expect(result.blueprint.sections[0].subsections).toHaveLength(2);
    expect(result.blueprint.sections[0].subsections[0]?.questions[0]?.type).toBe("mcq");
    expect(countBlueprintQuestions(result.blueprint)).toBe(2);
  });

  it("counts target questions for generated blueprints even before runtime assembly", () => {
    const generatedBlueprint: ManualPaperBlueprint = {
      id: "generated-paper",
      title: "Generated Paper",
      description: "Randomized from tags",
      createdAt: "2026-03-17T00:00:00.000Z",
      buildMode: "generated",
      visibilityMode: "student",
      sections: [],
      generationConfig: {
        sourcePaperIds: [],
        sections: [
          {
            id: "generated-reading",
            title: "Reading",
            sectionType: "reading",
            totalQuestions: 6,
            rules: [
              {
                id: "rule-1",
                label: "All reading",
                weight: 1,
                filters: {},
              },
            ],
          },
          {
            id: "generated-writing",
            title: "Writing",
            sectionType: "writing",
            totalQuestions: 1,
            rules: [
              {
                id: "rule-2",
                label: "All writing",
                weight: 1,
                filters: {},
              },
            ],
          },
        ],
      },
    };

    expect(countBlueprintQuestions(generatedBlueprint)).toBe(7);
  });
});
