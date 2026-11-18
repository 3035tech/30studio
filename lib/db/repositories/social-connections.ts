import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { brands, socialConnectionEvents, socialOAuthStates, socialProfileCredentials, socialProfiles, user } from "@/lib/db/schema";
import { getSocialPublisher } from "@/lib/server/social-publisher/registry";

export async function createSocialOAuthState(input: {
  stateHash: string; organizationId: string; brandId: string; platform: typeof socialProfiles.$inferInsert.platform;
  initiatedBy: string; locale: string; codeVerifierCiphertext: string | null; nonceCiphertext: string | null; expiresAt: Date;
}) {
  const db = getDatabase();
  const [brand] = await db.select({ id: brands.id }).from(brands)
    .where(and(eq(brands.id, input.brandId), eq(brands.organizationId, input.organizationId))).limit(1);
  if (!brand) return false;
  await db.insert(socialOAuthStates).values(input);
  return true;
}

export async function consumeSocialOAuthState(stateHash: string, organizationId: string, initiatedBy: string) {
  return getDatabase().transaction(async (tx) => {
    const [state] = await tx.select().from(socialOAuthStates).where(and(
      eq(socialOAuthStates.stateHash, stateHash), eq(socialOAuthStates.organizationId, organizationId),
      eq(socialOAuthStates.initiatedBy, initiatedBy), gt(socialOAuthStates.expiresAt, new Date()),
    )).for("update").limit(1);
    if (!state) return null;
    await tx.delete(socialOAuthStates).where(and(eq(socialOAuthStates.stateHash, stateHash),
      eq(socialOAuthStates.organizationId, organizationId), eq(socialOAuthStates.initiatedBy, initiatedBy)));
    return state;
  });
}

export async function storeConnectedSocialProfile(input: {
  organizationId: string; brandId: string; platform: typeof socialProfiles.$inferInsert.platform; actorUserId: string;
  externalAccountId: string; displayName: string; handle: string | null;
  accessTokenCiphertext: string; refreshTokenCiphertext: string | null; tokenType: string; scopes: string[];
  tokenExpiresAt: Date | null; refreshTokenExpiresAt: Date | null; encryptionKeyVersion: number;
}) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const [brand] = await tx.select({ id: brands.id }).from(brands)
      .where(and(eq(brands.id, input.brandId), eq(brands.organizationId, input.organizationId))).limit(1);
    if (!brand) return { kind: "missing_brand" as const };
    const [existing] = await tx.select({ id: socialProfiles.id }).from(socialProfiles).where(and(
      eq(socialProfiles.organizationId, input.organizationId), eq(socialProfiles.brandId, input.brandId),
      eq(socialProfiles.platform, input.platform), eq(socialProfiles.externalAccountId, input.externalAccountId),
    )).limit(1);
    if (existing) {
      await tx.update(socialProfiles).set({ displayName: input.displayName, handle: input.handle, connectedBy: input.actorUserId,
        connectedAt: new Date(), status: "connected", updatedAt: new Date() }).where(and(
        eq(socialProfiles.organizationId, input.organizationId), eq(socialProfiles.id, existing.id),
      ));
      await tx.insert(socialProfileCredentials).values({
        organizationId: input.organizationId, socialProfileId: existing.id, accessTokenCiphertext: input.accessTokenCiphertext,
        refreshTokenCiphertext: input.refreshTokenCiphertext, tokenType: input.tokenType, scopes: input.scopes,
        tokenExpiresAt: input.tokenExpiresAt, refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        encryptionKeyVersion: input.encryptionKeyVersion,
      }).onConflictDoUpdate({ target: [socialProfileCredentials.organizationId, socialProfileCredentials.socialProfileId], set: {
        accessTokenCiphertext: input.accessTokenCiphertext, refreshTokenCiphertext: input.refreshTokenCiphertext,
        tokenType: input.tokenType, scopes: input.scopes, tokenExpiresAt: input.tokenExpiresAt,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt, encryptionKeyVersion: input.encryptionKeyVersion,
        refreshLeaseId: null, refreshLeaseExpiresAt: null, updatedAt: new Date(),
      } });
      await tx.insert(socialConnectionEvents).values({ organizationId: input.organizationId, brandId: input.brandId,
        socialProfileId: existing.id, actorUserId: input.actorUserId, platform: input.platform, eventType: "connected" });
      return { kind: "reconnected" as const };
    }
    const [profile] = await tx.insert(socialProfiles).values({
      organizationId: input.organizationId, brandId: input.brandId, platform: input.platform,
      displayName: input.displayName, handle: input.handle, externalAccountId: input.externalAccountId,
      connectedBy: input.actorUserId, connectedAt: new Date(), status: "connected",
    }).onConflictDoNothing().returning();
    if (!profile) return { kind: "duplicate" as const };
    await tx.insert(socialProfileCredentials).values({
      organizationId: input.organizationId, socialProfileId: profile.id,
      accessTokenCiphertext: input.accessTokenCiphertext, refreshTokenCiphertext: input.refreshTokenCiphertext,
      tokenType: input.tokenType, scopes: input.scopes, tokenExpiresAt: input.tokenExpiresAt,
      refreshTokenExpiresAt: input.refreshTokenExpiresAt, encryptionKeyVersion: input.encryptionKeyVersion,
    });
    await tx.insert(socialConnectionEvents).values({
      organizationId: input.organizationId, brandId: input.brandId, socialProfileId: profile.id,
      actorUserId: input.actorUserId, platform: input.platform, eventType: "connected",
    });
    return { kind: "connected" as const, profile };
  });
}

