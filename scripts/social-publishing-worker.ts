import { and, asc, desc, eq, isNotNull, lt, lte } from "drizzle-orm";
import { CONTENT_APPROVAL_STATUS, CONTENT_MEDIA_STATUS, CONTENT_STATUS, SOCIAL_PUBLICATION_JOB_STATUS, SOCIAL_PUBLICATION_LEASE_TIMEOUT_MILLISECONDS, SOCIAL_PUBLICATION_RECONCILIATION_LIMITS, SOCIAL_PUBLISHING_WORKER } from "../lib/constants";
import { getDatabase, closeDatabase } from "../lib/db/client";
import { contentApprovalRequests, contentItems, contentMediaAssets, contentVariants, contentVersions, socialProfileCredentials, socialProfiles, socialPublicationAttempts, socialPublicationJobs, socialPublicationReconciliations } from "../lib/db/schema";
import { getContentApprovalFingerprint } from "../lib/server/content-approval-fingerprint";
import { getValidSocialAccessToken } from "../lib/server/social-access-token";
import { getSocialPublisher } from "../lib/server/social-publisher/registry";
import { cleanupExpiredSocialPublicationImages, createInstagramPublicationImage, deleteSocialPublicationImage } from "../lib/server/brand-asset-storage";
import { isPublishableInstagramImage } from "../lib/server/social-publisher/instagram-media";
import { recordSocialPublishingWorkerHeartbeat } from "../lib/db/repositories/social-publication-health";

const pollMilliseconds = 5_000;
const leaseBatchSize = 1;
const leaseRecoveryBatchSize = 20;
const reconciliationBatchSize = 1;
let stopping = false;
process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

async function claimDueJob() {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const [job] = await tx.select().from(socialPublicationJobs).where(and(
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.queued),
      lte(socialPublicationJobs.nextAttemptAt, new Date()),
    )).orderBy(asc(socialPublicationJobs.nextAttemptAt)).for("update", { skipLocked: true }).limit(leaseBatchSize);
    if (!job) return null;
    const now = new Date();
    await tx.update(socialPublicationJobs).set({ status: SOCIAL_PUBLICATION_JOB_STATUS.processing, lockedAt: now, attemptCount: job.attemptCount + 1, providerReferenceId: null, updatedAt: now })
      .where(and(eq(socialPublicationJobs.organizationId, job.organizationId), eq(socialPublicationJobs.id, job.id), eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.queued)));
    return { ...job, attemptCount: job.attemptCount + 1 };
  });
}

async function claimIndeterminateJob() {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const now = new Date();
    const [job] = await tx.select({
      id: socialPublicationJobs.id,
      organizationId: socialPublicationJobs.organizationId,
      contentItemId: socialPublicationJobs.contentItemId,
      socialProfileId: socialPublicationJobs.socialProfileId,
      providerReferenceId: socialPublicationJobs.providerReferenceId,
      reconciliationAttemptCount: socialPublicationJobs.reconciliationAttemptCount,
    }).from(socialPublicationJobs).where(and(
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate),
      isNotNull(socialPublicationJobs.providerReferenceId),
      lt(socialPublicationJobs.reconciliationAttemptCount, SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.maximumAutomaticChecksPerJob),
      lte(socialPublicationJobs.nextReconciliationAt, now),
    )).orderBy(asc(socialPublicationJobs.nextReconciliationAt)).for("update", { skipLocked: true }).limit(reconciliationBatchSize);
    if (!job) return null;
    const reconciliationAttemptCount = job.reconciliationAttemptCount + 1;
    await tx.update(socialPublicationJobs).set({
      reconciliationAttemptCount,
      nextReconciliationAt: new Date(now.getTime() + SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.automaticCheckIntervalMilliseconds),
      updatedAt: now,
    }).where(and(
      eq(socialPublicationJobs.organizationId, job.organizationId),
      eq(socialPublicationJobs.id, job.id),
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate),
    ));
    return { ...job, reconciliationAttemptCount };
  });
}

