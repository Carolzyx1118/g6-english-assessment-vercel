export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

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

export function getForgeConfigErrorMessage(feature: string): string {
  const { missingVariables } = getForgeConfigStatus();
  if (!missingVariables.length) {
    return "";
  }

  const verb = missingVariables.length === 1 ? "is" : "are";
  return `${feature} is unavailable because ${missingVariables.join(", ")} ${verb} not configured on the server.`;
}
