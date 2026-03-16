export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  openaiApiBaseUrl:
    process.env.OPENAI_BASE_URL ?? process.env.OPENAI_API_URL ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiChatModel: process.env.OPENAI_CHAT_MODEL ?? "",
  openaiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
};

export function getOpenAIConfigStatus() {
  return {
    isConfigured: Boolean(ENV.openaiApiKey),
    missingVariables: ENV.openaiApiKey ? [] : ["OPENAI_API_KEY"],
  };
}

export function getLLMConfigStatus() {
  const openai = getOpenAIConfigStatus();
  if (openai.isConfigured) {
    return {
      isConfigured: true,
      provider: "openai" as const,
      missingVariables: [] as string[],
    };
  }

  if (ENV.forgeApiKey) {
    return {
      isConfigured: true,
      provider: "forge" as const,
      missingVariables: [] as string[],
    };
  }

  return {
    isConfigured: false,
    provider: null,
    missingVariables: ["OPENAI_API_KEY", "BUILT_IN_FORGE_API_KEY"],
  };
}

export function getSpeechConfigStatus() {
  const openai = getOpenAIConfigStatus();
  if (openai.isConfigured) {
    return {
      isConfigured: true,
      provider: "openai" as const,
      missingVariables: [] as string[],
    };
  }

  const forge = getForgeConfigStatus();
  if (forge.isConfigured) {
    return {
      isConfigured: true,
      provider: "forge" as const,
      missingVariables: [] as string[],
    };
  }

  return {
    isConfigured: false,
    provider: null,
    missingVariables: ["OPENAI_API_KEY", ...forge.missingVariables],
  };
}

export function getForgeConfigStatus() {
  const missingVariables: string[] = [];

  if (!ENV.forgeApiUrl) {
    missingVariables.push("BUILT_IN_FORGE_API_URL");
  }

  if (!ENV.forgeApiKey) {
    missingVariables.push("BUILT_IN_FORGE_API_KEY");
  }

  return {
    isConfigured: missingVariables.length === 0,
    missingVariables,
  };
}

export function getBlobConfigStatus() {
  return {
    isConfigured: Boolean(ENV.blobReadWriteToken),
    missingVariables: ENV.blobReadWriteToken
      ? []
      : ["BLOB_READ_WRITE_TOKEN"],
  };
}

export function getStorageConfigStatus() {
  const forge = getForgeConfigStatus();
  if (forge.isConfigured) {
    return {
      isConfigured: true,
      provider: "forge" as const,
      missingVariables: [] as string[],
    };
  }

  const blob = getBlobConfigStatus();
  if (blob.isConfigured) {
    return {
      isConfigured: true,
      provider: "vercel-blob" as const,
      missingVariables: [] as string[],
    };
  }

  return {
    isConfigured: false,
    provider: "local" as const,
    missingVariables: [...forge.missingVariables, ...blob.missingVariables],
  };
}

export function getForgeConfigErrorMessage(feature: string): string {
  const { missingVariables } = getForgeConfigStatus();
  if (!missingVariables.length) {
    return "";
  }

  const verb = missingVariables.length === 1 ? "is" : "are";
  return `${feature} is unavailable because ${missingVariables.join(", ")} ${verb} not configured on the server.`;
}

export function getLLMConfigErrorMessage(feature: string): string {
  const config = getLLMConfigStatus();
  if (config.isConfigured) {
    return "";
  }

  return `${feature} is unavailable because neither OPENAI_API_KEY nor BUILT_IN_FORGE_API_KEY is configured on the server.`;
}

export function getSpeechConfigErrorMessage(feature: string): string {
  const config = getSpeechConfigStatus();
  if (config.isConfigured) {
    return "";
  }

  return `${feature} is unavailable because neither OPENAI_API_KEY nor BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY is configured on the server.`;
}
