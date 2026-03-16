import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unmock("./env");
  vi.unstubAllGlobals();
});

describe("transcribeAudio", () => {
  it("uses OpenAI transcriptions when OPENAI_API_KEY is configured", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        headers: {
          get: (header: string) =>
            header.toLowerCase() === "content-type" ? "audio/webm" : null,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: "Hello world",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    vi.doMock("./env", () => ({
      ENV: {
        appId: "",
        cookieSecret: "",
        databaseUrl: "",
        openaiApiBaseUrl: "",
        openaiApiKey: "openai-key",
        openaiChatModel: "",
        openaiTranscriptionModel: "",
        oAuthServerUrl: "",
        ownerOpenId: "",
        isProduction: false,
        forgeApiUrl: "",
        forgeApiKey: "",
        blobReadWriteToken: "",
      },
      getSpeechConfigErrorMessage: () => "",
    }));

    const { transcribeAudio } = await import("./voiceTranscription");
    const result = await transcribeAudio({
      audioUrl: "https://example.com/audio.webm",
      language: "en",
      prompt: "Transcribe this clip.",
    });

    expect("error" in result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.openai.com/v1/audio/transcriptions"
    );

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect((request.headers as Record<string, string>).authorization).toBe(
      "Bearer openai-key"
    );

    const body = request.body as FormData;
    expect(body.get("model")).toBe("gpt-4o-mini-transcribe");
    expect(body.get("response_format")).toBe("json");
    expect(body.get("language")).toBe("en");
    expect(body.get("prompt")).toBe("Transcribe this clip.");
  });

  it("returns a configuration error when no speech provider is available", async () => {
    vi.doMock("./env", () => ({
      ENV: {
        appId: "",
        cookieSecret: "",
        databaseUrl: "",
        openaiApiBaseUrl: "",
        openaiApiKey: "",
        openaiChatModel: "",
        openaiTranscriptionModel: "",
        oAuthServerUrl: "",
        ownerOpenId: "",
        isProduction: false,
        forgeApiUrl: "",
        forgeApiKey: "",
        blobReadWriteToken: "",
      },
      getSpeechConfigErrorMessage: () =>
        "Voice transcription service is unavailable because neither OPENAI_API_KEY nor BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY is configured on the server.",
    }));

    const { transcribeAudio } = await import("./voiceTranscription");
    const result = await transcribeAudio({
      audioUrl: "https://example.com/audio.webm",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.code).toBe("SERVICE_ERROR");
      expect(result.details).toContain("OPENAI_API_KEY");
    }
  });
});
