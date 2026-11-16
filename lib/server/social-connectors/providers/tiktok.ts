import type { ProviderConfig } from "../types";

export const tiktok: ProviderConfig = {
  clientIdEnv: "TIKTOK_CLIENT_KEY",
  clientSecretEnv: "TIKTOK_CLIENT_SECRET",
  clientKeyParameter: "client_key",
  issuer: "https://www.tiktok.com",
  authorizationEndpoint: "https://www.tiktok.com/v2/auth/authorize/",
  tokenEndpoint: "https://open.tiktokapis.com/v2/oauth/token/",
  tokenAuth: "post",
  scopes: ["user.info.basic"],
  scopeSeparator: ",",
  supportsPkce: false,
  codeExchangeKind: "form-post",
  accountEndpoint: "https://open.tiktokapis.com/v2/user/info/",
  accountFields: "open_id,display_name",
  accountResponsePath: ["data", "user"], accountIdField: "open_id", accountDisplayNamePath: ["display_name"],
  refreshKind: "tiktok",
};
