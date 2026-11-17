import type { ProviderConfig } from "../types";

export const x: ProviderConfig = {
  clientIdEnv: "X_CLIENT_ID",
  clientSecretEnv: "X_CLIENT_SECRET",
  issuer: "https://x.com",
  authorizationEndpoint: "https://x.com/i/oauth2/authorize",
  tokenEndpoint: "https://api.x.com/2/oauth2/token",
  tokenAuth: "basic",
  scopes: ["users.read", "tweet.read", "offline.access"],
  supportsPkce: true,
  accountEndpoint: "https://api.x.com/2/users/me",
  accountFields: "name,username",
  accountResponsePath: ["data"], accountIdField: "id", accountDisplayNamePath: ["name"], accountHandleField: "username",
  refreshKind: "oauth",
};