async function markExpiredLeasesIndeterminate() {
  const db = getDatabase();
  const leaseCutoff = new Date(Date.now() - SOCIAL_PUBLICATION_LEASE_TIMEOUT_MILLISECONDS);
  await db.transaction(async (tx) => {
    const expiredJobs = await tx.select().from(socialPublicationJobs).where(and(
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.processing),
      lte(socialPublicationJobs.lockedAt, leaseCutoff),
    )).orderBy(asc(socialPublicationJobs.lockedAt)).for("update", { skipLocked: true }).limit(leaseRecoveryBatchSize);
    for (const job of expiredJobs) {
      await tx.update(socialPublicationJobs).set({
        status: SOCIAL_PUBLICATION_JOB_STATUS.indeterminate,
        lastErrorCode: "worker_lease_expired",
        lockedAt: null,
        nextReconciliationAt: new Date(Date.now() + SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.automaticCheckIntervalMilliseconds),
        updatedAt: new Date(),
      }).where(and(
        eq(socialPublicationJobs.organizationId, job.organizationId),
        eq(socialPublicationJobs.id, job.id),
        eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.processing),
      ));
      await tx.insert(socialPublicationAttempts).values({
        organizationId: job.organizationId, jobId: job.id, attemptNumber: job.attemptCount,
        outcome: SOCIAL_PUBLICATION_JOB_STATUS.indeterminate, errorCode: "worker_lease_expired",
      }).onConflictDoNothing({ target: [socialPublicationAttempts.organizationId, socialPublicationAttempts.jobId, socialPublicationAttempts.attemptNumber] });
    }
  });
}

async function finish(job: NonNullable<Awaited<ReturnType<typeof claimDueJob>>>, state: typeof SOCIAL_PUBLICATION_JOB_STATUS.published | typeof SOCIAL_PUBLICATION_JOB_STATUS.failed | typeof SOCIAL_PUBLICATION_JOB_STATUS.indeterminate, errorCode: string | null, externalPostId: string | null) {
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.update(socialPublicationJobs).set({
      status: state,
      lastErrorCode: errorCode,
      externalPostId,
      lockedAt: null,
      ...(state === SOCIAL_PUBLICATION_JOB_STATUS.indeterminate
        ? { nextReconciliationAt: new Date(now.getTime() + SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.automaticCheckIntervalMilliseconds) }
        : { providerReferenceId: null }),
      updatedAt: now,
    })
      .where(and(eq(socialPublicationJobs.organizationId, job.organizationId), eq(socialPublicationJobs.id, job.id), eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.processing)));
    await tx.insert(socialPublicationAttempts).values({ organizationId: job.organizationId, jobId: job.id, attemptNumber: job.attemptCount, outcome: state, errorCode, externalPostId })
      .onConflictDoNothing({ target: [socialPublicationAttempts.organizationId, socialPublicationAttempts.jobId, socialPublicationAttempts.attemptNumber] });
    if (state === SOCIAL_PUBLICATION_JOB_STATUS.published || state === SOCIAL_PUBLICATION_JOB_STATUS.failed) {
      await tx.update(contentItems).set({ status: state === SOCIAL_PUBLICATION_JOB_STATUS.published ? CONTENT_STATUS.published : CONTENT_STATUS.failed, updatedAt: new Date() })
        .where(and(eq(contentItems.organizationId, job.organizationId), eq(contentItems.id, job.contentItemId), eq(contentItems.status, CONTENT_STATUS.scheduled)));
    }
  });
}

