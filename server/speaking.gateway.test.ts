import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: { host: "example.com" } } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

async function loadRouterWithAudioScoringEnv(overrides?: {
  useForge?: boolean;
  useGateway?: boolean;
  openaiApiKey?: string;
}) {
  vi.resetModules();
  const invokeLLMMock = vi.fn();
  const transcribeAudioMock = vi.fn();

  vi.doMock("./_core/llm", () => ({
    invokeLLM: invokeLLMMock,
  }));

  vi.doMock("./_core/voiceTranscription", () => ({
    transcribeAudio: transcribeAudioMock,
  }));

  vi.doMock("./_core/env", async () => {
    const actual = await vi.importActual<typeof import("./_core/env")>("./_core/env");
    return {
      ...actual,
      ENV: {
        ...actual.ENV,
        aiGatewayApiKey: overrides?.useGateway ? "gateway-key" : "",
        aiGatewayBaseUrl: "",
        aiGatewayModel: "openai/gpt-4o-mini",
        aiGatewaySpeakingModel: "gpt-audio",
        openaiApiBaseUrl: "",
        openaiApiKey: overrides?.openaiApiKey ?? "",
        openaiChatModel: "",
        openaiTranscriptionModel: "",
        forgeApiUrl: overrides?.useForge ? "https://forge.manus.im" : "",
        forgeApiKey: overrides?.useForge ? "forge-key" : "",
        blobReadWriteToken: "",
      },
    };
  });

  const { appRouter } = await import("./routers");

  return {
    appRouter,
    mockInvokeLLM: vi.mocked(invokeLLMMock),
    mockTranscribeAudio: vi.mocked(transcribeAudioMock),
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unmock("./_core/env");
  vi.unstubAllGlobals();
});

