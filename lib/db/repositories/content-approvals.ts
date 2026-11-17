import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { CONTENT_APPROVAL_BLOCKING_MEDIA_STATUSES, CONTENT_APPROVAL_LIMITS, CONTENT_APPROVAL_STATUS, CONTENT_EDITABLE_STATUSES, CONTENT_MEDIA_STATUS, CONTENT_STATUS, SOCIAL_PUBLICATION_JOB_STATUS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { contentApprovalDecisions, contentApprovalPolicies, contentApprovalRequests, contentItems, contentMediaAssets, contentVariants, contentVersions, socialProfileCredentials, socialProfiles, socialPublicationJobs, user } from "@/lib/db/schema";
import { getContentApprovalFingerprint } from "@/lib/server/content-approval-fingerprint";
import { getSocialPublisher } from "@/lib/server/social-publisher/registry";
import { isPublishableInstagramImage } from "@/lib/server/social-publisher/instagram-media";

function isInstagramImagePublishable(asset: { status: string; contentType: string | null; sizeBytes: number | null; width: number | null; height: number | null }) {
  return asset.status === CONTENT_MEDIA_STATUS.approved && isPublishableInstagramImage(asset);
}

async function getCurrentSnapshot(organizationId: string, itemId: string) {
  const database = getDatabase();
  const [item] = await database.select({
    id: contentItems.id,
    brandId: contentItems.brandId,
    title: contentItems.title,
    platform: contentItems.platform,
    status: contentItems.status,
    plannedAt: contentItems.plannedAt,
    timeZone: contentItems.timeZone,
  }).from(contentItems).where(and(eq(contentItems.organizationId, organizationId), eq(contentItems.id, itemId))).limit(1);
  if (!item) return null;

  const [current] = await database.select({
    id: contentVersions.id,
    versionNumber: contentVersions.versionNumber,
    canonicalCopy: contentVersions.canonicalCopy,
    brandKitVersionNumber: contentVersions.brandKitVersionNumber,
    capabilitySnapshot: contentVersions.capabilitySnapshot,
    platform: contentVariants.platform,
    variantCopy: contentVariants.copy,
  }).from(contentVersions).innerJoin(contentVariants, and(
    eq(contentVariants.organizationId, contentVersions.organizationId),
    eq(contentVariants.contentVersionId, contentVersions.id),
    eq(contentVariants.platform, item.platform),
  )).where(and(
    eq(contentVersions.organizationId, organizationId),
    eq(contentVersions.contentItemId, itemId),
  )).orderBy(desc(contentVersions.versionNumber)).limit(1);
  if (!current) return { item, current: null, media: [] as const };

  const media = await database.select({
    id: contentMediaAssets.id,
    status: contentMediaAssets.status,
    sha256: contentMediaAssets.sha256,
    contentType: contentMediaAssets.contentType,
    sizeBytes: contentMediaAssets.sizeBytes,
  }).from(contentMediaAssets).where(and(
    eq(contentMediaAssets.organizationId, organizationId),
    eq(contentMediaAssets.contentItemId, itemId),
    eq(contentMediaAssets.contentVersionId, current.id),
  )).orderBy(asc(contentMediaAssets.id));
  return { item, current, media };
}

function getFingerprint(snapshot: NonNullable<Awaited<ReturnType<typeof getCurrentSnapshot>>>, socialProfileId: string | null = null) {
  if (!snapshot.current) return null;
  return getContentApprovalFingerprint({
    contentItemId: snapshot.item.id,
    brandId: snapshot.item.brandId,
    title: snapshot.item.title,
    platform: snapshot.item.platform,
    plannedAt: snapshot.item.plannedAt,
    timeZone: snapshot.item.timeZone,
    contentVersionId: snapshot.current.id,
    socialProfileId,
    versionNumber: snapshot.current.versionNumber,
    canonicalCopy: snapshot.current.canonicalCopy,
    variantCopy: snapshot.current.variantCopy,
    brandKitVersionNumber: snapshot.current.brandKitVersionNumber,
    capabilitySnapshot: snapshot.current.capabilitySnapshot,
    media: snapshot.media.filter((asset) => asset.status === CONTENT_MEDIA_STATUS.approved),
  });
}

export async function getContentApprovalState(organizationId: string, itemId: string) {
  const snapshot = await getCurrentSnapshot(organizationId, itemId);
  if (!snapshot) return null;
  const publisher = snapshot.item ? getSocialPublisher(snapshot.item.platform) : null;
  const targetProfiles = publisher ? await getDatabase().select({
    id: socialProfiles.id,
    displayName: socialProfiles.displayName,
    handle: socialProfiles.handle,
    scopes: socialProfileCredentials.scopes,
  }).from(socialProfiles).innerJoin(socialProfileCredentials, and(
    eq(socialProfileCredentials.organizationId, socialProfiles.organizationId),
    eq(socialProfileCredentials.socialProfileId, socialProfiles.id),
  )).where(and(
    eq(socialProfiles.organizationId, organizationId),
    eq(socialProfiles.brandId, snapshot.item.brandId),
    eq(socialProfiles.platform, snapshot.item.platform),
    eq(socialProfiles.status, "connected"),
  )) : [];
  const eligibleTargetProfiles = publisher ? targetProfiles.filter((profile) => publisher.requiredScopes.every((scope) => profile.scopes.includes(scope))) : [];
  const requests = await getDatabase().select({
    id: contentApprovalRequests.id,
    contentVersionId: contentApprovalRequests.contentVersionId,
    fingerprint: contentApprovalRequests.fingerprint,
    socialProfileId: contentApprovalRequests.socialProfileId,
    status: contentApprovalRequests.status,
    requiredApprovals: contentApprovalRequests.requiredApprovals,
    submittedBy: contentApprovalRequests.submittedBy,
    submittedByName: user.name,
    createdAt: contentApprovalRequests.createdAt,
    resolvedAt: contentApprovalRequests.resolvedAt,
    versionNumber: contentVersions.versionNumber,
    targetProfileId: socialProfiles.id,
    targetProfileName: socialProfiles.displayName,
    targetProfileHandle: socialProfiles.handle,
  }).from(contentApprovalRequests)
    .innerJoin(user, eq(user.id, contentApprovalRequests.submittedBy))
    .innerJoin(contentVersions, and(
      eq(contentVersions.organizationId, contentApprovalRequests.organizationId),
      eq(contentVersions.id, contentApprovalRequests.contentVersionId),
    )).leftJoin(socialProfiles, and(
      eq(socialProfiles.organizationId, contentApprovalRequests.organizationId),
      eq(socialProfiles.brandId, contentApprovalRequests.brandId),
      eq(socialProfiles.id, contentApprovalRequests.socialProfileId),
    )).where(and(
      eq(contentApprovalRequests.organizationId, organizationId),
      eq(contentApprovalRequests.contentItemId, itemId),
    )).orderBy(desc(contentApprovalRequests.createdAt)).limit(CONTENT_APPROVAL_LIMITS.maximumHistoryEntries);
  const requestIds = requests.map((request) => request.id);
  const decisions = requestIds.length === 0 ? [] : await getDatabase().select({
    approvalRequestId: contentApprovalDecisions.approvalRequestId,
    decision: contentApprovalDecisions.decision,
    note: contentApprovalDecisions.note,
    reviewerName: user.name,
    occurredAt: contentApprovalDecisions.occurredAt,
  }).from(contentApprovalDecisions).innerJoin(user, eq(user.id, contentApprovalDecisions.reviewerId)).where(and(
    eq(contentApprovalDecisions.organizationId, organizationId),
    inArray(contentApprovalDecisions.approvalRequestId, requestIds),
  )).orderBy(asc(contentApprovalDecisions.occurredAt));
  return {
    itemStatus: snapshot.item.status,
    currentVersion: snapshot.current ? {
      id: snapshot.current.id,
      versionNumber: snapshot.current.versionNumber,
      canonicalCopy: snapshot.current.canonicalCopy,
      variantCopy: snapshot.current.variantCopy,
      brandKitVersionNumber: snapshot.current.brandKitVersionNumber,
    } : null,
    canRequest: Boolean(snapshot.current && CONTENT_EDITABLE_STATUSES.some((status) => status === snapshot.item.status)),
    mediaPending: snapshot.media.some((asset) => CONTENT_APPROVAL_BLOCKING_MEDIA_STATUSES.some((status) => status === asset.status)),
    publisherProfileRequired: Boolean(publisher),
    targetProfiles: eligibleTargetProfiles.map(({ id, displayName, handle }) => ({ id, displayName, handle })),
    history: requests.map((request) => ({
      id: request.id,
      versionId: request.contentVersionId,
      versionNumber: request.versionNumber,
      status: request.status,
      requiredApprovals: request.requiredApprovals,
      submittedBy: request.submittedBy,
      submittedByName: request.submittedByName,
      createdAt: request.createdAt.toISOString(),
      resolvedAt: request.resolvedAt?.toISOString() ?? null,
      matchesCurrent: request.contentVersionId === snapshot.current?.id && request.fingerprint === getFingerprint(snapshot, request.socialProfileId),
      targetProfile: request.targetProfileId && request.targetProfileName ? {
        id: request.targetProfileId,
        displayName: request.targetProfileName,
        handle: request.targetProfileHandle,
      } : null,
      decisions: decisions.filter((decision) => decision.approvalRequestId === request.id).map((decision) => ({
        decision: decision.decision,
        note: decision.note,
        reviewerName: decision.reviewerName,
        occurredAt: decision.occurredAt.toISOString(),
      })),
    })),
  };
}

export async function submitContentForApproval(organizationId: string, userId: string, itemId: string, requestedSocialProfileId: string | null = null) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [item] = await transaction.select({
      id: contentItems.id,
      brandId: contentItems.brandId,
      title: contentItems.title,
      platform: contentItems.platform,
      status: contentItems.status,
      plannedAt: contentItems.plannedAt,
      timeZone: contentItems.timeZone,
    }).from(contentItems).where(and(
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.id, itemId),
    )).for("update").limit(1);
    if (!item) return { kind: "not_found" as const };
    const [current] = await transaction.select({
      id: contentVersions.id,
      versionNumber: contentVersions.versionNumber,
      canonicalCopy: contentVersions.canonicalCopy,
      brandKitVersionNumber: contentVersions.brandKitVersionNumber,
      capabilitySnapshot: contentVersions.capabilitySnapshot,
      variantCopy: contentVariants.copy,
    }).from(contentVersions).innerJoin(contentVariants, and(
      eq(contentVariants.organizationId, contentVersions.organizationId),
      eq(contentVariants.contentVersionId, contentVersions.id),
      eq(contentVariants.platform, item.platform),
    )).where(and(
      eq(contentVersions.organizationId, organizationId),
      eq(contentVersions.contentItemId, itemId),
    )).orderBy(desc(contentVersions.versionNumber)).limit(1);
    if (!current) return { kind: "content_required" as const };

    let socialProfileId: string | null = null;
    const publisher = getSocialPublisher(item.platform);
    if (publisher) {
      const profiles = await transaction.select({ id: socialProfiles.id, scopes: socialProfileCredentials.scopes })
        .from(socialProfiles).innerJoin(socialProfileCredentials, and(
          eq(socialProfileCredentials.organizationId, socialProfiles.organizationId),
          eq(socialProfileCredentials.socialProfileId, socialProfiles.id),
        )).where(and(
          eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.brandId, item.brandId),
          eq(socialProfiles.platform, item.platform), eq(socialProfiles.status, "connected"),
        ));
      const connectedProfile = requestedSocialProfileId
        ? profiles.find((profile) => profile.id === requestedSocialProfileId && publisher.requiredScopes.every((scope) => profile.scopes.includes(scope)))
        : profiles.length === 1 ? profiles[0] : undefined;
      if (!connectedProfile || !publisher.requiredScopes.every((scope) => connectedProfile.scopes.includes(scope))) return { kind: "publisher_profile_required" as const };
      socialProfileId = connectedProfile.id;
      if (publisher.maximumTextCharacters !== undefined && [...current.variantCopy].length > publisher.maximumTextCharacters) return { kind: "publisher_text_limit" as const };
    } else if (requestedSocialProfileId) {
      return { kind: "publisher_profile_required" as const };
    }

    if (!CONTENT_EDITABLE_STATUSES.some((status) => status === item.status)) {
      const [pendingRequest] = await transaction.select({ id: contentApprovalRequests.id }).from(contentApprovalRequests).where(and(
        eq(contentApprovalRequests.organizationId, organizationId),
        eq(contentApprovalRequests.contentItemId, itemId),
        eq(contentApprovalRequests.contentVersionId, current.id),
        eq(contentApprovalRequests.status, CONTENT_APPROVAL_STATUS.pending),
      )).limit(1);
      if (item.status === CONTENT_STATUS.inReview && pendingRequest) return { kind: "existing" as const, id: pendingRequest.id };
      return { kind: "conflict" as const };
    }

    const media = await transaction.select({ id: contentMediaAssets.id, status: contentMediaAssets.status, sha256: contentMediaAssets.sha256, contentType: contentMediaAssets.contentType, sizeBytes: contentMediaAssets.sizeBytes, width: contentMediaAssets.width, height: contentMediaAssets.height })
      .from(contentMediaAssets).where(and(
        eq(contentMediaAssets.organizationId, organizationId),
        eq(contentMediaAssets.contentItemId, itemId),
        eq(contentMediaAssets.contentVersionId, current.id),
      ));
    if (media.some((asset) => CONTENT_APPROVAL_BLOCKING_MEDIA_STATUSES.some((status) => status === asset.status))) return { kind: "media_pending" as const };
    if (publisher?.mediaSupport === "none" && media.length > 0) return { kind: "publisher_media_unsupported" as const };
    if (publisher?.mediaSupport === "single_image" && (media.length !== 1 || !media[0] || !isInstagramImagePublishable(media[0]))) return { kind: "publisher_media_unsupported" as const };

    const [existing] = await transaction.select({ id: contentApprovalRequests.id, status: contentApprovalRequests.status }).from(contentApprovalRequests).where(and(
      eq(contentApprovalRequests.organizationId, organizationId),
      eq(contentApprovalRequests.contentItemId, itemId),
      eq(contentApprovalRequests.contentVersionId, current.id),
    )).limit(1);
    if (existing) return existing.status === CONTENT_APPROVAL_STATUS.pending ? { kind: "existing" as const, id: existing.id } : { kind: "conflict" as const };

    const fingerprint = getContentApprovalFingerprint({
      contentItemId: item.id,
      brandId: item.brandId,
      title: item.title,
      platform: item.platform,
      plannedAt: item.plannedAt,
      timeZone: item.timeZone,
      contentVersionId: current.id,
      socialProfileId,
      versionNumber: current.versionNumber,
      canonicalCopy: current.canonicalCopy,
      variantCopy: current.variantCopy,
      brandKitVersionNumber: current.brandKitVersionNumber,
      capabilitySnapshot: current.capabilitySnapshot,
      media: media.filter((asset) => asset.status === CONTENT_MEDIA_STATUS.approved),
    });
    const [brandPolicy] = await transaction.select({ requiredApprovals: contentApprovalPolicies.requiredApprovals }).from(contentApprovalPolicies).where(and(
      eq(contentApprovalPolicies.organizationId, organizationId),
      eq(contentApprovalPolicies.brandId, item.brandId),
    )).limit(1);
    const [organizationPolicy] = await transaction.select({ requiredApprovals: contentApprovalPolicies.requiredApprovals }).from(contentApprovalPolicies).where(and(
      eq(contentApprovalPolicies.organizationId, organizationId),
      eq(contentApprovalPolicies.scopeKey, "organization"),
    )).limit(1);
    const [request] = await transaction.insert(contentApprovalRequests).values({
      organizationId,
      contentItemId: itemId,
      brandId: item.brandId,
      contentVersionId: current.id,
      socialProfileId,
      fingerprint,
      submittedBy: userId,
      requiredApprovals: brandPolicy?.requiredApprovals ?? organizationPolicy?.requiredApprovals ?? 1,
    }).returning({ id: contentApprovalRequests.id });
    if (!request) return { kind: "not_found" as const };
    await transaction.update(contentItems).set({ status: CONTENT_STATUS.inReview, updatedAt: new Date() }).where(and(
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.id, itemId),
      inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
    ));
    return { kind: "created" as const, id: request.id, brandId: item.brandId, platform: item.platform };
  });
}

