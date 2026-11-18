import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, lte, notInArray } from "drizzle-orm";
import { SOCIAL_ANALYTICS_COLLECTION_STATUSES, SOCIAL_ANALYTICS_DEFINITION_VERSION, SOCIAL_ANALYTICS_FRESHNESS_MILLISECONDS, SOCIAL_ANALYTICS_LIMITS, SOCIAL_CONNECTION_EVENT, SOCIAL_PLATFORMS, SOCIAL_PUBLICATION_JOB_STATUS, type SocialPlatform } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brands, contentItems, socialAnalyticsSnapshots, socialConnectionEvents, socialProfileCredentials, socialProfiles, socialPublicationJobs } from "@/lib/db/schema";
import type { MetaPostMetrics } from "@/lib/server/social-analytics/meta";
import { getInteractionsChange } from "@/lib/server/social-analytics/metrics";

export async function listMetaAnalyticsCandidates(organizationId: string, input: { start: Date; end: Date; brandId?: string; platform?: SocialPlatform; maximum: number; cooldownSince: Date }) {
  if (input.platform && input.platform !== "facebook" && input.platform !== "instagram") return [];
  const conditions = [
    eq(socialPublicationJobs.organizationId, organizationId),
    eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.published),
    isNotNull(socialPublicationJobs.externalPostId),
    gte(socialPublicationJobs.scheduledAt, input.start),
    lte(socialPublicationJobs.scheduledAt, input.end),
    inArray(socialProfiles.platform, ["facebook", "instagram"]),
    eq(socialProfiles.status, "connected"),
    notInArray(socialPublicationJobs.id, getDatabase().select({ id: socialAnalyticsSnapshots.publicationJobId })
      .from(socialAnalyticsSnapshots).where(and(
        eq(socialAnalyticsSnapshots.organizationId, organizationId),
        gte(socialAnalyticsSnapshots.collectedAt, input.cooldownSince),
      ))),
  ];
  if (input.brandId) conditions.push(eq(socialPublicationJobs.brandId, input.brandId));
  if (input.platform) conditions.push(eq(socialProfiles.platform, input.platform));
  return getDatabase().select({
    jobId: socialPublicationJobs.id, organizationId: socialPublicationJobs.organizationId,
    brandId: socialPublicationJobs.brandId, socialProfileId: socialPublicationJobs.socialProfileId,
    platform: socialProfiles.platform, externalPostId: socialPublicationJobs.externalPostId,
    scopes: socialProfileCredentials.scopes,
  }).from(socialPublicationJobs)
    .innerJoin(socialProfiles, and(
      eq(socialProfiles.organizationId, socialPublicationJobs.organizationId),
      eq(socialProfiles.id, socialPublicationJobs.socialProfileId),
      eq(socialProfiles.brandId, socialPublicationJobs.brandId),
    ))
    .innerJoin(socialProfileCredentials, and(
      eq(socialProfileCredentials.organizationId, socialProfiles.organizationId),
      eq(socialProfileCredentials.socialProfileId, socialProfiles.id),
    ))
    .where(and(...conditions))
    .orderBy(desc(socialPublicationJobs.scheduledAt))
    .limit(input.maximum);
}

export async function saveMetaAnalyticsSnapshot(input: {
  organizationId: string; brandId: string; socialProfileId: string; jobId: string;
  platform: "facebook" | "instagram"; metrics: MetaPostMetrics; collectedAt: Date;
}) {
  const source = input.platform === "instagram" ? "Meta Instagram Media API" : "Meta Facebook Graph API";
  await getDatabase().insert(socialAnalyticsSnapshots).values({
    organizationId: input.organizationId, brandId: input.brandId,
    socialProfileId: input.socialProfileId, publicationJobId: input.jobId,
    collectionStatus: input.metrics.status, likes: input.metrics.likes,
    comments: input.metrics.comments, shares: input.metrics.shares,
    source, definitionVersion: SOCIAL_ANALYTICS_DEFINITION_VERSION,
    coverage: "post_lifetime", collectedAt: input.collectedAt,
  });
}

export async function markSocialAnalyticsReauthenticationRequired(organizationId: string, brandId: string, socialProfileId: string) {
  const database = getDatabase();
  await database.transaction(async (transaction) => {
    const [profile] = await transaction.update(socialProfiles).set({ status: "reauth_required", updatedAt: new Date() })
      .where(and(eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.brandId, brandId),
        eq(socialProfiles.id, socialProfileId), eq(socialProfiles.status, "connected")))
      .returning({ platform: socialProfiles.platform });
    if (!profile) return;
    await transaction.insert(socialConnectionEvents).values({
      organizationId, brandId, socialProfileId, actorUserId: null,
      platform: profile.platform, eventType: SOCIAL_CONNECTION_EVENT.reauthRequired,
    });
  });
}