async function processIndeterminateJob(job: NonNullable<Awaited<ReturnType<typeof claimIndeterminateJob>>>) {
  if (!job.providerReferenceId) return;
  const db = getDatabase();
  const [data] = await db.select({
    item: contentItems,
    profile: socialProfiles,
    scopes: socialProfileCredentials.scopes,
  }).from(socialPublicationJobs)
    .innerJoin(contentItems, and(eq(contentItems.organizationId, socialPublicationJobs.organizationId), eq(contentItems.id, socialPublicationJobs.contentItemId)))
    .innerJoin(socialProfiles, and(eq(socialProfiles.organizationId, socialPublicationJobs.organizationId), eq(socialProfiles.id, socialPublicationJobs.socialProfileId)))
    .innerJoin(socialProfileCredentials, and(eq(socialProfileCredentials.organizationId, socialProfiles.organizationId), eq(socialProfileCredentials.socialProfileId, socialProfiles.id)))
    .where(and(
      eq(socialPublicationJobs.organizationId, job.organizationId),
      eq(socialPublicationJobs.id, job.id),
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate),
    )).limit(1);
  const publisher = data ? getSocialPublisher(data.item.platform) : null;
  if (!data || !publisher?.reconcilePublished || !data.profile.externalAccountId || data.profile.status !== "connected" || data.profile.platform !== data.item.platform || data.profile.brandId !== data.item.brandId || !publisher.requiredScopes.every((scope) => data.scopes.includes(scope))) return;
  let accessToken: string | null;
  try { accessToken = await getValidSocialAccessToken(job.organizationId, job.socialProfileId); }
  catch { return; }
  if (!accessToken) return;
  let result: Awaited<ReturnType<NonNullable<typeof publisher.reconcilePublished>>>;
  try {
    result = await publisher.reconcilePublished(accessToken, {
      externalAccountId: data.profile.externalAccountId,
      providerReferenceId: job.providerReferenceId,
    });
  } catch { return; }
  if (result.kind !== "published") return;

  await db.transaction(async (tx) => {
    const [currentJob] = await tx.select({ id: socialPublicationJobs.id }).from(socialPublicationJobs).where(and(
      eq(socialPublicationJobs.organizationId, job.organizationId),
      eq(socialPublicationJobs.id, job.id),
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate),
    )).for("update").limit(1);
    if (!currentJob) return;
    const now = new Date();
    await tx.update(socialPublicationJobs).set({
      status: SOCIAL_PUBLICATION_JOB_STATUS.published,
      lastErrorCode: null,
      lockedAt: null,
      updatedAt: now,
    }).where(and(
      eq(socialPublicationJobs.organizationId, job.organizationId),
      eq(socialPublicationJobs.id, job.id),
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate),
    ));
    await tx.update(contentItems).set({ status: CONTENT_STATUS.published, updatedAt: now }).where(and(
      eq(contentItems.organizationId, job.organizationId),
      eq(contentItems.id, job.contentItemId),
      eq(contentItems.status, CONTENT_STATUS.scheduled),
    ));
    await tx.insert(socialPublicationReconciliations).values({
      organizationId: job.organizationId,
      jobId: job.id,
      source: "automatic",
      actorUserId: null,
      outcome: "published",
      evidence: "Instagram API reported the saved media container status as PUBLISHED.",
    });
  });
}