describe("grading.evaluateSpeaking with direct audio input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scores speaking directly from audio through the Gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      headers: {
        get: (header: string) =>
          header.toLowerCase() === "content-type" ? "audio/wav" : null,
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { appRouter, mockInvokeLLM, mockTranscribeAudio } =
      await loadRouterWithAudioScoringEnv({
        useGateway: true,
      });

    mockInvokeLLM
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcript: "I like this meal because my family cooks it on weekends.",
                score: 4,
                feedback_en: "The response is relevant and clear.",
                feedback_cn: "回答切题，也比较清楚。",
                taskCompletion_en: "The prompt was answered directly.",
                taskCompletion_cn: "能够直接回应题目。",
                fluency_en: "The response flows fairly smoothly.",
                fluency_cn: "整体表达比较流畅。",
                vocabulary_en: "Vocabulary is simple but appropriate.",
                vocabulary_cn: "词汇较基础，但使用恰当。",
                grammar_en: "Most sentence patterns are controlled well.",
                grammar_cn: "大部分句子结构控制得不错。",
                pronunciation_en: "Speech is generally clear.",
                pronunciation_cn: "整体表达较清晰。",
                suggestions_en: ["Add one more supporting detail."],
                suggestions_cn: ["可以再补充一个支持细节。"],
              }),
            },
          },
        ],
      } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateSpeaking({
      responses: [
        {
          sectionId: "speaking-part-4",
          sectionTitle: "Speaking Part 4",
          questionId: 104,
          prompt: "Talk about the special meal in more detail.",
          audioUrl: "/api/blob?key=sample-speaking.wav",
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/blob?key=sample-speaking.wav",
    );
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(mockInvokeLLM.mock.calls[0]?.[0]).toMatchObject({
      model: "openai/gpt-audio",
      modalities: ["text"],
    });
    const firstUserContent = mockInvokeLLM.mock.calls[0]?.[0].messages[1]?.content as any[];
    expect(firstUserContent[1]).toEqual({
      type: "input_audio",
      input_audio: {
        data: "AQIDBA==",
        format: "wav",
      },
    });
    expect(result.totalScore).toBe(4);
    expect(result.totalPossible).toBe(5);
    expect(result.reviewMode).toBe("ai");
    expect(result.manualReviewRequired).toBe(false);
    expect(result.evaluations[0].transcript).toContain("my family cooks it");
  });

  it("scores speaking directly from audio through Forge when the speech transcription endpoint is unavailable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { appRouter, mockInvokeLLM, mockTranscribeAudio } =
      await loadRouterWithAudioScoringEnv({
        useForge: true,
      });

    mockInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              transcript: "Hello teacher.",
              score: 4,
              feedback_en: "The response is short but clear.",
              feedback_cn: "回答较短，但比较清楚。",
              taskCompletion_en: "The prompt was answered directly.",
              taskCompletion_cn: "能够直接回应题目。",
              fluency_en: "The response is fluent.",
              fluency_cn: "表达比较流畅。",
              vocabulary_en: "Vocabulary is simple and accurate.",
              vocabulary_cn: "词汇简单且准确。",
              grammar_en: "Grammar is controlled well.",
              grammar_cn: "语法控制较好。",
              pronunciation_en: "Speech is generally clear.",
              pronunciation_cn: "发音整体较清晰。",
              suggestions_en: ["Add one more sentence."],
              suggestions_cn: ["可以再补充一句。"],
            }),
          },
        },
      ],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateSpeaking({
      responses: [
        {
          sectionId: "speaking-part-4",
          sectionTitle: "Speaking Part 4",
          questionId: 105,
          prompt: "Say hello to your teacher.",
          audioUrl: "/api/blob?key=forge-speaking.wav",
        },
      ],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(mockInvokeLLM.mock.calls[0]?.[0]).toMatchObject({
      modalities: ["text"],
      model: undefined,
    });
    const firstUserContent = mockInvokeLLM.mock.calls[0]?.[0].messages[1]?.content as any[];
    expect(firstUserContent[1]).toEqual({
      type: "file_url",
      file_url: {
        url: "https://example.com/api/blob?key=forge-speaking.wav",
        mime_type: "audio/wav",
      },
    });
    expect(result.totalScore).toBe(4);
    expect(result.totalPossible).toBe(5);
    expect(result.reviewMode).toBe("ai");
    expect(result.evaluations[0].transcript).toContain("Hello teacher");
  });

  it("falls back to transcription-based scoring when the saved audio format is not Gateway-compatible", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
      headers: {
        get: (header: string) =>
          header.toLowerCase() === "content-type" ? "audio/webm" : null,
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { appRouter, mockInvokeLLM, mockTranscribeAudio } =
      await loadRouterWithAudioScoringEnv({
        useGateway: true,
        openaiApiKey: "openai-key",
      });

    mockTranscribeAudio.mockResolvedValueOnce({
      text: "I like this meal because it is healthy and delicious.",
    } as any);
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              overallFeedback_en: "The student gave a relevant response.",
              overallFeedback_cn: "学生的回答比较切题。",
              evaluations: [
                {
                  sectionId: "speaking-part-4",
                  questionId: 104,
                  transcript: "I like this meal because it is healthy and delicious.",
                  score: 4,
                  feedback_en: "The answer is relevant and easy to follow.",
                  feedback_cn: "回答切题，也比较容易理解。",
                  taskCompletion_en: "The prompt was answered directly.",
                  taskCompletion_cn: "能够直接回应题目。",
                  fluency_en: "The response flows fairly smoothly.",
                  fluency_cn: "整体表达比较流畅。",
                  vocabulary_en: "Vocabulary is simple but appropriate.",
                  vocabulary_cn: "词汇较基础，但使用恰当。",
                  grammar_en: "Most sentence patterns are controlled well.",
                  grammar_cn: "大部分句子结构控制得不错。",
                  pronunciation_en: "Clarity appears generally good from the transcript evidence.",
                  pronunciation_cn: "从转写结果看，表达清晰度整体较好。",
                  suggestions_en: ["Add one more supporting detail."],
                  suggestions_cn: ["可以再补充一个支持细节。"],
                },
              ],
            }),
          },
        },
      ],
    } as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grading.evaluateSpeaking({
      responses: [
        {
          sectionId: "speaking-part-4",
          sectionTitle: "Speaking Part 4",
          questionId: 104,
          prompt: "Talk about the special meal in more detail.",
          audioUrl: "/api/blob?key=legacy-speaking.webm",
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockTranscribeAudio).toHaveBeenCalledTimes(1);
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(result.totalScore).toBe(4);
    expect(result.reviewMode).toBe("ai");
    expect(result.evaluations[0].transcript).toContain("healthy and delicious");
  });
});
