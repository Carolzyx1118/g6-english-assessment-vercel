import fs from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({
    key,
    url: `https://storage.example.com/${key}`,
  })),
}));

import { appRouter } from "./routers";
import { storagePut } from "./storage";
import type { TrpcContext } from "./_core/context";

const TEST_STORE_PATH = path.resolve(import.meta.dirname, "..", "tmp", "paper-router-assets.test.json");
const IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const AUDIO_DATA_URL = "data:audio/mpeg;base64,SGVsbG8gd29ybGQ=";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

function makeListeningBlueprint() {
  return {
    id: "manual-listening-paper",
    title: "Listening Paper",
    description: "Listening asset persistence test",
    createdAt: "2026-03-24T00:00:00.000Z",
    sections: [
      {
        id: "section-1",
        partLabel: "Part 1",
        sectionType: "listening",
        subsections: [
          {
            id: "sub-1",
            title: "Listening MCQ",
            instructions: "Listen and choose.",
            questionType: "mcq",
            sceneImage: {
              dataUrl: IMAGE_DATA_URL,
              previewUrl: IMAGE_DATA_URL,
              fileName: "scene.png",
              mimeType: "image/png",
              size: 128,
            },
            audio: {
              dataUrl: AUDIO_DATA_URL,
              previewUrl: AUDIO_DATA_URL,
              fileName: "clip.mp3",
              mimeType: "audio/mpeg",
              size: 256,
            },
            questions: [
              {
                id: "q-1",
                type: "mcq",
                prompt: "What did you hear?",
                options: [
                  {
                    id: "o-1",
                    label: "A",
                    text: "Option A",
                    image: {
                      dataUrl: IMAGE_DATA_URL,
                      previewUrl: IMAGE_DATA_URL,
                      fileName: "option-a.png",
                      mimeType: "image/png",
                      size: 64,
                    },
                  },
                  { id: "o-2", label: "B", text: "Option B" },
                ],
                correctAnswer: "A",
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("paper router asset persistence", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "";
    process.env.LOCAL_MANUAL_PAPERS_FILE = TEST_STORE_PATH;
    await fs.rm(TEST_STORE_PATH, { force: true });
    vi.mocked(storagePut).mockClear();
  });

  afterEach(async () => {
    await fs.rm(TEST_STORE_PATH, { force: true });
    delete process.env.LOCAL_MANUAL_PAPERS_FILE;
  });

  it("persists listening audio and images on initial save", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await caller.papers.saveManualPaper({
      paperId: "manual-listening-paper",
      title: "Listening Paper",
      description: "Listening asset persistence test",
      published: false,
      blueprintJson: JSON.stringify(makeListeningBlueprint()),
    });

    expect(storagePut).toHaveBeenCalledTimes(3);

    const fileContents = JSON.parse(await fs.readFile(TEST_STORE_PATH, "utf8"));
    const savedBlueprint = JSON.parse(fileContents.papers[0].blueprintJson);
    const subsection = savedBlueprint.sections[0].subsections[0];

    expect(subsection.audio.dataUrl).toMatch(/^https:\/\/storage\.example\.com\/paper-assets\/audio-/);
    expect(subsection.audio.previewUrl).toBe(subsection.audio.dataUrl);
    expect(subsection.sceneImage.dataUrl).toMatch(/^https:\/\/storage\.example\.com\/paper-assets\/image-/);
    expect(subsection.questions[0].options[0].image.dataUrl).toMatch(
      /^https:\/\/storage\.example\.com\/paper-assets\/image-/,
    );
  });

  it("persists newly edited listening assets on update", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const saved = await caller.papers.saveManualPaper({
      paperId: "manual-listening-update-paper",
      title: "Listening Paper",
      description: "Listening asset persistence test",
      published: false,
      blueprintJson: JSON.stringify(makeListeningBlueprint()),
    });

    vi.mocked(storagePut).mockClear();

    const updatedBlueprint = makeListeningBlueprint();
    updatedBlueprint.sections[0].subsections[0].audio = {
      dataUrl: "data:audio/mpeg;base64,VXBkYXRlZCBhdWRpbw==",
      previewUrl: "data:audio/mpeg;base64,VXBkYXRlZCBhdWRpbw==",
      fileName: "clip-updated.mp3",
      mimeType: "audio/mpeg",
      size: 300,
    };
    updatedBlueprint.sections[0].subsections[0].questions[0].options[0].image = {
      dataUrl: IMAGE_DATA_URL,
      previewUrl: IMAGE_DATA_URL,
      fileName: "option-a-updated.png",
      mimeType: "image/png",
      size: 96,
    };

    await caller.papers.updateManualPaper({
      id: saved.id,
      title: "Listening Paper Updated",
      description: "Updated",
      published: false,
      blueprintJson: JSON.stringify(updatedBlueprint),
    });

    expect(storagePut).toHaveBeenCalledTimes(3);

    const fileContents = JSON.parse(await fs.readFile(TEST_STORE_PATH, "utf8"));
    const savedBlueprint = JSON.parse(fileContents.papers[0].blueprintJson);
    const subsection = savedBlueprint.sections[0].subsections[0];

    expect(fileContents.papers[0].title).toBe("Listening Paper Updated");
    expect(subsection.audio.dataUrl).toMatch(/^https:\/\/storage\.example\.com\/paper-assets\/audio-/);
    expect(subsection.questions[0].options[0].image.dataUrl).toMatch(
      /^https:\/\/storage\.example\.com\/paper-assets\/image-/,
    );
  });
});
