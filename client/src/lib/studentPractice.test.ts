import { describe, expect, it } from "vitest";
import {
  buildPracticePaperFromCandidates,
  buildPracticeQuestionCandidates,
  filterPracticeQuestionCandidates,
} from "@/lib/studentPractice";
import type { ManualPaperBlueprint } from "@shared/manualPaperBlueprint";

describe("studentPractice", () => {
  it("builds filterable practice candidates and generates an instant-feedback paper", () => {
    const blueprint: ManualPaperBlueprint = {
      id: "practice-bank-1",
      title: "Grammar Bank",
      description: "Question bank for grammar practice.",
      buildMode: "fixed",
      visibilityMode: "question-bank",
      generationConfig: { sections: [] },
      createdAt: "2026-04-15T00:00:00.000Z",
      sections: [
        {
          id: "grammar-section",
          partLabel: "Part 1",
          sectionType: "grammar",
          subsections: [
            {
              id: "sub-1",
              title: "",
              instructions: "Choose the best answer.",
              questionType: "mcq",
              questions: [
                {
                  id: "q-1",
                  type: "mcq",
                  prompt: "If I ___ harder, I would pass.",
                  options: [
                    { id: "a", label: "A", text: "study" },
                    { id: "b", label: "B", text: "studied" },
                    { id: "c", label: "C", text: "had studied" },
                  ],
                  correctAnswer: "B",
                  tags: {
                    english: {
                      track: "KET",
                      entries: ["Exam Bank"],
                      unit: "Unit 3",
                      examPart: "Grammar Part 1",
                      ability: "Grammar",
                      grammarUnit: "Unit 3",
                      grammarPoints: ["Second Conditional"],
                      difficulty: "Intermediate",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const candidates = buildPracticeQuestionCandidates(
      [
        {
          paperId: "practice-bank-1",
          title: "Grammar Bank",
          subject: "english",
          blueprintJson: JSON.stringify(blueprint),
        },
      ],
      ["english"],
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.knowledgeTags).toContain("Second Conditional");

    const filtered = filterPracticeQuestionCandidates(candidates, {
      subject: "english",
      track: "KET",
      questionType: "mcq",
      difficulty: "Intermediate",
      knowledgeTags: ["Second Conditional"],
    });

    expect(filtered).toHaveLength(1);

    const paper = buildPracticePaperFromCandidates(filtered, "english");
    expect(paper).not.toBeNull();
    expect(paper?.instantFeedbackMode).toBe(true);
    expect(paper?.isEphemeralPaper).toBe(true);
    expect(paper?.sections).toHaveLength(1);
    expect(paper?.sections[0]?.questions[0]?.type).toBe("mcq");
  });
});
