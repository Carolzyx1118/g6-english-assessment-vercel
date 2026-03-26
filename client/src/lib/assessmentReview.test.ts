import { describe, expect, it } from "vitest";
import type { Paper } from "@/data/papers";
import { buildAssessmentReviewModel, type AssessmentReviewRecord } from "./assessmentReview";
import { packStoredAssessmentPayloadForResultStorage } from "./resultStorage";

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
      answersJson: packStoredAssessmentPayloadForResultStorage(
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

  it("prefers the AI-generated reference answer for open-ended review items", () => {
    const generatedPaper: Paper = {
      id: "tag-system-english-open-ended",
      title: "Generated Open Ended Assessment",
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
          passage: "The passage explains how digital minimalism can reduce distraction.",
          questions: [
            {
              id: 2,
              type: "open-ended",
              question: "How can digital minimalism improve quality of life?",
              correctAnswer: "",
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
      totalCorrect: 0,
      totalQuestions: 1,
      totalTimeSeconds: 95,
      answersJson: packStoredAssessmentPayloadForResultStorage(
        {},
        generatedPaper,
      ),
      scoreBySectionJson: JSON.stringify({
        "generated-reading": { correct: 0, total: 0 },
      }),
      sectionTimingsJson: JSON.stringify({
        "generated-reading": 95,
      }),
      readingResultsJson: JSON.stringify([
        {
          questionId: "generated-reading::2",
          isCorrect: false,
          score: 0,
          referenceAnswer: "It can improve quality of life by reducing distractions and creating more time for meaningful activities.",
          feedback_en: "No answer was submitted.",
          feedback_cn: "本题未作答。",
          explanation_en: "A complete response should mention less distraction and more focused time.",
          explanation_cn: "完整答案应提到减少干扰以及获得更多专注时间。",
        },
      ]),
      writingResultJson: null,
      explanationsJson: null,
      reportJson: null,
      createdAt: new Date("2026-03-25T12:00:00.000Z"),
    };

    const model = buildAssessmentReviewModel(record);

    expect(model.sections[0]?.details[0]?.correctAnswer).toContain("reducing distractions");
    expect(model.sections[0]?.details[0]?.userAnswer).toBe("Not Answered");
  });

  it("keeps full question materials on review details for generated history records", () => {
    const generatedPaper: Paper = {
      id: "tag-system-english-rich-review",
      title: "Generated Rich Review",
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
          taskDescription: "Read the passage carefully.",
          sectionType: "reading",
          passage: "This passage only exists inside the generated paper snapshot.",
          sceneImageUrl: "https://example.com/scene.png",
          manualBlocks: [
            {
              id: "block-1",
              displayNumber: 1,
              questionIds: [3],
              taskDescription: "Answer both sub-questions.",
              passage: "Block-level passage text.",
            },
          ],
          questions: [
            {
              id: 3,
              type: "open-ended",
              question: "Answer the questions below.",
              subQuestions: [
                { label: "a", question: "What is the main idea?", answer: "It is about focus." },
                { label: "b", question: "What image is shown?", answer: "A blue whale." },
              ],
              imageUrl: "https://example.com/question.png",
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
      totalQuestions: 2,
      totalTimeSeconds: 95,
      answersJson: packStoredAssessmentPayloadForResultStorage(
        {
          "generated-reading:3": {
            a: "It is about focus.",
            b: "",
          },
        },
        generatedPaper,
      ),
      scoreBySectionJson: JSON.stringify({
        "generated-reading": { correct: 1, total: 2 },
      }),
      sectionTimingsJson: JSON.stringify({
        "generated-reading": 95,
      }),
      readingResultsJson: JSON.stringify([
        {
          questionId: "generated-reading::3-a",
          isCorrect: true,
          score: 1,
          referenceAnswer: "It is about focus.",
          feedback_en: "Good.",
          feedback_cn: "很好。",
          explanation_en: "The answer identifies the main idea.",
          explanation_cn: "答案抓住了主旨。",
        },
        {
          questionId: "generated-reading::3-b",
          isCorrect: false,
          score: 0,
          referenceAnswer: "A blue whale.",
          feedback_en: "Missing answer.",
          feedback_cn: "未作答。",
          explanation_en: "The image shows a blue whale.",
          explanation_cn: "图片展示的是一只蓝鲸。",
        },
      ]),
      writingResultJson: null,
      explanationsJson: null,
      reportJson: null,
      createdAt: new Date("2026-03-25T12:00:00.000Z"),
    };

    const model = buildAssessmentReviewModel(record);
    const firstDetail = model.sections[0]?.details[0];
    const secondDetail = model.sections[0]?.details[1];

    expect(model.sections[0]?.details).toHaveLength(2);
    expect(firstDetail?.questionType).toBe("open-ended-sub");
    expect(firstDetail?.questionText).toBe("What is the main idea?");
    expect(firstDetail?.sectionPassage).toBe("Block-level passage text.");
    expect(firstDetail?.questionImageUrl).toBe("https://example.com/question.png");
    expect(firstDetail?.taskDescription).toBe("Answer both sub-questions.");
    expect(secondDetail?.correctAnswer).toBe("A blue whale.");
  });
});
