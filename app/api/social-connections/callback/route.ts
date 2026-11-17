import { NextRequest, NextResponse } from "next/server";
import * as oauth from "oauth4webapi";
import { API_ERROR_CODES, HTTP_STATUS, SOCIAL_CONNECTION, TENANT_PERMISSIONS } from "@/lib/constants";
import { consumeSocialOAuthState, storeConnectedSocialProfile } from "@/lib/db/repositories/social-connections";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { requireTenant } from "@/lib/server/auth";
import { exchangeAndLoadSocialAccount, exchangeSocialToken, fetchFacebookPages, getSocialConnector, isSocialConnectorConfigured, isSupportedSocialPlatform, SocialProviderError } from "@/lib/server/social-connectors";
import { decryptSocialSecret, encryptSocialSecret } from "@/lib/server/social-token-crypto";
import { logOperationalError } from "@/lib/server/operational-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToWorkspace(destination: URL) {
  return NextResponse.redirect(destination, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    const state = request.nextUrl.searchParams.get("state");
    if (!state || !/^[A-Za-z0-9_-]{43}$/u.test(state)) throw new ApiError(API_ERROR_CODES.socialOAuthInvalid, HTTP_STATUS.badRequest);
    const stateHash = await oauth.calculatePKCECodeChallenge(state);
    const oauthState = await consumeSocialOAuthState(stateHash, tenant.organizationId, tenant.userId);
    if (!oauthState) {
      throw new ApiError(API_ERROR_CODES.socialOAuthInvalid, HTTP_STATUS.badRequest);
    }
    const destination = new URL(`/${oauthState.locale}/`, process.env.STUDIO_PUBLIC_ORIGIN);
    destination.searchParams.set("social_connection", "failed");
    destination.searchParams.set("brand", oauthState.brandId);
    if (request.nextUrl.searchParams.has("error")) {
      const providerError = request.nextUrl.searchParams.get("error");
      logOperationalError("social.oauth.provider_denied", new Error("The provider did not authorize the connection."), {
        organizationId: tenant.organizationId,
        brandId: oauthState.brandId,
        platform: oauthState.platform,
        ...(providerError && /^[A-Za-z0-9_.-]{1,64}$/u.test(providerError) ? { providerCode: providerError } : {}),
      });
      if (providerError === "access_denied") destination.searchParams.set("social_connection", "cancelled");
      return redirectToWorkspace(destination);
    }
    if (!isSupportedSocialPlatform(oauthState.platform)) throw new ApiError(API_ERROR_CODES.socialOAuthInvalid, HTTP_STATUS.badRequest);
    const connector = getSocialConnector(oauthState.platform);
    if (!connector || !isSocialConnectorConfigured(oauthState.platform) || !process.env.STUDIO_PUBLIC_ORIGIN) throw new ApiError(API_ERROR_CODES.socialConnectorUnavailable, HTTP_STATUS.unavailable);
    const callbackUrl = new URL(SOCIAL_CONNECTION.callbackPath, process.env.STUDIO_PUBLIC_ORIGIN);
    callbackUrl.search = request.nextUrl.search;
    try {
      const verifier = oauthState.codeVerifierCiphertext ? decryptSocialSecret(oauthState.codeVerifierCiphertext, SOCIAL_CONNECTION.encryptionKeyVersion) : null;
      const nonce = oauthState.nonceCiphertext ? decryptSocialSecret(oauthState.nonceCiphertext, SOCIAL_CONNECTION.encryptionKeyVersion) : null;
      const redirectUri = callbackUrl.origin + callbackUrl.pathname;
      if (oauthState.platform === "facebook") {
        const token = await exchangeSocialToken(connector, callbackUrl, state, verifier, nonce, redirectUri);
        const pages = await fetchFacebookPages(token);
        if (pages.length === 0) {
          destination.searchParams.set("social_connection", "no_publishable_pages");
          return redirectToWorkspace(destination);
        }
        let connected = false;
        for (const page of pages) {
          const access = encryptSocialSecret(page.accessToken);
          const saved = await storeConnectedSocialProfile({
            organizationId: tenant.organizationId, brandId: oauthState.brandId, platform: oauthState.platform,
            actorUserId: tenant.userId, externalAccountId: page.externalAccountId, displayName: page.displayName,
            handle: null, accessTokenCiphertext: access.ciphertext, refreshTokenCiphertext: null,
            tokenType: "Bearer", scopes: token.scopes, tokenExpiresAt: token.tokenExpiresAt,
            refreshTokenExpiresAt: null, encryptionKeyVersion: access.keyVersion,
          });
          connected ||= saved.kind === "connected" || saved.kind === "reconnected";
        }
        if (!connected) {
          destination.searchParams.set("social_connection", "already_connected");
          return redirectToWorkspace(destination);
        }
      } else {
        const { token, identity } = await exchangeAndLoadSocialAccount(connector, callbackUrl, state, verifier, nonce, redirectUri);
        const access = encryptSocialSecret(token.accessToken);
        const refresh = token.refreshToken ? encryptSocialSecret(token.refreshToken) : null;
        const saved = await storeConnectedSocialProfile({
          organizationId: tenant.organizationId, brandId: oauthState.brandId, platform: oauthState.platform,
          actorUserId: tenant.userId, externalAccountId: identity.externalAccountId, displayName: identity.displayName,
          handle: identity.handle, accessTokenCiphertext: access.ciphertext, refreshTokenCiphertext: refresh?.ciphertext ?? null,
          tokenType: token.tokenType, scopes: token.scopes, tokenExpiresAt: token.tokenExpiresAt,
          refreshTokenExpiresAt: token.refreshTokenExpiresAt, encryptionKeyVersion: access.keyVersion,
        });
        if (saved.kind === "duplicate") {
          destination.searchParams.set("social_connection", "already_connected");
          return redirectToWorkspace(destination);
        }
        if (saved.kind !== "connected" && saved.kind !== "reconnected") return redirectToWorkspace(destination);
      }
    } catch (error) {
      logOperationalError("social.oauth.callback_failed", error, {
        organizationId: tenant.organizationId,
        brandId: oauthState.brandId,
        platform: oauthState.platform,
        ...(error instanceof SocialProviderError ? {
          providerCode: error.providerCode,
          retryable: error.retryable,
          requiresReauthentication: error.requiresReauthentication,
        } : {}),
      });
      if (error instanceof SocialProviderError && ["invalid_scope", "10", "200"].includes(error.providerCode ?? "")) {
        destination.searchParams.set("social_connection", "permissions_required");
      }
      return redirectToWorkspace(destination);
    }
    destination.searchParams.set("social_connection", "connected");
    destination.searchParams.set("platform", oauthState.platform);
    return redirectToWorkspace(destination);
  } catch (error) { return apiErrorResponse(error, request); }
}
