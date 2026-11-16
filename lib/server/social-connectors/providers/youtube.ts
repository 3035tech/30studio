import type { ProviderConfig } from "../types";

export const youtube: ProviderConfig = {
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  issuer: "https://accounts.google.com",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  tokenAuth: "post",
  scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
  supportsPkce: true,
  additionalAuthorizationParameters: { access_type: "offline", include_granted_scopes: "true", prompt: "consent select_account" },
  accountEndpoint: "https://www.googleapis.com/youtube/v3/channels",
  accountFields: "snippet",
  accountFieldsParameter: "part", accountResponsePath: ["items", 0], accountIdField: "id", accountDisplayNamePath: ["snippet", "title"],
  accountParameters: { mine: "true" },
  refreshKind: "oauth",
};
