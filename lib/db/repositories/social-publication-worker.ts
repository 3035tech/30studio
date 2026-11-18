import { and, asc, eq, lte } from "drizzle-orm";
import { SOCIAL_PUBLICATION_JOB_STATUS, SOCIAL_PUBLICATION_LEASE_TIMEOUT_MILLISECONDS, SOCIAL_PUBLICATION_RECONCILIATION_LIMITS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { socialPublicationAttempts, socialPublicationJobs } from "@/lib/db/schema";

const CLAIM_BATCH_SIZE = 1;
const LEASE_RECOVERY_BATCH_SIZE = 20;

export async function claimNextDueSocialPublicationJob(now = new Date()) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [job] = await transaction.select().from(socialPublicationJobs).where(and(
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.queued),
      lte(socialPublicationJobs.nextAttemptAt, now),
    )).orderBy(asc(socialPublicationJobs.nextAttemptAt)).for("update", { skipLocked: true }).limit(CLAIM_BATCH_SIZE);
    if (!job) return null;
    const claimedAt = new Date();
    await transaction.update(socialPublicationJobs).set({
      status: SOCIAL_PUBLICATION_JOB_STATUS.processing,
      lockedAt: claimedAt,
      attemptCount: job.attemptCount + 1,
      providerReferenceId: null,
      updatedAt: claimedAt,
    }).where(and(
      eq(socialPublicationJobs.organizationId, job.organizationId),
      eq(socialPublicationJobs.id, job.id),
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.queued),
    ));
    return { ...job, attemptCount: job.attemptCount + 1 };
  });
}

export async function recoverExpiredSocialPublicationLeases(now = new Date()) {
  const database = getDatabase();
  const leaseCutoff = new Date(now.getTime() - SOCIAL_PUBLICATION_LEASE_TIMEOUT_MILLISECONDS);
  return database.transaction(async (transaction) => {
    const expiredJobs = await transaction.select().from(socialPublicationJobs).where(and(
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.processing),
      lte(socialPublicationJobs.lockedAt, leaseCutoff),
    )).orderBy(asc(socialPublicationJobs.lockedAt)).for("update", { skipLocked: true }).limit(LEASE_RECOVERY_BATCH_SIZE);
    for (const job of expiredJobs) {
      await transaction.update(socialPublicationJobs).set({
        status: SOCIAL_PUBLICATION_JOB_STATUS.indeterminate,
        lastErrorCode: "worker_lease_expired",
        lockedAt: null,
        nextReconciliationAt: new Date(now.getTime() + SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.automaticCheckIntervalMilliseconds),
        updatedAt: now,
      }).where(and(
        eq(socialPublicationJobs.organizationId, job.organizationId),
        eq(socialPublicationJobs.id, job.id),
        eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.processing),
      ));
      await transaction.insert(socialPublicationAttempts).values({
        organizationId: job.organizationId,
        jobId: job.id,
        attemptNumber: job.attemptCount,
        outcome: SOCIAL_PUBLICATION_JOB_STATUS.indeterminate,
        errorCode: "worker_lease_expired",
      }).onConflictDoNothing({
        target: [socialPublicationAttempts.organizationId, socialPublicationAttempts.jobId, socialPublicationAttempts.attemptNumber],
      });
    }
    return expiredJobs.length;
  });
}
