import { ENV, getLLMConfigErrorMessage } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "audio/mp4"
      | "audio/webm"
      | "audio/ogg"
      | "audio/aac"
      | "application/pdf"
      | "video/mp4";
  };
};

export type AudioInputContent = {
  type: "input_audio";
  input_audio: {
    data: string;
    format: "wav" | "mp3";
  };
};

export type MessageContent =
  | string
  | TextContent
  | ImageContent
  | FileContent
  | AudioInputContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  model?: string;
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  modalities?: Array<"text" | "audio">;
  audio?: {
    voice: string;
    format: "wav" | "mp3";
  };
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent | AudioInputContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent | AudioInputContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  if (part.type === "input_audio") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

type LLMProviderConfig = {
  apiKey: string;
  apiUrl: string;
  defaultModel: string;
  defaultMaxTokens: number;
  provider: "forge" | "openai" | "vercel-ai-gateway";
};

const buildApiUrl = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");

  if (normalizedBase.endsWith("/v1") && normalizedPath.startsWith("v1/")) {
    return `${normalizedBase}/${normalizedPath.slice(3)}`;
  }

  return `${normalizedBase}/${normalizedPath}`;
};

const resolveSafeBaseUrl = (value: string, fallback: string) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  try {
    return new URL(trimmed).toString();
  } catch {
    console.warn(`[LLM] Ignoring invalid API base URL: ${trimmed}`);
    return fallback;
  }
};

const normalizeGatewayModel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "openai/gpt-4o-mini";
  }
  if (trimmed.includes("/")) {
    return trimmed;
  }
  return `openai/${trimmed}`;
};

const resolveProviderConfig = (): LLMProviderConfig => {
  if (ENV.aiGatewayApiKey) {
    return {
      provider: "vercel-ai-gateway",
      apiKey: ENV.aiGatewayApiKey,
      apiUrl: buildApiUrl(
        resolveSafeBaseUrl(
          ENV.aiGatewayBaseUrl,
          "https://ai-gateway.vercel.sh/v1"
        ),
        "v1/chat/completions"
      ),
      defaultModel: normalizeGatewayModel(ENV.aiGatewayModel || ENV.openaiChatModel),
      defaultMaxTokens: 4096,
    };
  }

  if (ENV.openaiApiKey) {
    return {
      provider: "openai",
      apiKey: ENV.openaiApiKey,
      apiUrl: buildApiUrl(
        resolveSafeBaseUrl(
          ENV.openaiApiBaseUrl,
          "https://api.openai.com"
        ),
        "v1/chat/completions"
      ),
      defaultModel: ENV.openaiChatModel || "gpt-4o-mini",
      defaultMaxTokens: 4096,
    };
  }

  return {
    provider: "forge",
    apiKey: ENV.forgeApiKey,
    apiUrl: buildApiUrl(
      resolveSafeBaseUrl(
        ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
          ? ENV.forgeApiUrl
          : "",
        "https://forge.manus.im"
      ),
      "v1/chat/completions"
    ),
    defaultModel: "gemini-2.5-flash",
    defaultMaxTokens: 32768,
  };
};

const assertApiKey = () => {
  if (!ENV.aiGatewayApiKey && !ENV.openaiApiKey && !ENV.forgeApiKey) {
    throw new Error(
      getLLMConfigErrorMessage("AI requests") ||
        "AI requests are unavailable because AI_GATEWAY_API_KEY (or VERCEL_AI_GATEWAY_KEY), OPENAI_API_KEY, and BUILT_IN_FORGE_API_KEY are all missing."
    );
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();
  const provider = resolveProviderConfig();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    modalities,
    audio,
  } = params;

  const payload: Record<string, unknown> = {
    model: params.model ?? provider.defaultModel,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens =
    params.maxTokens ?? params.max_tokens ?? provider.defaultMaxTokens;

  if (modalities && modalities.length > 0) {
    payload.modalities = modalities;
  }

  if (audio) {
    payload.audio = audio;
  }

  if (provider.provider === "forge") {
    payload.thinking = {
      budget_tokens: 128,
    };
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(provider.apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}