async function processJob(job: NonNullable<Awaited<ReturnType<typeof claimDueJob>>>) {
  const db = getDatabase();
  try { await cleanupExpiredSocialPublicationImages(job.organizationId); } catch { /* Cleanup is retried by the next publication for this tenant. */ }
  const [data] = await db.select({
    request: contentApprovalRequests,
    item: contentItems,
    version: contentVersions,
    copy: contentVariants.copy,
    profile: socialProfiles,
    scopes: socialProfileCredentials.scopes,
  }).from(socialPublicationJobs)
    .innerJoin(contentApprovalRequests, and(eq(contentApprovalRequests.organizationId, socialPublicationJobs.organizationId), eq(contentApprovalRequests.id, socialPublicationJobs.approvalRequestId)))
    .innerJoin(contentItems, and(eq(contentItems.organizationId, socialPublicationJobs.organizationId), eq(contentItems.id, socialPublicationJobs.contentItemId)))
    .innerJoin(contentVersions, and(eq(contentVersions.organizationId, contentApprovalRequests.organizationId), eq(contentVersions.id, contentApprovalRequests.contentVersionId)))
    .innerJoin(contentVariants, and(eq(contentVariants.organizationId, contentVersions.organizationId), eq(contentVariants.contentVersionId, contentVersions.id), eq(contentVariants.platform, contentItems.platform)))
    .innerJoin(socialProfiles, and(eq(socialProfiles.organizationId, socialPublicationJobs.organizationId), eq(socialProfiles.id, socialPublicationJobs.socialProfileId)))
    .innerJoin(socialProfileCredentials, and(eq(socialProfileCredentials.organizationId, socialProfiles.organizationId), eq(socialProfileCredentials.socialProfileId, socialProfiles.id)))
    .where(and(eq(socialPublicationJobs.organizationId, job.organizationId), eq(socialPublicationJobs.id, job.id))).limit(1);
  const publisher = data ? getSocialPublisher(data.item.platform) : null;
  if (!data || !publisher || data.request.status !== CONTENT_APPROVAL_STATUS.approved || data.item.status !== CONTENT_STATUS.scheduled || data.profile.status !== "connected" || data.profile.platform !== data.item.platform || data.profile.brandId !== data.item.brandId || !data.profile.externalAccountId || !publisher.requiredScopes.every((scope) => data.scopes.includes(scope))) {
    await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, "publication_precondition_failed", null);
    return;
  }
  const media = await db.select({ id: contentMediaAssets.id, sha256: contentMediaAssets.sha256, contentType: contentMediaAssets.contentType, sizeBytes: contentMediaAssets.sizeBytes, width: contentMediaAssets.width, height: contentMediaAssets.height, status: contentMediaAssets.status, objectKey: contentMediaAssets.objectKey })
    .from(contentMediaAssets).where(and(eq(contentMediaAssets.organizationId, job.organizationId), eq(contentMediaAssets.contentItemId, job.contentItemId), eq(contentMediaAssets.contentVersionId, data.version.id)));
  const fingerprint = getContentApprovalFingerprint({
    contentItemId: data.item.id, brandId: data.item.brandId, title: data.item.title, platform: data.item.platform,
    plannedAt: data.item.plannedAt, timeZone: data.item.timeZone, contentVersionId: data.version.id,
    socialProfileId: job.socialProfileId, versionNumber: data.version.versionNumber,
    canonicalCopy: data.version.canonicalCopy, variantCopy: data.copy,
    brandKitVersionNumber: data.version.brandKitVersionNumber,
    capabilitySnapshot: data.version.capabilitySnapshot,
    media: media.filter((asset) => asset.status === CONTENT_MEDIA_STATUS.approved),
  });
  const approvedMedia = media.filter((asset) => asset.status === CONTENT_MEDIA_STATUS.approved);
  const unsupportedMedia = publisher.mediaSupport === "none"
    ? media.length > 0
    : media.length !== 1 || approvedMedia.length !== 1 || !approvedMedia[0]?.objectKey || !approvedMedia[0].sha256 || !isPublishableInstagramImage(approvedMedia[0]);
  if (fingerprint !== job.fingerprint || fingerprint !== data.request.fingerprint || unsupportedMedia) {
    await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, "approval_snapshot_mismatch", null);
    return;
  }
  const [latestVersion] = await db.select({ id: contentVersions.id }).from(contentVersions).where(and(
    eq(contentVersions.organizationId, job.organizationId), eq(contentVersions.contentItemId, job.contentItemId),
  )).orderBy(desc(contentVersions.versionNumber)).limit(1);
  if (latestVersion?.id !== data.version.id) {
    await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, "content_version_changed", null);
    return;
  }
  if (publisher.maximumTextCharacters !== undefined && [...data.copy].length > publisher.maximumTextCharacters) {
    await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, "publisher_text_limit_exceeded", null);
    return;
  }
  try { publisher.assertConfigured(); }
  catch {
    await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, "publisher_not_configured", null);
    return;
  }
  let accessToken: string | null;
  try {
    accessToken = await getValidSocialAccessToken(job.organizationId, job.socialProfileId);
  } catch {
    await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, "social_token_unavailable", null);
    return;
  }
  if (!accessToken) {
    await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, "social_reauthentication_required", null);
    return;
  }
  let stagingKey: string | null = null;
  let imageUrl: string | undefined;
  if (publisher.mediaSupport === "single_image") {
    const asset = approvedMedia[0];
    const expectedObjectPrefix = `tenants/${encodeURIComponent(job.organizationId)}/brands/${data.item.brandId}/content/${data.item.id}/${data.version.id}/`;
    const objectKeyFileName = asset?.objectKey.startsWith(expectedObjectPrefix) ? asset.objectKey.slice(expectedObjectPrefix.length) : "";
    if (!asset || !objectKeyFileName || objectKeyFileName.includes("/") || !asset.sha256 || !asset.contentType || !asset.sizeBytes || !isPublishableInstagramImage(asset)) {
      await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, "publication_media_invalid", null);
      return;
    }
    try {
      const staged = await createInstagramPublicationImage(asset.objectKey, { sha256: asset.sha256, sizeBytes: asset.sizeBytes, contentType: asset.contentType }, job.organizationId, job.id);
      stagingKey = staged.stagingKey;
      imageUrl = staged.url;
    } catch {
      await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, "publication_media_staging_failed", null);
      return;
    }
  }
  const result = await publisher.publishText(accessToken, {
    externalAccountId: data.profile.externalAccountId,
    copy: data.copy,
    ...(imageUrl ? { imageUrl } : {}),
    beforeFinalPublish: async (providerReferenceId) => {
      const [savedJob] = await db.update(socialPublicationJobs).set({ providerReferenceId, updatedAt: new Date() }).where(and(
        eq(socialPublicationJobs.organizationId, job.organizationId),
        eq(socialPublicationJobs.id, job.id),
        eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.processing),
      )).returning({ id: socialPublicationJobs.id });
      if (!savedJob) throw new Error("Publication job is no longer active.");
    },
  });
  if (stagingKey && result.kind !== "indeterminate") {
    try { await deleteSocialPublicationImage(stagingKey, job.organizationId, job.id); } catch { /* Retention cleanup removes stale publication images. */ }
  }
  if (result.kind === "indeterminate") {
    await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate, "provider_result_indeterminate", null);
    return;
  }
  if (result.kind === "rejected") {
    await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.failed, `provider_rejected_${result.status}`, null);
    return;
  }
  await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.published, null, result.externalPostId);
}

