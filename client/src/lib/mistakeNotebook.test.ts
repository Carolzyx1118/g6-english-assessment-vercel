import { describe, expect, it } from "vitest";
import type { Paper } from "@/data/papers";
import type { AssessmentReviewRecord } from "@/lib/assessmentReview";
import { buildMistakeNotebook } from "@/lib/mistakeNotebook";
import { packStoredAssessmentPayloadForResultStorage } from "@/lib/resultStorage";

describe("mistakeNotebook", () => {
  it("collects and aggregates repeated wrong answers from saved student results", () => {
    const generatedPaper: Paper = {
      id: "tag-system-english-mistakes",
      title: "Mistake Practice",
      subtitle: "Generated practice",
      description: "Generated assessment for testing.",
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
          id: "reading",
          title: "Reading",
          subtitle: "Generated reading",
          icon: "📘",
          color: "text-sky-700",
          bgColor: "bg-sky-50",
          description: "Generated reading section",
          sectionType: "reading",
          passage: "A short generated passage.",
          questions: [
            {
              id: 1,
              type: "mcq",
              question: "Which answer is correct?",
              options: ["A", "B", "C", "D"],
              correctAnswer: 1,
            },
          ],
        },
      ],
    };

    const records: AssessmentReviewRecord[] = [
      {
        id: 101,
        studentName: "Student A",
        studentGrade: "G6",
        paperId: generatedPaper.id,
        paperTitle: generatedPaper.title,
        totalCorrect: 0,
        totalQuestions: 1,
        totalTimeSeconds: 40,
        answersJson: packStoredAssessmentPayloadForResultStorage(
          { "reading:1": 0 },
          generatedPaper,
          { username: "student_a", displayName: "Student A" },
        ),
        scoreBySectionJson: JSON.stringify({ reading: { correct: 0, total: 1 } }),
        sectionTimingsJson: JSON.stringify({ reading: 40 }),
        readingResultsJson: null,
        writingResultJson: null,
        explanationsJson: null,
        reportJson: null,
        createdAt: "2026-03-30T10:00:00.000Z",
      },
      {
        id: 102,
        studentName: "Student A",
        studentGrade: "G6",
        paperId: generatedPaper.id,
        paperTitle: generatedPaper.title,
        totalCorrect: 0,
        totalQuestions: 1,
        totalTimeSeconds: 43,
        answersJson: packStoredAssessmentPayloadForResultStorage(
          { "reading:1": 2 },
          generatedPaper,
          { username: "student_a", displayName: "Student A" },
        ),
        scoreBySectionJson: JSON.stringify({ reading: { correct: 0, total: 1 } }),
        sectionTimingsJson: JSON.stringify({ reading: 43 }),
        readingResultsJson: null,
        writingResultJson: null,
        explanationsJson: null,
        reportJson: null,
        createdAt: "2026-03-30T12:00:00.000Z",
      },
    ];

    const notebook = buildMistakeNotebook(records);

    expect(notebook).toHaveLength(1);
    expect(notebook[0]).toMatchObject({
      paperId: "tag-system-english-mistakes",
      paperSubject: "english",
      questionNum: "Q1",
      userAnswer: "C",
      correctAnswer: "B",
      mistakeCount: 2,
      latestRecordId: 102,
    });
  });
});
