import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({
    key,
    url: `https://local.test/${key}`,
  })),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { buildAIPaperDraft } from "./paperAIDraftParser";

function toBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

const mockInvokeLLM = vi.mocked(invokeLLM);

describe("buildAIPaperDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds an AI draft from multi-round structured extraction", async () => {
    mockInvokeLLM
      .mockResolvedValueOnce({
        id: "round-1",
        created: Date.now(),
        model: "gemini-2.5-pro",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify({
                overview: "Two main sections found.",
                sections: [
                  {
                    sectionRef: "section-1",
                    title: "Vocabulary Part 1",
                    sectionKey: "vocabulary",
                    instructions: "Choose the correct answer.",
                    sourceExcerpt: "1. Apple\n2. Banana",
                    questionCountHint: 2,
                    assetFileIds: [],
                    notes: ["Questions appear clearly in the text."],
                  },
                  {
                    sectionRef: "section-2",
                    title: "Listening Part 1",
                    sectionKey: "listening",
                    instructions: "Listen and choose the correct picture.",
                    sourceExcerpt: "3. What is the boy carrying?\n4. Where are they going?",
                    questionCountHint: 2,
                    assetFileIds: ["image1"],
                    notes: ["Listening image likely supports this section."],
                  },
                ],
              }),
            },
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        id: "round-2",
        created: Date.now(),
        model: "gemini-2.5-pro",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify({
                rawAnswerSummary: "Vocabulary answers and listening answers found.",
                globalNotes: ["Audio should be checked against timestamps."],
                sections: [
                  {
                    sectionRef: "section-1",
                    answerExcerpt: "1 A\n2 C",
                    assetFileIds: [],
                    notes: ["Answer key is short and direct."],
                  },
                  {
                    sectionRef: "section-2",
                    answerExcerpt: "3 B\n4 C",
                    assetFileIds: ["audio1", "image1"],
                    notes: ["Attach both audio and image assets during review."],
                  },
                ],
              }),
            },
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        id: "round-3",
        created: Date.now(),
        model: "gemini-2.5-pro",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify({
                warnings: ["Listening image mapping still needs human confirmation."],
                nextSteps: [
                  "Check listening asset mapping before publishing.",
                  "Review the extracted answers against the official key.",
                ],
              }),
            },
          },
        ],
      } as any);

    const draft = await buildAIPaperDraft({
      title: "AI Imported PET Draft",
      subtitle: "Gemini extraction",
      description: "Draft produced by multi-round AI extraction.",
      subject: "english",
      category: "assessment",
      tags: ["PET", "AI"],
      files: [
        {
          id: "question1",
          role: "question_pdf",
          fileName: "questions.txt",
          contentType: "text/plain",
          fileBase64: toBase64(`
Vocabulary Part 1
Choose the correct answer.
1. Apple
2. Banana

Listening Part 1
Listen and choose the correct picture.
3. What is the boy carrying?
4. Where are they going?
          `),
        },
        {
          id: "answer1",
          role: "answer_pdf",
          fileName: "answers.txt",
          contentType: "text/plain",
          fileBase64: toBase64(`
Vocabulary Part 1
1 A
2 C

Listening Part 1
3 B
4 C
          `),
        },
        {
          id: "audio1",
          role: "audio",
          fileName: "listening.mp3",
          contentType: "audio/mpeg",
          fileBase64: Buffer.from("audio").toString("base64"),
        },
        {
          id: "image1",
          role: "image",
          fileName: "question.png",
          contentType: "image/png",
          fileBase64: Buffer.from("image").toString("base64"),
        },
      ],
    });

    expect(mockInvokeLLM).toHaveBeenCalledTimes(3);
    expect(mockInvokeLLM.mock.calls.every(([params]) => params.model === "gemini-2.5-pro")).toBe(true);
    expect(draft.parserMode).toBe("llm-draft");
    expect(draft.sections).toHaveLength(2);
    expect(draft.sections[0].answerExcerpt).toContain("1 A");
    expect(draft.sections[1].assetUrls.some((url) => url.endsWith("listening.mp3"))).toBe(true);
    expect(draft.sections[1].assetUrls.some((url) => url.endsWith("question.png"))).toBe(true);
    expect(draft.warnings).toContain("Listening image mapping still needs human confirmation.");
    expect(draft.nextSteps[0]).toContain("Check listening asset mapping");
  });
});
