import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { CONTENT_STATUS, SOCIAL_PUBLICATION_JOB_STATUS, SOCIAL_PUBLICATION_RECONCILIATION_LIMITS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { contentItems, socialPublicationJobs, socialPublicationReconciliations } from "@/lib/db/schema";
import type { z } from "zod";
import type { socialPublicationReconciliationRequestSchema } from "@/lib/validation/social-publication";

type ReconciliationInput = z.infer<typeof socialPublicationReconciliationRequestSchema>;

export async function reconcileSocialPublication(organizationId: string, userId: string, itemId: string, input: ReconciliationInput) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [job] = await transaction.select({
      id: socialPublicationJobs.id,
      contentItemId: socialPublicationJobs.contentItemId,
      status: socialPublicationJobs.status,
    }).from(socialPublicationJobs).where(and(
      eq(socialPublicationJobs.organizationId, organizationId),
      eq(socialPublicationJobs.contentItemId, itemId),
      inArray(socialPublicationJobs.status, [SOCIAL_PUBLICATION_JOB_STATUS.indeterminate, SOCIAL_PUBLICATION_JOB_STATUS.failed]),
    )).orderBy(desc(socialPublicationJobs.createdAt)).for("update").limit(1);
    if (!job) return { kind: "conflict" as const };

    const expectedItemStatus = job.status === SOCIAL_PUBLICATION_JOB_STATUS.failed ? CONTENT_STATUS.failed : CONTENT_STATUS.scheduled;
    const [item] = await transaction.select({ id: contentItems.id, status: contentItems.status }).from(contentItems).where(and(
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.id, itemId),
      eq(contentItems.status, expectedItemStatus),
    )).for("update").limit(1);
    if (!item) return { kind: "conflict" as const };

    const published = input.outcome === "published";
    const retry = input.outcome === "retry";
    if (retry) {
      const [previousRetries] = await transaction.select({ count: count() }).from(socialPublicationReconciliations).where(and(
        eq(socialPublicationReconciliations.organizationId, organizationId),
        eq(socialPublicationReconciliations.jobId, job.id),
        eq(socialPublicationReconciliations.outcome, "retry"),
      ));
      if ((previousRetries?.count ?? 0) >= SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.maximumManualRetriesPerJob) return { kind: "retry_limit_reached" as const };
    }
    const nextPublicationStatus = published ? SOCIAL_PUBLICATION_JOB_STATUS.published : retry ? SOCIAL_PUBLICATION_JOB_STATUS.queued : SOCIAL_PUBLICATION_JOB_STATUS.failed;
    const nextItemStatus = published ? CONTENT_STATUS.published : retry ? CONTENT_STATUS.scheduled : CONTENT_STATUS.failed;
    const now = new Date();
    await transaction.insert(socialPublicationReconciliations).values({
      organizationId,
      jobId: job.id,
      actorUserId: userId,
      outcome: input.outcome,
      evidence: input.evidence,
      externalPostId: input.externalPostId ?? null,
    });
    await transaction.update(socialPublicationJobs).set({
      status: nextPublicationStatus,
      externalPostId: input.externalPostId ?? null,
      lastErrorCode: published || retry ? null : "manually_confirmed_not_published",
      providerReferenceId: null,
      ...(retry ? { nextAttemptAt: now, reconciliationAttemptCount: 0, nextReconciliationAt: now } : {}),
      lockedAt: null,
      updatedAt: now,
    }).where(and(
      eq(socialPublicationJobs.organizationId, organizationId),
      eq(socialPublicationJobs.id, job.id),
      eq(socialPublicationJobs.status, job.status),
    ));
    await transaction.update(contentItems).set({ status: nextItemStatus, updatedAt: new Date() }).where(and(
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.id, itemId),
      eq(contentItems.status, expectedItemStatus),
    ));
    return { kind: "resolved" as const, outcome: input.outcome, publicationStatus: nextPublicationStatus, itemStatus: nextItemStatus };
  });
}
