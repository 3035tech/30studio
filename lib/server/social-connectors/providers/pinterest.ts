import type { ProviderConfig } from "../types";

export const pinterest: ProviderConfig = {
  clientIdEnv: "PINTEREST_CLIENT_ID",
  clientSecretEnv: "PINTEREST_CLIENT_SECRET",
  issuer: "https://www.pinterest.com",
  authorizationEndpoint: "https://www.pinterest.com/oauth/",
  tokenEndpoint: "https://api.pinterest.com/v5/oauth/token",
  tokenAuth: "basic",
  scopes: ["user_accounts:read"],
  scopeSeparator: ",",
  supportsPkce: false,
  accountEndpoint: "https://api.pinterest.com/v5/user_account",
  accountResponsePath: [], accountIdField: "username", accountDisplayNamePath: ["business_name"], accountHandleField: "username",
  refreshKind: "oauth",
};
