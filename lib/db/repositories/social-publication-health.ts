import "server-only";
import { and, count, eq, lte, min, or } from "drizzle-orm";
import { SOCIAL_PUBLISHING_WORKER, SOCIAL_PUBLICATION_JOB_STATUS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { backgroundWorkerHeartbeats, contentItems, socialProfiles, socialPublicationJobs } from "@/lib/db/schema";
import type { SocialPlatform } from "@/lib/constants";

export async function recordSocialPublishingWorkerHeartbeat(now = new Date()) {
  await getDatabase().insert(backgroundWorkerHeartbeats).values({ workerKey: SOCIAL_PUBLISHING_WORKER.heartbeatKey, lastSeenAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: backgroundWorkerHeartbeats.workerKey, set: { lastSeenAt: now, updatedAt: now } });
}

export async function getSocialPublicationWorkerHealth(organizationId: string, input: { brandId?: string; platform?: SocialPlatform; now?: Date }) {
  const database = getDatabase();
  const now = input.now ?? new Date();
  const conditions = [eq(socialPublicationJobs.organizationId, organizationId)];
  if (input.brandId) conditions.push(eq(socialPublicationJobs.brandId, input.brandId));
  if (input.platform) conditions.push(eq(contentItems.platform, input.platform));
  const query = database.select({ status: socialPublicationJobs.status, total: count() })
    .from(socialPublicationJobs)
    .innerJoin(contentItems, and(eq(contentItems.organizationId, socialPublicationJobs.organizationId), eq(contentItems.id, socialPublicationJobs.contentItemId), eq(contentItems.brandId, socialPublicationJobs.brandId)))
    .innerJoin(socialProfiles, and(eq(socialProfiles.organizationId, socialPublicationJobs.organizationId), eq(socialProfiles.id, socialPublicationJobs.socialProfileId), eq(socialProfiles.brandId, socialPublicationJobs.brandId)))
    .where(and(...conditions, or(
      and(eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.queued), lte(socialPublicationJobs.nextAttemptAt, now)),
      eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.processing),
    ))).groupBy(socialPublicationJobs.status);
  const oldestQueuedQuery = database.select({ scheduledAt: min(socialPublicationJobs.scheduledAt) })
    .from(socialPublicationJobs)
    .innerJoin(contentItems, and(eq(contentItems.organizationId, socialPublicationJobs.organizationId), eq(contentItems.id, socialPublicationJobs.contentItemId), eq(contentItems.brandId, socialPublicationJobs.brandId)))
    .innerJoin(socialProfiles, and(eq(socialProfiles.organizationId, socialPublicationJobs.organizationId), eq(socialProfiles.id, socialPublicationJobs.socialProfileId), eq(socialProfiles.brandId, socialPublicationJobs.brandId)))
    .where(and(...conditions, eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.queued), lte(socialPublicationJobs.nextAttemptAt, now)));
  const [counts, [oldest], [heartbeat]] = await Promise.all([
    query,
    oldestQueuedQuery,
    database.select({ lastSeenAt: backgroundWorkerHeartbeats.lastSeenAt }).from(backgroundWorkerHeartbeats)
      .where(eq(backgroundWorkerHeartbeats.workerKey, SOCIAL_PUBLISHING_WORKER.heartbeatKey)).limit(1),
  ]);
  const queued = Number(counts.find((row) => row.status === SOCIAL_PUBLICATION_JOB_STATUS.queued)?.total ?? 0);
  const processing = Number(counts.find((row) => row.status === SOCIAL_PUBLICATION_JOB_STATUS.processing)?.total ?? 0);
  const lastSeenAt = heartbeat?.lastSeenAt ?? null;
  const enabled = process.env.SOCIAL_PUBLISHING_ENABLED === "true";
  const status = !enabled ? "disabled" : !lastSeenAt ? "unknown"
    : now.getTime() - lastSeenAt.getTime() <= SOCIAL_PUBLISHING_WORKER.heartbeatStaleMilliseconds ? "healthy" : "stale";
  return { status, lastSeenAt: lastSeenAt?.toISOString() ?? null, queued, processing, oldestQueuedAt: oldest?.scheduledAt?.toISOString() ?? null } as const;
}
