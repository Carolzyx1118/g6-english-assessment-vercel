import { describe, expect, it } from "vitest";
import type { Paper } from "@/data/papers";
import { buildAssessmentReviewModel, type AssessmentReviewRecord } from "./assessmentReview";
import { packStoredAssessmentPayload } from "./storedAssessmentPayload";

describe("assessmentReview", () => {
  it("builds history review from the stored generated paper snapshot instead of built-in papers", () => {
    const generatedPaper: Paper = {
      id: "tag-system-english-custom-unit-7",
      title: "Generated Unit 7 Assessment",
      subtitle: "Custom generated paper",
      description: "A generated assessment.",
      icon: "🧪",
      color: "#1d4ed8",
      subject: "english",
      category: "assessment",
      isGeneratedPaper: true,
      totalQuestions: 1,
      hasListening: false,
      hasWriting: false,
      sections: [
        {
          id: "generated-reading",
          title: "Generated Reading",
          subtitle: "AI generated section",
          icon: "📘",
          color: "text-sky-700",
          bgColor: "bg-sky-50",
          description: "Generated reading practice",
          sectionType: "reading",
          passage: "This passage only exists inside the generated paper snapshot.",
          questions: [
            {
              id: 1,
              type: "mcq",
              question: "Which animal appears in the generated passage?",
              options: ["fox", "whale", "tiger", "bear"],
              correctAnswer: 1,
            },
          ],
        },
      ],
    };

    const record: AssessmentReviewRecord = {
      studentName: "Generated Student",
      studentGrade: "G6",
      paperId: "unknown",
      paperTitle: "Assessment",
      totalCorrect: 1,
      totalQuestions: 1,
      totalTimeSeconds: 95,
      answersJson: packStoredAssessmentPayload(
        { "generated-reading:1": 1 },
        generatedPaper,
      ),
      scoreBySectionJson: JSON.stringify({
        "generated-reading": { correct: 1, total: 1 },
      }),
      sectionTimingsJson: JSON.stringify({
        "generated-reading": 95,
      }),
      readingResultsJson: null,
      writingResultJson: null,
      explanationsJson: null,
      reportJson: null,
      createdAt: new Date("2026-03-25T12:00:00.000Z"),
    };

    const model = buildAssessmentReviewModel(record);

    expect(model.paper?.id).toBe("tag-system-english-custom-unit-7");
    expect(model.paper?.title).toBe("Generated Unit 7 Assessment");
    expect(model.sections).toHaveLength(1);
    expect(model.sections[0]?.sectionId).toBe("generated-reading");
    expect(model.sections[0]?.sectionTitle).toBe("Generated Reading");
    expect(model.sections[0]?.details[0]?.questionText).toContain("Which animal appears in the generated passage?");
    expect(model.sections[0]?.details[0]?.correctAnswer).toBe("whale");
    expect(model.sections[0]?.details[0]?.userAnswer).toBe("whale");
  });
});
