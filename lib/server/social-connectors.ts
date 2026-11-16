import "server-only";
import * as oauth from "oauth4webapi";
import { SOCIAL_CONNECTION, SOCIAL_PLATFORMS, SOCIAL_PUBLICATION_LIMITS } from "@/lib/constants";
import type { SocialPlatform } from "@/lib/constants";
import { PROVIDERS } from "@/lib/server/social-connectors/providers";
import type { ProviderConfig } from "@/lib/server/social-connectors/types";
import { readBoundedSocialProviderResponse } from "@/lib/server/social-provider-response";

export type SocialAccountIdentity = {
  externalAccountId: string;
  displayName: string;
  handle: string | null;
};

export type SocialTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scopes: string[];
  tokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
};

export type FacebookPageAccount = { externalAccountId: string; displayName: string; accessToken: string };

type RawTokenSet = {
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  scope?: unknown;
  scopes?: unknown;
  expires_in?: unknown;
  refresh_token_expires_in?: unknown;
  refresh_expires_in?: unknown;
  user_id?: unknown;
  data?: unknown;
  error?: unknown;
};

export class SocialProviderError extends Error {
  constructor(readonly requiresReauthentication: boolean, readonly retryable: boolean) {
    super("Social provider request failed.");
    this.name = "SocialProviderError";
  }
}

type SocialConnector = {
  platform: SocialPlatform;
  config: ProviderConfig;
  clientId: string;
  clientSecret: string;
  authorizationServer: oauth.AuthorizationServer;
  client: oauth.Client;
  clientAuthentication: oauth.ClientAuth;
};

export function getSocialConnector(platform: SocialPlatform): SocialConnector | null {
  const config = PROVIDERS[platform];
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  return {
    platform,
    config,
    clientId,
    clientSecret,
    authorizationServer: {
      issuer: config.issuer,
      authorization_endpoint: config.authorizationEndpoint,
      token_endpoint: config.tokenEndpoint,
      ...(config.jwksUri ? { jwks_uri: config.jwksUri } : {}),
    },
    client: { client_id: clientId },
    clientAuthentication: config.tokenAuth === "basic" ? oauth.ClientSecretBasic(clientSecret) : oauth.ClientSecretPost(clientSecret),
  };
}

export function getSocialConnectorAvailability() {
  return SOCIAL_PLATFORMS.map((platform) => ({ platform, configured: isSocialConnectorConfigured(platform) }));
}

export function isSocialConnectorConfigured(platform: SocialPlatform) {
  if (!getSocialConnector(platform)) return false;
  if (platform === "facebook" || platform === "instagram") return Boolean(process.env.META_GRAPH_API_VERSION && /^v\d+\.\d+$/u.test(process.env.META_GRAPH_API_VERSION));
  return true;
}

export async function createSocialAuthorizationUrl(
  connector: SocialConnector,
  state: string,
  codeVerifier: string | null,
  nonce: string | null,
  redirectUri: string,
) {
  const { config, clientId } = connector;
  const authorizationUrl = new URL(config.authorizationEndpoint);
  authorizationUrl.searchParams.set(config.clientKeyParameter ?? "client_id", clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", config.scopes.join(config.scopeSeparator ?? " "));
  authorizationUrl.searchParams.set("state", state);
  if (codeVerifier) {
    authorizationUrl.searchParams.set("code_challenge", await oauth.calculatePKCECodeChallenge(codeVerifier));
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
  }
  if (nonce) authorizationUrl.searchParams.set("nonce", nonce);
  for (const [key, value] of Object.entries(config.additionalAuthorizationParameters ?? {})) authorizationUrl.searchParams.set(key, value);
  return authorizationUrl;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function parseProviderJson(response: Response) {
  const body = await readBoundedSocialProviderResponse(response);
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new Error("Social provider returned an invalid response."); }
  if (!response.ok) {
    const providerError = asObject(value);
    const code = providerError?.error;
    throw new SocialProviderError(code === "invalid_grant" || response.status === 401, response.status === 429 || response.status >= 500);
  }
  const parsed = asObject(value);
  if (!parsed) throw new Error("Social provider returned an invalid response.");
  return parsed;
}

async function requestProviderJson(url: URL, accessToken?: string, method: "GET" | "POST" = "GET", body?: URLSearchParams) {
  const response = await fetch(url, {
    method,
    ...(body ? { body } : {}),
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds),
    cache: "no-store",
  });
  return parseProviderJson(response);
}

function getRawTokenSet(value: unknown): RawTokenSet {
  const outer = asObject(value);
  const nestedData = asObject(outer?.data);
  const token = nestedData ?? outer;
  if (token && typeof token.error === "string") throw new SocialProviderError(token.error === "invalid_grant", false);
  if (!token || typeof token.access_token !== "string" || token.access_token.length === 0) throw new Error("Social provider did not return an access token.");
  return token as RawTokenSet;
}

function asPositiveSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeTokenSet(raw: RawTokenSet, fallbackScopes: readonly string[], previousRefreshToken: string | null = null): SocialTokenSet {
  if (typeof raw.access_token !== "string" || raw.access_token.length === 0) throw new Error("Social provider did not return an access token.");
  const scopeValue = typeof raw.scope === "string" ? raw.scope : typeof raw.scopes === "string" ? raw.scopes : "";
  const scopes = scopeValue ? scopeValue.split(/[ ,]+/u).filter(Boolean) : [...fallbackScopes];
  const expiresIn = asPositiveSeconds(raw.expires_in);
  const refreshExpiresIn = asPositiveSeconds(raw.refresh_token_expires_in) ?? asPositiveSeconds(raw.refresh_expires_in);
  return {
    accessToken: raw.access_token,
    refreshToken: typeof raw.refresh_token === "string" ? raw.refresh_token : previousRefreshToken,
    tokenType: typeof raw.token_type === "string" ? raw.token_type : "Bearer",
    scopes,
    tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1_000) : null,
    refreshTokenExpiresAt: refreshExpiresIn ? new Date(Date.now() + refreshExpiresIn * 1_000) : null,
  };
}

async function exchangeProviderCode(connector: SocialConnector, callbackUrl: URL, expectedState: string, codeVerifier: string | null, redirectUri: string, nonce: string | null): Promise<SocialTokenSet> {
  const { config } = connector;
  const callbackParameters = oauth.validateAuthResponse(connector.authorizationServer, connector.client, callbackUrl, expectedState);
  if (config.codeExchangeKind && config.codeExchangeKind !== "standard") {
    const code = callbackParameters.get("code");
    if (!code) throw new Error("Social provider did not return an authorization code.");
    const tokenUrl = new URL(config.tokenEndpoint);
    if (config.codeExchangeKind === "facebook-query") {
      tokenUrl.searchParams.set("client_id", connector.clientId);
      tokenUrl.searchParams.set("client_secret", connector.clientSecret);
      tokenUrl.searchParams.set("code", code);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      const raw = await requestProviderJson(tokenUrl);
      return normalizeTokenSet(getRawTokenSet(raw), config.scopes);
    }
    if (config.codeExchangeKind !== "form-post") throw new Error("Social connector code exchange mode is invalid.");
    const form = new URLSearchParams({
      [config.clientKeyParameter ?? "client_id"]: connector.clientId,
      client_secret: connector.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri,
    });
    const raw = await requestProviderJson(tokenUrl, undefined, "POST", form);
    return normalizeTokenSet(getRawTokenSet(raw), config.scopes);
  }

  const response = await oauth.authorizationCodeGrantRequest(
    connector.authorizationServer,
    connector.client,
    connector.clientAuthentication,
    callbackParameters,
    redirectUri,
    codeVerifier ?? oauth.nopkce,
    { signal: AbortSignal.timeout(SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds) },
  );
  const result = await oauth.processAuthorizationCodeResponse(connector.authorizationServer, connector.client, response, nonce ? { expectedNonce: nonce } : undefined);
  return normalizeTokenSet(result, config.scopes);
}

async function exchangeForLongLivedToken(connector: SocialConnector, token: SocialTokenSet): Promise<SocialTokenSet> {
  const { longLivedTokenExchange } = connector.config;
  if (!longLivedTokenExchange) return token;
  const url = new URL(longLivedTokenExchange === "facebook"
    ? "https://graph.facebook.com/oauth/access_token"
    : longLivedTokenExchange === "instagram"
      ? "https://graph.instagram.com/access_token"
      : "https://graph.threads.net/access_token");
  const parameters = longLivedTokenExchange === "facebook"
    ? { grant_type: "fb_exchange_token", client_id: connector.clientId, client_secret: connector.clientSecret, fb_exchange_token: token.accessToken }
    : longLivedTokenExchange === "instagram"
      ? { grant_type: "ig_exchange_token", client_secret: connector.clientSecret, access_token: token.accessToken }
      : { grant_type: "th_exchange_token", client_secret: connector.clientSecret, access_token: token.accessToken };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const raw = await requestProviderJson(url);
  return normalizeTokenSet(getRawTokenSet(raw), token.scopes, token.refreshToken);
}

function normalizeRefreshTokenSet(raw: unknown, connector: SocialConnector, currentToken: SocialTokenSet) {
  const tokenObject = getRawTokenSet(raw);
  return normalizeTokenSet(tokenObject, currentToken.scopes, currentToken.refreshToken);
}

