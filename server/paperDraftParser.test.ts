import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({
    key,
    url: `https://local.test/${key}`,
  })),
}));

import { buildPaperDraft } from "./paperDraftParser";

function toBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

describe("buildPaperDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates section drafts from uploaded source material", async () => {
    const questionText = `
Vocabulary Part 1
Choose the correct answer for questions 1-3.
1. Apple
2. Banana

Listening Part 1
Listen and choose the correct picture for questions 4-5.
4. What is the boy carrying?
5. Where are they going?
    `;

    const answerText = `
Vocabulary Part 1
1 A
2 C

Listening Part 1
4 B
5 C
    `;

    const draft = await buildPaperDraft({
      title: "Imported PET Draft",
      subtitle: "Scaffold Preview",
      description: "Temporary import draft",
      subject: "english",
      category: "assessment",
      tags: ["PET", "draft"],
      files: [
        {
          id: "q1",
          role: "question_pdf",
          fileName: "questions.txt",
          contentType: "text/plain",
          fileBase64: toBase64(questionText),
        },
        {
          id: "a1",
          role: "answer_pdf",
          fileName: "answers.txt",
          contentType: "text/plain",
          fileBase64: toBase64(answerText),
        },
        {
          id: "audio1",
          role: "audio",
          fileName: "listening.mp3",
          contentType: "audio/mpeg",
          fileBase64: Buffer.from("fake-audio").toString("base64"),
        },
      ],
    });

    expect(draft.title).toBe("Imported PET Draft");
    expect(draft.sections).toHaveLength(2);
    expect(draft.sections[0].sectionKey).toBe("vocabulary");
    expect(draft.sections[0].answerExcerpt).toContain("1 A");
    expect(draft.sections[1].sectionKey).toBe("listening");
    expect(draft.sections[1].assetUrls.some((url) => url.endsWith("listening.mp3"))).toBe(true);
    expect(draft.sourceFiles).toHaveLength(3);
    expect(draft.suggestedPaperId).toBe("imported-pet-draft");
  });
});