async function main() {
  if (process.env.SOCIAL_PUBLISHING_ENABLED !== "true") return;
  await recordSocialPublishingWorkerHeartbeat();
  const heartbeatTimer = setInterval(() => {
    void recordSocialPublishingWorkerHeartbeat().catch(() => undefined);
  }, SOCIAL_PUBLISHING_WORKER.heartbeatIntervalMilliseconds);
  let nextLeaseScanAt = 0;
  try {
    while (!stopping) {
      if (Date.now() >= nextLeaseScanAt) {
        await markExpiredLeasesIndeterminate();
        nextLeaseScanAt = Date.now() + SOCIAL_PUBLICATION_LEASE_TIMEOUT_MILLISECONDS / 2;
      }
      const job = await claimDueJob();
      if (!job) {
        const indeterminateJob = await claimIndeterminateJob();
        if (indeterminateJob) {
          try { await processIndeterminateJob(indeterminateJob); } catch { /* The bounded next check or manual review will resolve this job. */ }
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, pollMilliseconds));
        continue;
      }
      try { await processJob(job); }
      catch {
        await finish(job, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate, "worker_outcome_unknown", null);
      }
    }
  } finally {
    clearInterval(heartbeatTimer);
    await closeDatabase();
  }
}

main().catch(async () => { await closeDatabase(); process.exitCode = 1; });