export async function decideContentApproval(organizationId: string, reviewerId: string, itemId: string, decision: typeof CONTENT_APPROVAL_STATUS.approved | typeof CONTENT_APPROVAL_STATUS.rejected | typeof CONTENT_APPROVAL_STATUS.changesRequested, note: string | null) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [item] = await transaction.select({
      id: contentItems.id,
      brandId: contentItems.brandId,
      title: contentItems.title,
      platform: contentItems.platform,
      plannedAt: contentItems.plannedAt,
      timeZone: contentItems.timeZone,
    }).from(contentItems).where(and(
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.id, itemId),
      eq(contentItems.status, CONTENT_STATUS.inReview),
    )).for("update").limit(1);
    if (!item) return { kind: "not_found" as const };
    const [current] = await transaction.select({
      id: contentVersions.id,
      versionNumber: contentVersions.versionNumber,
      canonicalCopy: contentVersions.canonicalCopy,
      brandKitVersionNumber: contentVersions.brandKitVersionNumber,
      capabilitySnapshot: contentVersions.capabilitySnapshot,
      variantCopy: contentVariants.copy,
    }).from(contentVersions).innerJoin(contentVariants, and(
      eq(contentVariants.organizationId, contentVersions.organizationId),
      eq(contentVariants.contentVersionId, contentVersions.id),
      eq(contentVariants.platform, item.platform),
    )).where(and(
      eq(contentVersions.organizationId, organizationId),
      eq(contentVersions.contentItemId, itemId),
    )).orderBy(desc(contentVersions.versionNumber)).limit(1);
    if (!current) return { kind: "conflict" as const };
    const [request] = await transaction.select().from(contentApprovalRequests).where(and(
      eq(contentApprovalRequests.organizationId, organizationId),
      eq(contentApprovalRequests.contentItemId, itemId),
      eq(contentApprovalRequests.contentVersionId, current.id),
      eq(contentApprovalRequests.status, CONTENT_APPROVAL_STATUS.pending),
    )).for("update").limit(1);
    if (!request) return { kind: "conflict" as const };
    const publisher = getSocialPublisher(item.platform);
    let publicationProfileId: string | null = null;
    if (publisher) {
      if (!request.socialProfileId) return { kind: "conflict" as const };
      const [targetProfile] = await transaction.select({ id: socialProfiles.id, scopes: socialProfileCredentials.scopes })
        .from(socialProfiles).innerJoin(socialProfileCredentials, and(
          eq(socialProfileCredentials.organizationId, socialProfiles.organizationId),
          eq(socialProfileCredentials.socialProfileId, socialProfiles.id),
        )).where(and(
          eq(socialProfiles.organizationId, organizationId),
          eq(socialProfiles.id, request.socialProfileId),
          eq(socialProfiles.brandId, item.brandId),
          eq(socialProfiles.platform, item.platform),
          eq(socialProfiles.status, "connected"),
        )).limit(1);
      if (!targetProfile || !publisher.requiredScopes.every((scope) => targetProfile.scopes.includes(scope))) return { kind: "conflict" as const };
      publicationProfileId = targetProfile.id;
    }
    if (request.submittedBy === reviewerId) return { kind: "self_review" as const };
    const [priorDecision] = await transaction.select({ id: contentApprovalDecisions.id }).from(contentApprovalDecisions).where(and(
      eq(contentApprovalDecisions.organizationId, organizationId),
      eq(contentApprovalDecisions.approvalRequestId, request.id),
      eq(contentApprovalDecisions.reviewerId, reviewerId),
    )).limit(1);
    if (priorDecision) return { kind: "already_decided" as const };

    const media = await transaction.select({ id: contentMediaAssets.id, status: contentMediaAssets.status, sha256: contentMediaAssets.sha256, contentType: contentMediaAssets.contentType, sizeBytes: contentMediaAssets.sizeBytes, width: contentMediaAssets.width, height: contentMediaAssets.height })
      .from(contentMediaAssets).where(and(
        eq(contentMediaAssets.organizationId, organizationId),
        eq(contentMediaAssets.contentItemId, itemId),
        eq(contentMediaAssets.contentVersionId, current.id),
      ));
    if (publisher?.mediaSupport === "none" && media.length > 0) return { kind: "conflict" as const };
    if (publisher?.mediaSupport === "single_image" && (media.length !== 1 || !media[0] || !isInstagramImagePublishable(media[0]))) return { kind: "conflict" as const };
    const fingerprint = getContentApprovalFingerprint({
      contentItemId: item.id,
      brandId: item.brandId,
      title: item.title,
      platform: item.platform,
      plannedAt: item.plannedAt,
      timeZone: item.timeZone,
      contentVersionId: current.id,
      socialProfileId: request.socialProfileId,
      versionNumber: current.versionNumber,
      canonicalCopy: current.canonicalCopy,
      variantCopy: current.variantCopy,
      brandKitVersionNumber: current.brandKitVersionNumber,
      capabilitySnapshot: current.capabilitySnapshot,
      media: media.filter((asset) => asset.status === CONTENT_MEDIA_STATUS.approved),
    });
    if (fingerprint !== request.fingerprint) {
      await transaction.update(contentApprovalRequests).set({ status: CONTENT_APPROVAL_STATUS.stale, resolvedAt: new Date() }).where(and(
        eq(contentApprovalRequests.organizationId, organizationId),
        eq(contentApprovalRequests.id, request.id),
        eq(contentApprovalRequests.status, CONTENT_APPROVAL_STATUS.pending),
      ));
      await transaction.update(contentItems).set({ status: CONTENT_STATUS.draft, updatedAt: new Date() }).where(and(eq(contentItems.organizationId, organizationId), eq(contentItems.id, itemId)));
      return { kind: "stale" as const };
    }

    const [decisionRecord] = await transaction.insert(contentApprovalDecisions).values({ organizationId, approvalRequestId: request.id, reviewerId, decision, note, fingerprint }).returning({ id: contentApprovalDecisions.id });
    if (decision === CONTENT_APPROVAL_STATUS.approved) {
      const [approvedCount] = await transaction.select({ value: count() }).from(contentApprovalDecisions).where(and(
        eq(contentApprovalDecisions.organizationId, organizationId),
        eq(contentApprovalDecisions.approvalRequestId, request.id),
        eq(contentApprovalDecisions.decision, CONTENT_APPROVAL_STATUS.approved),
      ));
      if (approvedCount.value < request.requiredApprovals) return { kind: "partial" as const, approvedCount: approvedCount.value, requiredApprovals: request.requiredApprovals, brandId: item.brandId, platform: item.platform, decisionId: decisionRecord.id };
      if (publisher && publicationProfileId) {
        await transaction.insert(socialPublicationJobs).values({
          organizationId, brandId: item.brandId, contentItemId: item.id, approvalRequestId: request.id,
          socialProfileId: publicationProfileId, fingerprint: request.fingerprint,
          idempotencyKey: request.id, status: SOCIAL_PUBLICATION_JOB_STATUS.queued,
          scheduledAt: item.plannedAt, nextAttemptAt: item.plannedAt,
        }).onConflictDoNothing({ target: [socialPublicationJobs.organizationId, socialPublicationJobs.approvalRequestId] });
      }
    }
    await transaction.update(contentApprovalRequests).set({ status: decision, resolvedAt: new Date() }).where(and(
      eq(contentApprovalRequests.organizationId, organizationId),
      eq(contentApprovalRequests.id, request.id),
      eq(contentApprovalRequests.status, CONTENT_APPROVAL_STATUS.pending),
    ));
    const publicationEnabled = Boolean(publisher);
    await transaction.update(contentItems).set({ status: decision === CONTENT_APPROVAL_STATUS.approved ? (publicationEnabled ? CONTENT_STATUS.scheduled : CONTENT_STATUS.approved) : CONTENT_STATUS.draft, updatedAt: new Date() }).where(and(
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.id, itemId),
      eq(contentItems.status, CONTENT_STATUS.inReview),
    ));
    return { kind: "decided" as const, decision, itemStatus: decision === CONTENT_APPROVAL_STATUS.approved && publicationEnabled ? CONTENT_STATUS.scheduled : decision === CONTENT_APPROVAL_STATUS.approved ? CONTENT_STATUS.approved : CONTENT_STATUS.draft, brandId: item.brandId, platform: item.platform, decisionId: decisionRecord.id };
  });
}
