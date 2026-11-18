import "server-only";
import { and, eq } from "drizzle-orm";
import { SOCIAL_CONNECTION, SOCIAL_CONNECTION_EVENT, SOCIAL_PROFILE_STATUS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { socialConnectionEvents, socialProfileCredentials, socialProfiles } from "@/lib/db/schema";

export type SocialCredentialRefreshClaim =
  | { kind: "missing" }
  | { kind: "not_connected" }
  | { kind: "reauth_required" }
  | { kind: "waiting" }
  | { kind: "valid"; credentials: typeof socialProfileCredentials.$inferSelect }
  | { kind: "claimed"; profile: typeof socialProfiles.$inferSelect; credentials: typeof socialProfileCredentials.$inferSelect };

export async function claimSocialCredentialRefresh(organizationId: string, socialProfileId: string, leaseId: string, now: Date): Promise<SocialCredentialRefreshClaim> {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [row] = await transaction.select({ profile: socialProfiles, credentials: socialProfileCredentials })
      .from(socialProfiles).innerJoin(socialProfileCredentials, and(
        eq(socialProfileCredentials.organizationId, socialProfiles.organizationId),
        eq(socialProfileCredentials.socialProfileId, socialProfiles.id),
      )).where(and(eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.id, socialProfileId)))
      .for("update", { of: socialProfileCredentials }).limit(1);
    if (!row) return { kind: "missing" };
    if (row.profile.status !== SOCIAL_PROFILE_STATUS.connected) return { kind: "not_connected" };
    const { profile, credentials } = row;
    if (!credentials.tokenExpiresAt || credentials.tokenExpiresAt.getTime() > now.getTime() + SOCIAL_CONNECTION.refreshBeforeExpiryMilliseconds) {
      return { kind: "valid", credentials };
    }
    if (credentials.refreshLeaseExpiresAt && credentials.refreshLeaseExpiresAt > now) return { kind: "waiting" };
    const [claimed] = await transaction.update(socialProfileCredentials).set({
      refreshLeaseId: leaseId,
      refreshLeaseExpiresAt: new Date(now.getTime() + SOCIAL_CONNECTION.tokenRefreshLeaseMilliseconds),
    }).where(and(
      eq(socialProfileCredentials.organizationId, organizationId),
      eq(socialProfileCredentials.socialProfileId, socialProfileId),
    )).returning();
    return claimed ? { kind: "claimed", profile, credentials: claimed } : { kind: "missing" };
  });
}

export async function completeSocialCredentialRefresh(input: {
  organizationId: string;
  socialProfileId: string;
  leaseId: string;
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string | null;
  tokenType: string;
  scopes: string[];
  tokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  encryptionKeyVersion: number;
}) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [credentials] = await transaction.update(socialProfileCredentials).set({
      accessTokenCiphertext: input.accessTokenCiphertext,
      refreshTokenCiphertext: input.refreshTokenCiphertext,
      tokenType: input.tokenType,
      scopes: input.scopes,
      tokenExpiresAt: input.tokenExpiresAt,
      refreshTokenExpiresAt: input.refreshTokenExpiresAt,
      encryptionKeyVersion: input.encryptionKeyVersion,
      refreshLeaseId: null,
      refreshLeaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(socialProfileCredentials.organizationId, input.organizationId),
      eq(socialProfileCredentials.socialProfileId, input.socialProfileId),
      eq(socialProfileCredentials.refreshLeaseId, input.leaseId),
    )).returning();
    if (!credentials) return null;
    const [profile] = await transaction.select({ brandId: socialProfiles.brandId, platform: socialProfiles.platform }).from(socialProfiles).where(and(
      eq(socialProfiles.organizationId, input.organizationId),
      eq(socialProfiles.id, input.socialProfileId),
    )).limit(1);
    if (!profile) return null;
    await transaction.insert(socialConnectionEvents).values({
      organizationId: input.organizationId,
      brandId: profile.brandId,
      socialProfileId: input.socialProfileId,
      actorUserId: null,
      platform: profile.platform,
      eventType: SOCIAL_CONNECTION_EVENT.refreshed,
    });
    return credentials;
  });
}

export async function releaseSocialCredentialRefresh(organizationId: string, socialProfileId: string, leaseId: string) {
  await getDatabase().update(socialProfileCredentials).set({ refreshLeaseId: null, refreshLeaseExpiresAt: null }).where(and(
    eq(socialProfileCredentials.organizationId, organizationId),
    eq(socialProfileCredentials.socialProfileId, socialProfileId),
    eq(socialProfileCredentials.refreshLeaseId, leaseId),
  ));
}

export async function requireSocialReauthentication(organizationId: string, socialProfileId: string, leaseId: string, actorUserId: string | null) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [profile] = await transaction.select({ id: socialProfiles.id, brandId: socialProfiles.brandId, platform: socialProfiles.platform }).from(socialProfiles).where(and(
      eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.id, socialProfileId),
    )).limit(1);
    if (!profile) return false;
    const [released] = await transaction.update(socialProfileCredentials).set({ refreshLeaseId: null, refreshLeaseExpiresAt: null }).where(and(
      eq(socialProfileCredentials.organizationId, organizationId),
      eq(socialProfileCredentials.socialProfileId, socialProfileId),
      eq(socialProfileCredentials.refreshLeaseId, leaseId),
    )).returning({ id: socialProfileCredentials.id });
    if (!released) return false;
    await transaction.update(socialProfiles).set({ status: SOCIAL_PROFILE_STATUS.reauthRequired, updatedAt: new Date() }).where(and(
      eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.id, socialProfileId),
    ));
    await transaction.insert(socialConnectionEvents).values({
      organizationId, brandId: profile.brandId, socialProfileId, actorUserId,
      platform: profile.platform, eventType: SOCIAL_CONNECTION_EVENT.reauthRequired,
    });
    return true;
  });
}

