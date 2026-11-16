import type { ProviderConfig } from "../types";

export const linkedin: ProviderConfig = {
  clientIdEnv: "LINKEDIN_CLIENT_ID",
  clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
  issuer: "https://www.linkedin.com",
  jwksUri: "https://www.linkedin.com/oauth/openid/jwks",
  authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
  tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
  tokenAuth: "post",
  scopes: ["openid", "profile", "w_member_social"],
  supportsPkce: true,
  nonce: true,
  accountEndpoint: "https://api.linkedin.com/v2/userinfo",
  accountResponsePath: [], accountIdField: "sub", accountDisplayNamePath: ["name"],
};