export async function getLatestMetaAnalytics(organizationId: string, input: { start: Date; end: Date; brandId?: string; platform?: SocialPlatform }) {
  const conditions = [
    eq(socialAnalyticsSnapshots.organizationId, organizationId),
    gte(socialPublicationJobs.scheduledAt, input.start),
    lte(socialPublicationJobs.scheduledAt, input.end),
  ];
  if (input.brandId) conditions.push(eq(socialAnalyticsSnapshots.brandId, input.brandId));
  if (input.platform) conditions.push(eq(socialProfiles.platform, input.platform));
  const latest = await getDatabase().selectDistinctOn([socialAnalyticsSnapshots.publicationJobId], {
    jobId: socialPublicationJobs.id,
    title: contentItems.title,
    brandName: brands.name,
    platform: socialProfiles.platform,
    scheduledAt: socialPublicationJobs.scheduledAt,
    collectionStatus: socialAnalyticsSnapshots.collectionStatus,
    likes: socialAnalyticsSnapshots.likes, comments: socialAnalyticsSnapshots.comments, shares: socialAnalyticsSnapshots.shares,
    collectedAt: socialAnalyticsSnapshots.collectedAt,
    definitionVersion: socialAnalyticsSnapshots.definitionVersion,
    coverage: socialAnalyticsSnapshots.coverage,
  }).from(socialAnalyticsSnapshots)
    .innerJoin(socialPublicationJobs, and(
      eq(socialPublicationJobs.organizationId, socialAnalyticsSnapshots.organizationId),
      eq(socialPublicationJobs.id, socialAnalyticsSnapshots.publicationJobId),
      eq(socialPublicationJobs.brandId, socialAnalyticsSnapshots.brandId),
    ))
    .innerJoin(contentItems, and(
      eq(contentItems.organizationId, socialPublicationJobs.organizationId),
      eq(contentItems.id, socialPublicationJobs.contentItemId),
      eq(contentItems.brandId, socialPublicationJobs.brandId),
    ))
    .innerJoin(brands, and(
      eq(brands.organizationId, socialPublicationJobs.organizationId),
      eq(brands.id, socialPublicationJobs.brandId),
    ))
    .innerJoin(socialProfiles, and(
      eq(socialProfiles.organizationId, socialAnalyticsSnapshots.organizationId),
      eq(socialProfiles.brandId, socialAnalyticsSnapshots.brandId),
      eq(socialProfiles.id, socialAnalyticsSnapshots.socialProfileId),
    ))
    .where(and(...conditions, inArray(socialProfiles.platform, ["facebook", "instagram"])))
    .orderBy(socialAnalyticsSnapshots.publicationJobId, desc(socialAnalyticsSnapshots.collectedAt));

  type MetaPlatform = "facebook" | "instagram";
  const metaPlatforms: MetaPlatform[] = ["facebook", "instagram"];
  const topPostsByPlatform = new Map<MetaPlatform, Array<{
    jobId: string; title: string; brandName: string; scheduledAt: string;
    likes: number | null; comments: number | null; shares: number | null; interactions: number;
    collectedAt: Date; definitionVersion: string; coverage: string;
  }>>(metaPlatforms.map((platform) => [platform, []]));
  const engagementByPlatform = new Map<MetaPlatform, {
    collectedPosts: number;
    statusCounts: Record<typeof SOCIAL_ANALYTICS_COLLECTION_STATUSES[number], number>;
    metrics: { likes: number; comments: number; shares: number };
    metricsCount: { likes: number; comments: number; shares: number };
    latestCollectedAt: Date | null;
  }>(metaPlatforms.map((platform) => [platform, {
    collectedPosts: 0,
    statusCounts: Object.fromEntries(SOCIAL_ANALYTICS_COLLECTION_STATUSES.map((status) => [status, 0])) as Record<typeof SOCIAL_ANALYTICS_COLLECTION_STATUSES[number], number>,
    metrics: { likes: 0, comments: 0, shares: 0 },
    metricsCount: { likes: 0, comments: 0, shares: 0 },
    latestCollectedAt: null,
  }] as const));
  for (const row of latest) {
    if (row.platform !== "facebook" && row.platform !== "instagram") continue;
    const platformData = engagementByPlatform.get(row.platform);
    if (!platformData) continue;
    platformData.collectedPosts += 1;
    platformData.statusCounts[row.collectionStatus] += 1;
    if (!platformData.latestCollectedAt || row.collectedAt > platformData.latestCollectedAt) platformData.latestCollectedAt = row.collectedAt;
    for (const key of ["likes", "comments", "shares"] as const) {
      if (row[key] !== null) { platformData.metrics[key] += row[key]; platformData.metricsCount[key] += 1; }
    }
    if (row.collectionStatus === "success" && (row.likes !== null || row.comments !== null || row.shares !== null)) {
      topPostsByPlatform.get(row.platform)?.push({
        jobId: row.jobId,
        title: row.title,
        brandName: row.brandName,
        scheduledAt: row.scheduledAt.toISOString(),
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        interactions: (row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0),
        collectedAt: row.collectedAt,
        definitionVersion: row.definitionVersion,
        coverage: row.coverage,
      });
    }
  }

  const publishedConditions = [
    eq(socialPublicationJobs.organizationId, organizationId),
    eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.published),
    isNotNull(socialPublicationJobs.externalPostId),
    gte(socialPublicationJobs.scheduledAt, input.start),
    lte(socialPublicationJobs.scheduledAt, input.end),
    inArray(socialProfiles.platform, ["facebook", "instagram"]),
  ];
  if (input.brandId) publishedConditions.push(eq(socialPublicationJobs.brandId, input.brandId));
  const published = await getDatabase().select({ platform: socialProfiles.platform, total: count() }).from(socialPublicationJobs)
    .innerJoin(socialProfiles, and(
      eq(socialProfiles.organizationId, socialPublicationJobs.organizationId),
      eq(socialProfiles.id, socialPublicationJobs.socialProfileId),
      eq(socialProfiles.brandId, socialPublicationJobs.brandId),
    )).where(and(...publishedConditions)).groupBy(socialProfiles.platform);
  const publishedByPlatform = new Map(published.map((row) => [row.platform, Number(row.total)]));
  const rankedTopPosts = new Map(metaPlatforms.map((platform) => [platform,
    (topPostsByPlatform.get(platform) ?? []).sort((left, right) => right.interactions - left.interactions || right.scheduledAt.localeCompare(left.scheduledAt)).slice(0, 5),
  ]));
  const comparisonPosts = metaPlatforms.flatMap((platform) => rankedTopPosts.get(platform) ?? []);
  const comparisonJobIds = comparisonPosts.map((post) => post.jobId);
  const comparisonSnapshots = comparisonJobIds.length === 0 ? [] : await getDatabase().select({
    jobId: socialAnalyticsSnapshots.publicationJobId,
    likes: socialAnalyticsSnapshots.likes,
    comments: socialAnalyticsSnapshots.comments,
    shares: socialAnalyticsSnapshots.shares,
    collectedAt: socialAnalyticsSnapshots.collectedAt,
    definitionVersion: socialAnalyticsSnapshots.definitionVersion,
    coverage: socialAnalyticsSnapshots.coverage,
  }).from(socialAnalyticsSnapshots).where(and(
    eq(socialAnalyticsSnapshots.organizationId, organizationId),
    inArray(socialAnalyticsSnapshots.publicationJobId, comparisonJobIds),
    eq(socialAnalyticsSnapshots.collectionStatus, "success"),
    gte(socialAnalyticsSnapshots.collectedAt, new Date(Date.now() - SOCIAL_ANALYTICS_FRESHNESS_MILLISECONDS)),
  )).orderBy(desc(socialAnalyticsSnapshots.collectedAt)).limit(SOCIAL_ANALYTICS_LIMITS.maximumComparisonSnapshots);
  const snapshotsByJob = new Map<string, typeof comparisonSnapshots>();
  for (const snapshot of comparisonSnapshots) {
    const entries = snapshotsByJob.get(snapshot.jobId) ?? [];
    entries.push(snapshot);
    snapshotsByJob.set(snapshot.jobId, entries);
  }
  return {
    platforms: SOCIAL_PLATFORMS.filter((platform): platform is MetaPlatform => platform === "facebook" || platform === "instagram").map((platform) => {
      const collected = engagementByPlatform.get(platform);
      if (!collected) return { platform, totalPublished: 0, collectedPosts: 0, statusCounts: Object.fromEntries(SOCIAL_ANALYTICS_COLLECTION_STATUSES.map((status) => [status, 0])), metrics: { likes: null, comments: null, shares: null }, latestCollectedAt: null, topPosts: [] };
      return {
        platform,
        totalPublished: publishedByPlatform.get(platform) ?? 0,
        collectedPosts: collected.collectedPosts,
        statusCounts: collected.statusCounts,
        metrics: {
          likes: collected.metricsCount.likes ? collected.metrics.likes : null,
          comments: collected.metricsCount.comments ? collected.metrics.comments : null,
          shares: collected.metricsCount.shares ? collected.metrics.shares : null,
        },
        latestCollectedAt: collected.latestCollectedAt?.toISOString() ?? null,
        topPosts: (rankedTopPosts.get(platform) ?? []).map((post) => {
          const recentChecks = snapshotsByJob.get(post.jobId) ?? [];
          const previousCheck = recentChecks.find((snapshot) => snapshot.collectedAt < post.collectedAt
            && snapshot.definitionVersion === post.definitionVersion && snapshot.coverage === post.coverage);
          const comparable = previousCheck ? getInteractionsChange(post, previousCheck) : null;
          return {
            jobId: post.jobId,
            title: post.title,
            brandName: post.brandName,
            scheduledAt: post.scheduledAt,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            interactions: post.interactions,
            previousCheckChange: comparable,
            previousCheckAt: comparable === null ? null : previousCheck?.collectedAt.toISOString() ?? null,
          };
        }),
      };
    }),
  };
}
