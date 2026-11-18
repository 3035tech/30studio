import "server-only";
import { randomUUID } from "node:crypto";
import { SOCIAL_CONNECTION } from "@/lib/constants";
import {
  claimSocialCredentialRefresh,
  completeSocialCredentialRefresh,
  releaseSocialCredentialRefresh,
  requireSocialReauthentication,
} from "@/lib/db/repositories/social-credentials";
import { getSocialConnector, refreshSocialAccessToken, SocialProviderError, type SocialTokenSet } from "@/lib/server/social-connectors";
import { decryptSocialSecret, encryptSocialSecret } from "@/lib/server/social-token-crypto";

/** Fetch a valid access token for a trusted server-side publisher. Never put the result in a queue payload or API response. */
export async function getValidSocialAccessToken(organizationId: string, socialProfileId: string): Promise<string | null> {
  const deadline = Date.now() + SOCIAL_CONNECTION.tokenRefreshWaitMilliseconds;
  const leaseId = randomUUID();

  while (Date.now() <= deadline) {
    const claim = await claimSocialCredentialRefresh(organizationId, socialProfileId, leaseId, new Date());
    if (claim.kind === "missing" || claim.kind === "not_connected" || claim.kind === "reauth_required") return null;
    if (claim.kind === "valid") return decryptSocialSecret(claim.credentials.accessTokenCiphertext, claim.credentials.encryptionKeyVersion);
    if (claim.kind === "waiting") {
      await delay(Math.min(SOCIAL_CONNECTION.tokenRefreshPollMilliseconds, Math.max(1, deadline - Date.now())));
      continue;
    }

    const { profile, credentials } = claim;
    if (credentials.refreshTokenExpiresAt && credentials.refreshTokenExpiresAt <= new Date()) {
      if (await requireSocialReauthentication(organizationId, socialProfileId, leaseId, profile.connectedBy)) return null;
      continue;
    }

    const accessToken = decryptSocialSecret(credentials.accessTokenCiphertext, credentials.encryptionKeyVersion);
    const refreshToken = credentials.refreshTokenCiphertext
      ? decryptSocialSecret(credentials.refreshTokenCiphertext, credentials.encryptionKeyVersion)
      : null;
    const connector = getSocialConnector(profile.platform);
    if (!connector) {
      await releaseSocialCredentialRefresh(organizationId, socialProfileId, leaseId);
      throw new Error("Social connector is not configured.");
    }
    const canRefreshWithoutRefreshToken = connector?.config.refreshKind === "instagram" || connector?.config.refreshKind === "threads";
    if (!refreshToken && !canRefreshWithoutRefreshToken) {
      if (await requireSocialReauthentication(organizationId, socialProfileId, leaseId, profile.connectedBy)) return null;
      continue;
    }

    const current: SocialTokenSet = {
      accessToken,
      refreshToken,
      tokenType: credentials.tokenType,
      scopes: credentials.scopes,
      tokenExpiresAt: credentials.tokenExpiresAt,
      refreshTokenExpiresAt: credentials.refreshTokenExpiresAt,
    };
    let updated: SocialTokenSet | null;
    try {
      updated = await refreshSocialAccessToken(connector, current);
    } catch (error) {
      if (error instanceof SocialProviderError && error.requiresReauthentication) {
        if (await requireSocialReauthentication(organizationId, socialProfileId, leaseId, null)) return null;
        continue;
      }
      await releaseSocialCredentialRefresh(organizationId, socialProfileId, leaseId);
      throw error;
    }

    if (!updated) {
      if (await requireSocialReauthentication(organizationId, socialProfileId, leaseId, profile.connectedBy)) return null;
      continue;
    }

    const encryptedAccess = encryptSocialSecret(updated.accessToken);
    const encryptedRefresh = updated.refreshToken ? encryptSocialSecret(updated.refreshToken) : null;
    const saved = await completeSocialCredentialRefresh({
      organizationId,
      socialProfileId,
      leaseId,
      accessTokenCiphertext: encryptedAccess.ciphertext,
      refreshTokenCiphertext: encryptedRefresh?.ciphertext ?? credentials.refreshTokenCiphertext,
      tokenType: updated.tokenType,
      scopes: updated.scopes,
      tokenExpiresAt: updated.tokenExpiresAt,
      refreshTokenExpiresAt: updated.refreshTokenExpiresAt,
      encryptionKeyVersion: encryptedAccess.keyVersion,
    });
    if (saved) return decryptSocialSecret(saved.accessTokenCiphertext, saved.encryptionKeyVersion);
  }

  throw new Error(`Social credential refresh did not complete within ${SOCIAL_CONNECTION.tokenRefreshWaitMilliseconds}ms.`);
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