export async function listSocialConnections(organizationId: string, brandId: string) {
  const rows = await getDatabase().select({ id: socialProfiles.id, platform: socialProfiles.platform,
    displayName: socialProfiles.displayName, handle: socialProfiles.handle, status: socialProfiles.status,
    connectedAt: socialProfiles.connectedAt, connectedByName: user.name,
    grantedScopes: socialProfileCredentials.scopes, tokenExpiresAt: socialProfileCredentials.tokenExpiresAt,
    refreshTokenExpiresAt: socialProfileCredentials.refreshTokenExpiresAt,
    credentialsUpdatedAt: socialProfileCredentials.updatedAt,
  }).from(socialProfiles)
    .leftJoin(socialProfileCredentials, and(eq(socialProfileCredentials.organizationId, socialProfiles.organizationId), eq(socialProfileCredentials.socialProfileId, socialProfiles.id)))
    .leftJoin(user, eq(user.id, socialProfiles.connectedBy))
    .where(and(eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.brandId, brandId)));
  return rows.map((row) => {
    const requiredScopes = getSocialPublisher(row.platform)?.requiredScopes ?? [];
    return { ...row, grantedScopes: row.grantedScopes ?? [], missingScopes: requiredScopes.filter((scope) => !(row.grantedScopes ?? []).includes(scope)) };
  });
}

export async function disconnectSocialProfile(organizationId: string, brandId: string, socialProfileId: string, actorUserId: string) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const [profile] = await tx.select({ id: socialProfiles.id, platform: socialProfiles.platform }).from(socialProfiles).where(and(
      eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.brandId, brandId), eq(socialProfiles.id, socialProfileId),
    )).limit(1);
    if (!profile) return false;
    await tx.delete(socialProfileCredentials).where(and(eq(socialProfileCredentials.organizationId, organizationId), eq(socialProfileCredentials.socialProfileId, profile.id)));
    await tx.update(socialProfiles).set({ status: "disabled", updatedAt: new Date() }).where(and(
      eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.id, profile.id),
    ));
    await tx.insert(socialConnectionEvents).values({
      organizationId, brandId, socialProfileId: profile.id, actorUserId, platform: profile.platform, eventType: "disconnected",
    });
    return true;
  });
}