export async function refreshSocialAccessToken(connector: SocialConnector, currentToken: SocialTokenSet): Promise<SocialTokenSet | null> {
  const refreshKind = connector.config.refreshKind;
  if (!refreshKind) return null;
  if (refreshKind === "instagram" || refreshKind === "threads") {
    const host = refreshKind === "instagram" ? "https://graph.instagram.com/refresh_access_token" : "https://graph.threads.net/refresh_access_token";
    const url = new URL(host);
    url.searchParams.set("grant_type", refreshKind === "instagram" ? "ig_refresh_token" : "th_refresh_token");
    url.searchParams.set("access_token", currentToken.accessToken);
    const raw = await requestProviderJson(url);
    return normalizeRefreshTokenSet(raw, connector, currentToken);
  }
  if (!currentToken.refreshToken) return null;
  if (refreshKind === "tiktok") {
    const form = new URLSearchParams({ client_key: connector.clientId, client_secret: connector.clientSecret, grant_type: "refresh_token", refresh_token: currentToken.refreshToken });
    const raw = await requestProviderJson(new URL(connector.config.tokenEndpoint), undefined, "POST", form);
    return normalizeRefreshTokenSet(raw, connector, currentToken);
  }
  const response = await oauth.refreshTokenGrantRequest(connector.authorizationServer, connector.client, connector.clientAuthentication, currentToken.refreshToken, {
    signal: AbortSignal.timeout(SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds),
  });
  const result = await oauth.processRefreshTokenResponse(connector.authorizationServer, connector.client, response);
  return normalizeRefreshTokenSet(result, connector, currentToken);
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function objectAtPath(value: unknown, path: readonly (string | number)[]) {
  let current = value;
  for (const part of path) {
    current = typeof part === "number" && Array.isArray(current)
      ? current[part]
      : typeof part === "string" ? asObject(current)?.[part] : undefined;
  }
  return asObject(current);
}

export async function fetchSocialAccountIdentity(connector: SocialConnector, token: SocialTokenSet): Promise<SocialAccountIdentity> {
  const endpoint = connector.platform === "instagram"
    ? `/${process.env.META_GRAPH_API_VERSION}/me`
    : connector.config.accountEndpoint;
  const url = connector.platform === "instagram" ? new URL(endpoint, "https://graph.instagram.com") : new URL(endpoint);
  if (connector.config.accountFields) url.searchParams.set(connector.config.accountFieldsParameter ?? "fields", connector.config.accountFields);
  for (const [key, value] of Object.entries(connector.config.accountParameters ?? {})) url.searchParams.set(key, value);
  const response = await requestProviderJson(url, token.accessToken, connector.config.accountMethod ?? "GET");
  const account = objectAtPath(response, connector.config.accountResponsePath);
  if (!account) throw new Error("No social account was available for this connection.");

  const externalAccountId = requiredString(account, connector.config.accountIdField);
  const displayNameRecord = objectAtPath(account, connector.config.accountDisplayNamePath.slice(0, -1)) ?? account;
  const handle = connector.config.accountHandleField ? requiredString(account, connector.config.accountHandleField) : null;
  const displayName = requiredString(displayNameRecord, connector.config.accountDisplayNamePath.at(-1) ?? "name") ?? handle;
  if (!externalAccountId || !displayName) throw new Error("Social provider did not return an account identity.");
  return { externalAccountId, displayName, handle };
}

export async function fetchFacebookPages(token: SocialTokenSet): Promise<FacebookPageAccount[]> {
  const version = process.env.META_GRAPH_API_VERSION;
  if (!version || !/^v\d+\.\d+$/u.test(version)) throw new Error("Meta Graph API version is not configured.");
  const url = new URL(`/${version}/me/accounts`, "https://graph.facebook.com");
  url.searchParams.set("fields", "id,name,access_token,tasks");
  url.searchParams.set("limit", "100");
  const response = await requestProviderJson(url, token.accessToken);
  const rows = response.data;
  if (!Array.isArray(rows) || rows.length > 100) throw new Error("Meta returned an invalid Page list.");
  const pages: FacebookPageAccount[] = [];
  for (const value of rows) {
    const page = asObject(value);
    const tasks = page?.tasks;
    if (!page || !Array.isArray(tasks) || !tasks.some((task) => SOCIAL_PUBLICATION_LIMITS.facebook.publishablePageTasks.some((allowed) => allowed === task))) continue;
    const externalAccountId = requiredString(page, "id");
    const displayName = requiredString(page, "name");
    const accessToken = requiredString(page, "access_token");
    if (!externalAccountId || !displayName || !accessToken) continue;
    pages.push({ externalAccountId, displayName, accessToken });
  }
  return pages;
}

export async function exchangeSocialToken(connector: SocialConnector, callbackUrl: URL, state: string, codeVerifier: string | null, nonce: string | null, redirectUri: string) {
  const shortLivedToken = await exchangeProviderCode(connector, callbackUrl, state, codeVerifier, redirectUri, nonce);
  return exchangeForLongLivedToken(connector, shortLivedToken);
}

export async function exchangeAndLoadSocialAccount(connector: SocialConnector, callbackUrl: URL, state: string, codeVerifier: string | null, nonce: string | null, redirectUri: string) {
  const token = await exchangeSocialToken(connector, callbackUrl, state, codeVerifier, nonce, redirectUri);
  const identity = await fetchSocialAccountIdentity(connector, token);
  return { token, identity };
}

export function isSupportedSocialPlatform(value: string): value is SocialPlatform {
  return SOCIAL_PLATFORMS.some((platform) => platform === value);
}
