import type { ProviderConfig } from "../types";

const metaCredentials = { clientIdEnv: "META_CLIENT_ID", clientSecretEnv: "META_CLIENT_SECRET" };

export const instagram: ProviderConfig = {
  ...metaCredentials,
  issuer: "https://www.instagram.com",
  authorizationEndpoint: "https://www.instagram.com/oauth/authorize",
  tokenEndpoint: "https://api.instagram.com/oauth/access_token",
  tokenAuth: "post",
  scopes: ["instagram_business_basic", "instagram_business_content_publish"],
  supportsPkce: false,
  accountEndpoint: "https://graph.instagram.com/me",
  accountFields: "id,username,name",
  accountResponsePath: [], accountIdField: "id", accountDisplayNamePath: ["name"], accountHandleField: "username",
  longLivedTokenExchange: "instagram",
  refreshKind: "instagram",
};

export const facebook: ProviderConfig = {
  ...metaCredentials,
  issuer: "https://www.facebook.com",
  authorizationEndpoint: "https://www.facebook.com/dialog/oauth",
  tokenEndpoint: "https://graph.facebook.com/oauth/access_token",
  tokenAuth: "post",
  scopes: ["public_profile", "pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic"],
  supportsPkce: false,
  codeExchangeKind: "facebook-query",
  accountEndpoint: "https://graph.facebook.com/me",
  accountFields: "id,name",
  accountResponsePath: [], accountIdField: "id", accountDisplayNamePath: ["name"],
  longLivedTokenExchange: "facebook",
};

export const threads: ProviderConfig = {
  ...metaCredentials,
  issuer: "https://www.threads.net",
  authorizationEndpoint: "https://threads.net/oauth/authorize",
  tokenEndpoint: "https://graph.threads.net/oauth/access_token",
  tokenAuth: "post",
  scopes: ["threads_basic", "threads_content_publish"],
  scopeSeparator: ",",
  supportsPkce: false,
  codeExchangeKind: "form-post",
  accountEndpoint: "https://graph.threads.net/v1.0/me",
  accountFields: "id,username,name",
  accountResponsePath: [], accountIdField: "id", accountDisplayNamePath: ["name"], accountHandleField: "username",
  longLivedTokenExchange: "threads",
  refreshKind: "threads",
};
