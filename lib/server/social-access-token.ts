import "server-only";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { SOCIAL_CONNECTION, SOCIAL_CONNECTION_EVENT } from "@/lib/constants";
import { socialConnectionEvents, socialProfileCredentials, socialProfiles } from "@/lib/db/schema";
import { getSocialConnector, refreshSocialAccessToken, SocialProviderError, type SocialTokenSet } from "@/lib/server/social-connectors";
import { decryptSocialSecret, encryptSocialSecret } from "@/lib/server/social-token-crypto";

/** Fetch a valid access token for a trusted server-side publisher. Never put the result in a queue payload or API response. */
export async function getValidSocialAccessToken(organizationId: string, socialProfileId: string): Promise<string | null> {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ profile: socialProfiles, credentials: socialProfileCredentials })
      .from(socialProfiles).innerJoin(socialProfileCredentials, and(
        eq(socialProfileCredentials.organizationId, socialProfiles.organizationId),
        eq(socialProfileCredentials.socialProfileId, socialProfiles.id),
      )).where(and(eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.id, socialProfileId)))
      .for("update", { of: socialProfileCredentials }).limit(1);
    if (!row || row.profile.status !== "connected") return null;
    const { profile, credentials } = row;
    const accessToken = decryptSocialSecret(credentials.accessTokenCiphertext, credentials.encryptionKeyVersion);
    if (!credentials.tokenExpiresAt || credentials.tokenExpiresAt.getTime() > Date.now() + SOCIAL_CONNECTION.refreshBeforeExpiryMilliseconds) return accessToken;
    if (credentials.refreshTokenExpiresAt && credentials.refreshTokenExpiresAt <= new Date()) {
      await markReauthenticationRequired(tx, organizationId, profile.id, profile.brandId, profile.platform, profile.connectedBy);
      return null;
    }
    const refreshToken = credentials.refreshTokenCiphertext ? decryptSocialSecret(credentials.refreshTokenCiphertext, credentials.encryptionKeyVersion) : null;
    const connector = getSocialConnector(profile.platform);
    const canRefreshWithoutRefreshToken = connector?.config.refreshKind === "instagram" || connector?.config.refreshKind === "threads";
    if (!connector) throw new Error("Social connector is not configured.");
    if (!refreshToken && !canRefreshWithoutRefreshToken) {
      await markReauthenticationRequired(tx, organizationId, profile.id, profile.brandId, profile.platform, profile.connectedBy);
      return null;
    }
    const current: SocialTokenSet = {
      accessToken, refreshToken, tokenType: credentials.tokenType, scopes: credentials.scopes,
      tokenExpiresAt: credentials.tokenExpiresAt, refreshTokenExpiresAt: credentials.refreshTokenExpiresAt,
    };
    let updated: SocialTokenSet | null;
    try { updated = await refreshSocialAccessToken(connector, current); }
    catch (error) {
      if (error instanceof SocialProviderError && error.requiresReauthentication) {
        await markReauthenticationRequired(tx, organizationId, profile.id, profile.brandId, profile.platform, null);
        return null;
      }
      throw error;
    }
    if (!updated) {
      await markReauthenticationRequired(tx, organizationId, profile.id, profile.brandId, profile.platform, profile.connectedBy);
      return null;
    }
    const encryptedAccess = encryptSocialSecret(updated.accessToken);
    const encryptedRefresh = updated.refreshToken ? encryptSocialSecret(updated.refreshToken) : null;
    await tx.update(socialProfileCredentials).set({
      accessTokenCiphertext: encryptedAccess.ciphertext,
      refreshTokenCiphertext: encryptedRefresh?.ciphertext ?? credentials.refreshTokenCiphertext,
      tokenType: updated.tokenType, scopes: updated.scopes, tokenExpiresAt: updated.tokenExpiresAt,
      refreshTokenExpiresAt: updated.refreshTokenExpiresAt, encryptionKeyVersion: encryptedAccess.keyVersion, updatedAt: new Date(),
    }).where(and(eq(socialProfileCredentials.organizationId, organizationId), eq(socialProfileCredentials.socialProfileId, profile.id)));
    await tx.insert(socialConnectionEvents).values({ organizationId, brandId: profile.brandId,
      socialProfileId: profile.id, actorUserId: null, platform: profile.platform, eventType: SOCIAL_CONNECTION_EVENT.refreshed });
    return updated.accessToken;
  });
}

async function markReauthenticationRequired(tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0], organizationId: string, profileId: string, brandId: string, platform: typeof socialProfiles.$inferSelect.platform, actorUserId: string | null) {
  await tx.update(socialProfiles).set({ status: "reauth_required", updatedAt: new Date() }).where(and(eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.id, profileId)));
  await tx.insert(socialConnectionEvents).values({ organizationId, brandId, socialProfileId: profileId, actorUserId, platform, eventType: SOCIAL_CONNECTION_EVENT.reauthRequired });
}
