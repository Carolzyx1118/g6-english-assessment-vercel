import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unmock("./env");
  vi.unstubAllGlobals();
});

describe("invokeLLM", () => {
  it("uses OpenAI chat completions when OPENAI_API_KEY is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl-1",
        created: 1,
        model: "gpt-4o-mini",
        choices: [],
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
      getLLMConfigErrorMessage: () => "",
    }));

    const { invokeLLM } = await import("./llm");
    await invokeLLM({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer openai-key"
    );

    const payload = JSON.parse(String(init.body));
    expect(payload.model).toBe("gpt-4o-mini");
    expect(payload.max_tokens).toBe(4096);
    expect(payload).not.toHaveProperty("thinking");
  });

  it("falls back to Forge chat completions when OpenAI is not configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl-2",
        created: 1,
        model: "gemini-2.5-flash",
        choices: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

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
        forgeApiKey: "forge-key",
        blobReadWriteToken: "",
      },
      getLLMConfigErrorMessage: () => "",
    }));

    const { invokeLLM } = await import("./llm");
    await invokeLLM({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://forge.manus.im/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer forge-key"
    );

    const payload = JSON.parse(String(init.body));
    expect(payload.model).toBe("gemini-2.5-flash");
    expect(payload.max_tokens).toBe(32768);
    expect(payload.thinking).toEqual({ budget_tokens: 128 });
  });
});
