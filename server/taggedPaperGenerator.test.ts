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

function makeAssessmentFallbackBlueprint(id: string, prompt: string): ManualPaperBlueprint {
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
                    entries: ["Exam Bank"],
                    ability: "Reading",
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

function makeMathFixedBlueprint(id: string, prompt: string, examPart: string): ManualPaperBlueprint {
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
        sectionType: "math-multiple-choice",
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
                  math: {
                    track: "school-math",
                    examPart,
                    unit: "Unit 3",
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

  it("matches math tag filters outside English", () => {
    const sourceA = makeMathFixedBlueprint("math-a", "Math question A", "Multiple Choice Part 1");
    const sourceB = makeMathFixedBlueprint("math-b", "Math question B", "Word Problem Part 1");
    const generatedBlueprint: ManualPaperBlueprint = {
      id: "generated-math-paper",
      title: "Generated Math Paper",
      description: "Randomized from math tags",
      createdAt: "2026-03-17T00:00:00.000Z",
      buildMode: "generated",
      visibilityMode: "student",
      sections: [],
      generationConfig: {
        sourcePaperIds: ["math-a", "math-b"],
        sections: [
          {
            id: "generated-math-section",
            title: "Math Mix",
            sectionType: "math-multiple-choice",
            totalQuestions: 1,
            rules: [
              {
                id: "rule-math-1",
                label: "Math MCQ",
                weight: 1,
                filters: {
                  track: "school-math",
                  examPart: "Multiple Choice Part 1",
                  questionTypes: ["mcq"],
                },
              },
            ],
          },
        ],
      },
    };

    const result = generatePaperFromTaggedSources(generatedBlueprint, [
      { paperId: "math-a", title: "Math A", blueprint: sourceA },
      { paperId: "math-b", title: "Math B", blueprint: sourceB },
    ]);

    expect(result.blueprint.sections).toHaveLength(1);
    expect(result.blueprint.sections[0].subsections).toHaveLength(1);
    expect(result.blueprint.sections[0].subsections[0]?.questions[0]?.prompt).toBe("Math question A");
  });

  it("allows assessment frameworks to pull questions without an explicit exam part tag", () => {
    const source = makeAssessmentFallbackBlueprint("english-a", "Fallback reading question");
    const generatedBlueprint: ManualPaperBlueprint = {
      id: "generated-assessment-paper",
      title: "Generated Assessment Paper",
      description: "Randomized from assessment structure",
      createdAt: "2026-03-17T00:00:00.000Z",
      buildMode: "generated",
      visibilityMode: "student",
      sections: [],
      generationConfig: {
        sourcePaperIds: ["english-a"],
        sections: [
          {
            id: "generated-reading-section",
            title: "Reading Part 1",
            sectionType: "reading",
            totalQuestions: 1,
            rules: [
              {
                id: "rule-reading-1",
                label: "Reading Part 1",
                weight: 1,
                filters: {
                  track: "ket",
                  examPart: "Reading Part 1",
                  questionTypes: ["mcq"],
                },
              },
            ],
          },
        ],
      },
    };

    const result = generatePaperFromTaggedSources(generatedBlueprint, [
      { paperId: "english-a", title: "English A", blueprint: source },
    ]);

    expect(result.blueprint.sections).toHaveLength(1);
    expect(result.blueprint.sections[0].subsections).toHaveLength(1);
    expect(result.blueprint.sections[0].subsections[0]?.questions[0]?.prompt).toBe("Fallback reading question");
  });
});
