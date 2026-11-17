import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { COMPETITOR_FEATURES, COMPETITOR_FETCH_RUN_STATUS, COMPETITOR_OBSERVATION_ANALYSIS_STATUS, COMPETITOR_SOURCE_ERROR_CODES, COMPETITOR_SOURCE_STATUS, COMPETITOR_TOPIC_KEYS, COMPETITOR_WORKER, COMPETITOR_WORKER_HEALTH_STATUS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brands, competitorAlertSettings, competitorFetchRuns, competitorObservations, competitorSources, competitorWorkerHeartbeat, socialProfileCredentials, socialProfiles } from "@/lib/db/schema";
import type { competitorAnalysisItemSchema } from "@/lib/validation/competitors";
import type { z } from "zod";

export type CompetitorFeedItem = {
  externalId: string;
  title: string;
  summary: string | null;
  sourceUrl: string;
  contentPublishedAt: Date | null;
};

export type CompetitorAnalysisJob = {
  organizationId: string;
  brandId: string;
  id: string;
  title: string;
  summary: string | null;
  sourceUrl: string;
  contentPublishedAt: Date | null;
  analysisAttemptCount: number;
  analysisLockedAt: Date;
  brandName: string;
  industry: string | null;
};

export async function listCompetitorSources(organizationId: string, brandId: string) {
  const database = getDatabase();
  const [brand] = await database.select({ id: brands.id }).from(brands).where(and(
    eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true),
  )).limit(1);
  if (!brand) return null;

  const [savedAlertSettings] = await database.select().from(competitorAlertSettings).where(and(
    eq(competitorAlertSettings.organizationId, organizationId), eq(competitorAlertSettings.brandId, brandId),
  )).limit(1);
  const alertSettings = {
    enabled: savedAlertSettings?.enabled ?? true,
    failureThreshold: savedAlertSettings?.failureThreshold ?? COMPETITOR_WORKER.defaultAlertFailureThreshold,
    staleAfterHours: savedAlertSettings?.staleAfterHours ?? COMPETITOR_WORKER.defaultAlertStaleAfterHours,
  };
  const sources = await database.select({
    id: competitorSources.id, name: competitorSources.name, feedUrl: competitorSources.feedUrl,
    retrievalMethod: competitorSources.retrievalMethod,
    status: competitorSources.status, lastFetchedAt: competitorSources.lastFetchedAt,
    nextFetchAt: competitorSources.nextFetchAt, failureCount: competitorSources.failureCount,
    createdAt: competitorSources.createdAt,
    lastErrorCode: competitorSources.lastErrorCode,
    hasError: sql<boolean>`${competitorSources.lastErrorCode} is not null`,
  }).from(competitorSources).where(and(
    eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId),
  )).orderBy(asc(competitorSources.name)).limit(100);
  const [worker] = await database.select({ lastSeenAt: competitorWorkerHeartbeat.lastSeenAt }).from(competitorWorkerHeartbeat)
    .where(eq(competitorWorkerHeartbeat.workerKey, COMPETITOR_WORKER.heartbeatKey)).limit(1);
  const now = new Date();
  const recentPublicationSince = new Date(now.getTime() - COMPETITOR_WORKER.recentPublicationAlertHours * 60 * 60_000);
  const currentTrendStart = new Date(now.getTime() - COMPETITOR_WORKER.trendWindowDays * 24 * 60 * 60_000);
  const previousTrendStart = new Date(now.getTime() - COMPETITOR_WORKER.trendWindowDays * 2 * 24 * 60 * 60_000);
  const workerLastSeenAt = worker?.lastSeenAt ?? null;
  const workerStatus = workerLastSeenAt
    ? now.getTime() - workerLastSeenAt.getTime() <= COMPETITOR_WORKER.heartbeatStaleMilliseconds ? COMPETITOR_WORKER_HEALTH_STATUS.healthy : COMPETITOR_WORKER_HEALTH_STATUS.stale
    : COMPETITOR_WORKER_HEALTH_STATUS.unknown;
  if (sources.length === 0) return {
    sources: [], worker: { status: workerStatus, lastSeenAt: workerLastSeenAt?.toISOString() ?? null },
    features: { xApiEnabled: COMPETITOR_FEATURES.xApi },
    coverage: { total: 0, pending: 0, processing: 0, ready: 0, unavailable: 0 }, alertSettings, alerts: [],
    trendComparison: { windowDays: COMPETITOR_WORKER.trendWindowDays, currentTotal: 0, previousTotal: 0, topics: [] },
  };

  const recentCounts = await database.select({ sourceId: competitorObservations.sourceId, total: count() }).from(competitorObservations).where(and(
    eq(competitorObservations.organizationId, organizationId), eq(competitorObservations.brandId, brandId),
    inArray(competitorObservations.sourceId, sources.map((source) => source.id)), gte(competitorObservations.capturedAt, recentPublicationSince),
  )).groupBy(competitorObservations.sourceId);
  const recentCountBySource = new Map(recentCounts.map((item) => [item.sourceId, Number(item.total)]));
  const currentTopicCounts = await database.select({ topic: competitorObservations.topic, total: count() }).from(competitorObservations).where(and(
    eq(competitorObservations.organizationId, organizationId), eq(competitorObservations.brandId, brandId),
    gte(competitorObservations.contentPublishedAt, currentTrendStart), lt(competitorObservations.contentPublishedAt, now),
    isNotNull(competitorObservations.topic),
  )).groupBy(competitorObservations.topic);
  const previousTopicCounts = await database.select({ topic: competitorObservations.topic, total: count() }).from(competitorObservations).where(and(
    eq(competitorObservations.organizationId, organizationId), eq(competitorObservations.brandId, brandId),
    gte(competitorObservations.contentPublishedAt, previousTrendStart), lt(competitorObservations.contentPublishedAt, currentTrendStart),
    isNotNull(competitorObservations.topic),
  )).groupBy(competitorObservations.topic);
  const currentTopicByKey = new Map(currentTopicCounts.flatMap((item) => item.topic ? [[item.topic, Number(item.total)] as const] : []));
  const previousTopicByKey = new Map(previousTopicCounts.flatMap((item) => item.topic ? [[item.topic, Number(item.total)] as const] : []));
  const trendTopics = COMPETITOR_TOPIC_KEYS.map((topic) => ({ topic, current: currentTopicByKey.get(topic) ?? 0, previous: previousTopicByKey.get(topic) ?? 0 }))
    .filter((topic) => topic.current > 0 || topic.previous > 0)
    .sort((left, right) => right.current - left.current || right.previous - left.previous);
  const trendComparison = {
    windowDays: COMPETITOR_WORKER.trendWindowDays,
    currentTotal: trendTopics.reduce((total, item) => total + item.current, 0),
    previousTotal: trendTopics.reduce((total, item) => total + item.previous, 0),
    topics: trendTopics,
  };

  const observations = await database.select({
    id: competitorObservations.id, sourceId: competitorObservations.sourceId,
    title: competitorObservations.title, summary: competitorObservations.summary,
    sourceUrl: competitorObservations.sourceUrl, contentPublishedAt: competitorObservations.contentPublishedAt,
    capturedAt: competitorObservations.capturedAt, retrievalMethod: competitorObservations.retrievalMethod,
    dataQuality: competitorObservations.dataQuality,
    analysisStatus: competitorObservations.analysisStatus,
    topic: competitorObservations.topic,
    observedPatternEn: competitorObservations.observedPatternEn,
    observedPatternPt: competitorObservations.observedPatternPt,
    editorialOpportunityEn: competitorObservations.editorialOpportunityEn,
    editorialOpportunityPt: competitorObservations.editorialOpportunityPt,
  }).from(competitorObservations).where(and(
    eq(competitorObservations.organizationId, organizationId),
    eq(competitorObservations.brandId, brandId),
    inArray(competitorObservations.sourceId, sources.map((source) => source.id)),
  )).orderBy(desc(competitorObservations.capturedAt)).limit(100);
  const unavailableCounts = await database.select({ sourceId: competitorObservations.sourceId, total: count() }).from(competitorObservations).where(and(
    eq(competitorObservations.organizationId, organizationId), eq(competitorObservations.brandId, brandId),
    inArray(competitorObservations.sourceId, sources.map((source) => source.id)),
    eq(competitorObservations.analysisStatus, COMPETITOR_OBSERVATION_ANALYSIS_STATUS.unavailable),
  )).groupBy(competitorObservations.sourceId);
  const unavailableBySource = new Map(unavailableCounts.map((item) => [item.sourceId, Number(item.total)]));
  const analysisCounts = await database.select({ status: competitorObservations.analysisStatus, total: count() }).from(competitorObservations).where(and(
    eq(competitorObservations.organizationId, organizationId), eq(competitorObservations.brandId, brandId),
  )).groupBy(competitorObservations.analysisStatus);
  const coverageCounts = new Map(analysisCounts.map((item) => [item.status, Number(item.total)]));
  const rankedRuns = database.select({
    id: competitorFetchRuns.id, sourceId: competitorFetchRuns.sourceId, status: competitorFetchRuns.status,
    startedAt: competitorFetchRuns.startedAt, completedAt: competitorFetchRuns.completedAt,
    newItemCount: competitorFetchRuns.newItemCount, errorCode: competitorFetchRuns.errorCode,
    rowNumber: sql<number>`row_number() over (partition by ${competitorFetchRuns.sourceId} order by ${competitorFetchRuns.startedAt} desc)`.as("row_number"),
  }).from(competitorFetchRuns).where(and(
    eq(competitorFetchRuns.organizationId, organizationId), eq(competitorFetchRuns.brandId, brandId),
    inArray(competitorFetchRuns.sourceId, sources.map((source) => source.id)),
  )).as("ranked_competitor_runs");
  const runs = await database.select().from(rankedRuns).where(lte(rankedRuns.rowNumber, COMPETITOR_WORKER.fetchHistoryLimitPerSource));
  const runsBySource = new Map<string, typeof runs>();
  for (const run of runs) {
    const current = runsBySource.get(run.sourceId) ?? [];
    current.push(run);
    runsBySource.set(run.sourceId, current);
  }
  const observationsBySource = new Map<string, typeof observations>();
  for (const observation of observations) {
    const current = observationsBySource.get(observation.sourceId) ?? [];
    current.push(observation);
    observationsBySource.set(observation.sourceId, current);
  }
  const resultSources = sources.map((source) => ({
    ...source,
    newObservationCount: recentCountBySource.get(source.id) ?? 0,
    lastFetchedAt: source.lastFetchedAt?.toISOString() ?? null,
    nextFetchAt: source.nextFetchAt.toISOString(),
    createdAt: source.createdAt.toISOString(),
    analysisUnavailableCount: unavailableBySource.get(source.id) ?? 0,
    lastErrorCode: source.lastErrorCode,
    fetchRuns: (runsBySource.get(source.id) ?? []).map((run) => ({
      ...run, startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null,
    })),
    isStale: (source.lastFetchedAt ?? source.createdAt).getTime() < now.getTime() - alertSettings.staleAfterHours * 60 * 60_000,
    alertReasons: alertSettings.enabled && source.status === COMPETITOR_SOURCE_STATUS.active
      ? [
          ...(source.failureCount >= alertSettings.failureThreshold ? ["failures" as const] : []),
          ...((source.lastFetchedAt ?? source.createdAt).getTime() < now.getTime() - alertSettings.staleAfterHours * 60 * 60_000 ? ["stale" as const] : []),
          ...((recentCountBySource.get(source.id) ?? 0) > 0 ? ["new_publications" as const] : []),
        ]
      : [],
    observations: (observationsBySource.get(source.id) ?? []).map((item) => ({
      ...item,
      contentPublishedAt: item.contentPublishedAt?.toISOString() ?? null,
      capturedAt: item.capturedAt.toISOString(),
      analysis: item.analysisStatus === COMPETITOR_OBSERVATION_ANALYSIS_STATUS.ready && item.topic
        && item.observedPatternEn && item.observedPatternPt && item.editorialOpportunityEn && item.editorialOpportunityPt
        ? {
            topic: item.topic,
            observedPattern: { en: item.observedPatternEn, pt: item.observedPatternPt },
            editorialOpportunity: { en: item.editorialOpportunityEn, pt: item.editorialOpportunityPt },
          }
        : null,
    })),
  }));
  return {
    sources: resultSources,
    features: { xApiEnabled: COMPETITOR_FEATURES.xApi },
    worker: { status: workerStatus, lastSeenAt: workerLastSeenAt?.toISOString() ?? null },
    coverage: {
      total: [...coverageCounts.values()].reduce((sum, value) => sum + value, 0),
      pending: coverageCounts.get(COMPETITOR_OBSERVATION_ANALYSIS_STATUS.pending) ?? 0,
      processing: coverageCounts.get(COMPETITOR_OBSERVATION_ANALYSIS_STATUS.processing) ?? 0,
      ready: coverageCounts.get(COMPETITOR_OBSERVATION_ANALYSIS_STATUS.ready) ?? 0,
      unavailable: coverageCounts.get(COMPETITOR_OBSERVATION_ANALYSIS_STATUS.unavailable) ?? 0,
    },
    alertSettings,
    alerts: resultSources.flatMap((source) => source.alertReasons.map((type) => ({ sourceId: source.id, sourceName: source.name, type, count: type === "new_publications" ? source.newObservationCount : null }))),
    trendComparison,
  };
}

export async function retryCompetitorSourceNow(organizationId: string, brandId: string, sourceId: string) {
  const now = new Date();
  return getDatabase().transaction(async (transaction) => {
    const [source] = await transaction.select({ status: competitorSources.status, lockedAt: competitorSources.lockedAt }).from(competitorSources).innerJoin(brands, and(
      eq(brands.organizationId, competitorSources.organizationId), eq(brands.id, competitorSources.brandId), eq(brands.isActive, true),
    )).where(and(
      eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId), eq(competitorSources.id, sourceId),
    )).for("update", { of: competitorSources }).limit(1);
    if (!source) return "not_found" as const;
    if (source.status !== COMPETITOR_SOURCE_STATUS.active) return "inactive" as const;
    if (source.lockedAt) return "running" as const;
    await transaction.update(competitorSources).set({ nextFetchAt: now, failureCount: 0, lastErrorCode: null, updatedAt: now }).where(and(
      eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId),
      eq(competitorSources.id, sourceId), eq(competitorSources.status, COMPETITOR_SOURCE_STATUS.active), isNull(competitorSources.lockedAt),
    ));
    return "queued" as const;
  });
}

export async function updateCompetitorAlertSettings(organizationId: string, brandId: string, updatedBy: string, input: { enabled: boolean; failureThreshold: number; staleAfterHours: number }) {
  const database = getDatabase();
  const [brand] = await database.select({ id: brands.id }).from(brands).where(and(
    eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true),
  )).limit(1);
  if (!brand) return false;
  await database.insert(competitorAlertSettings).values({ organizationId, brandId, updatedBy, ...input, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [competitorAlertSettings.organizationId, competitorAlertSettings.brandId], set: { ...input, updatedBy, updatedAt: new Date() } });
  return true;
}

export async function recordCompetitorWorkerHeartbeat() {
  const now = new Date();
  await getDatabase().insert(competitorWorkerHeartbeat).values({ workerKey: COMPETITOR_WORKER.heartbeatKey, lastSeenAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: competitorWorkerHeartbeat.workerKey, set: { lastSeenAt: now, updatedAt: now } });
}

export async function claimCompetitorAnalysisBatch(): Promise<CompetitorAnalysisJob[]> {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const now = new Date();
    const expiredLease = new Date(now.getTime() - COMPETITOR_WORKER.analysisLeaseMilliseconds);
    const dueAnalysis = or(
      and(eq(competitorObservations.analysisStatus, COMPETITOR_OBSERVATION_ANALYSIS_STATUS.pending), lte(competitorObservations.analysisNextAttemptAt, now)),
      and(eq(competitorObservations.analysisStatus, COMPETITOR_OBSERVATION_ANALYSIS_STATUS.processing), or(isNull(competitorObservations.analysisLockedAt), lte(competitorObservations.analysisLockedAt, expiredLease))),
    );
    const [anchor] = await transaction.select({ organizationId: competitorObservations.organizationId, brandId: competitorObservations.brandId })
      .from(competitorObservations).innerJoin(brands, and(
        eq(brands.organizationId, competitorObservations.organizationId), eq(brands.id, competitorObservations.brandId), eq(brands.isActive, true),
      )).where(dueAnalysis).orderBy(asc(competitorObservations.analysisNextAttemptAt), asc(competitorObservations.capturedAt))
      .for("update", { skipLocked: true }).limit(1);
    if (!anchor) return [];
    const rows = await transaction.select({
      organizationId: competitorObservations.organizationId,
      brandId: competitorObservations.brandId,
      id: competitorObservations.id,
      title: competitorObservations.title,
      summary: competitorObservations.summary,
      sourceUrl: competitorObservations.sourceUrl,
      contentPublishedAt: competitorObservations.contentPublishedAt,
      analysisAttemptCount: competitorObservations.analysisAttemptCount,
      brandName: brands.name,
      industry: brands.industry,
    }).from(competitorObservations).innerJoin(brands, and(
      eq(brands.organizationId, competitorObservations.organizationId), eq(brands.id, competitorObservations.brandId), eq(brands.isActive, true),
    )).where(and(
      eq(competitorObservations.organizationId, anchor.organizationId),
      eq(competitorObservations.brandId, anchor.brandId),
      dueAnalysis,
    )).orderBy(asc(competitorObservations.analysisNextAttemptAt), asc(competitorObservations.capturedAt))
      .for("update", { skipLocked: true }).limit(COMPETITOR_WORKER.analysisBatchSize);
    const lockedAt = new Date();
    for (const row of rows) {
      await transaction.update(competitorObservations).set({
        analysisStatus: COMPETITOR_OBSERVATION_ANALYSIS_STATUS.processing,
        analysisLockedAt: lockedAt,
        analysisAttemptCount: row.analysisAttemptCount + 1,
      }).where(and(
        eq(competitorObservations.organizationId, row.organizationId),
        eq(competitorObservations.brandId, row.brandId),
        eq(competitorObservations.id, row.id),
      ));
    }
    return rows.map((row) => ({ ...row, analysisAttemptCount: row.analysisAttemptCount + 1, analysisLockedAt: lockedAt }));
  });
}

type CompetitorAnalysisItem = z.infer<typeof competitorAnalysisItemSchema>;

export async function completeCompetitorAnalysis(jobs: CompetitorAnalysisJob[], model: string, analyses: CompetitorAnalysisItem[]) {
  await getDatabase().transaction(async (transaction) => {
    const first = jobs[0];
    if (!first) return;
    const [brand] = await transaction.select({ id: brands.id }).from(brands).where(and(
      eq(brands.organizationId, first.organizationId), eq(brands.id, first.brandId), eq(brands.isActive, true),
    )).limit(1);
    if (!brand) return;
    for (const job of jobs) {
      const analysis = analyses.find((item) => item.observationId === job.id);
      if (!analysis) continue;
      await transaction.update(competitorObservations).set({
        analysisStatus: COMPETITOR_OBSERVATION_ANALYSIS_STATUS.ready,
        analysisLockedAt: null,
        analysisErrorCode: null,
        analysisModel: model,
        topic: analysis.topic,
        observedPatternEn: analysis.observedPatternEn,
        observedPatternPt: analysis.observedPatternPt,
        editorialOpportunityEn: analysis.editorialOpportunityEn,
        editorialOpportunityPt: analysis.editorialOpportunityPt,
      }).where(and(
        eq(competitorObservations.organizationId, job.organizationId),
        eq(competitorObservations.brandId, job.brandId),
        eq(competitorObservations.id, job.id),
        eq(competitorObservations.analysisStatus, COMPETITOR_OBSERVATION_ANALYSIS_STATUS.processing),
        eq(competitorObservations.analysisLockedAt, job.analysisLockedAt),
      ));
    }
  });
}

export async function failCompetitorAnalysis(jobs: CompetitorAnalysisJob[], errorCode: string, permanent = false) {
  const database = getDatabase();
  await database.transaction(async (transaction) => {
    for (const job of jobs) {
      const exhausted = job.analysisAttemptCount >= COMPETITOR_WORKER.analysisMaximumAttempts;
      const unavailable = permanent || exhausted;
      const retryIndex = Math.min(Math.max(0, job.analysisAttemptCount - 1), COMPETITOR_WORKER.analysisRetryDelayMinutes.length - 1);
      const retryDelay = COMPETITOR_WORKER.analysisRetryDelayMinutes[retryIndex] ?? 30;
      await transaction.update(competitorObservations).set({
        analysisStatus: unavailable ? COMPETITOR_OBSERVATION_ANALYSIS_STATUS.unavailable : COMPETITOR_OBSERVATION_ANALYSIS_STATUS.pending,
        analysisLockedAt: null,
        analysisErrorCode: errorCode,
        analysisNextAttemptAt: new Date(Date.now() + retryDelay * 60_000),
      }).where(and(
        eq(competitorObservations.organizationId, job.organizationId),
        eq(competitorObservations.brandId, job.brandId),
        eq(competitorObservations.id, job.id),
        eq(competitorObservations.analysisStatus, COMPETITOR_OBSERVATION_ANALYSIS_STATUS.processing),
        eq(competitorObservations.analysisLockedAt, job.analysisLockedAt),
      ));
    }
  });
}

export async function retryUnavailableCompetitorAnalysis(organizationId: string, brandId: string, sourceId: string) {
  const now = new Date();
  const updated = await getDatabase().update(competitorObservations).set({
    analysisStatus: COMPETITOR_OBSERVATION_ANALYSIS_STATUS.pending,
    analysisLockedAt: null,
    analysisNextAttemptAt: now,
    analysisAttemptCount: 0,
    analysisErrorCode: null,
  }).where(and(
    eq(competitorObservations.organizationId, organizationId),
    eq(competitorObservations.brandId, brandId),
    eq(competitorObservations.sourceId, sourceId),
    eq(competitorObservations.analysisStatus, COMPETITOR_OBSERVATION_ANALYSIS_STATUS.unavailable),
  )).returning({ id: competitorObservations.id });
  return updated.length;
}

export async function createCompetitorSource(organizationId: string, brandId: string, createdBy: string, input: { name: string; feedUrl: string; retrievalMethod?: "rss_atom" | "website_crawl" }) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [brand] = await transaction.select({ id: brands.id }).from(brands).where(and(
      eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true),
    )).for("update").limit(1);
    if (!brand) return { kind: "not_found" as const };
    const [duplicate] = await transaction.select({ id: competitorSources.id, status: competitorSources.status }).from(competitorSources).where(and(
      eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId), eq(competitorSources.feedUrl, input.feedUrl),
    )).limit(1);
    if (duplicate && duplicate.status !== COMPETITOR_SOURCE_STATUS.archived) return { kind: "duplicate" as const };
    const [sourceCount] = await transaction.select({ total: count() }).from(competitorSources).where(and(
      eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId),
      inArray(competitorSources.status, [COMPETITOR_SOURCE_STATUS.active, COMPETITOR_SOURCE_STATUS.paused]),
    ));
    if (Number(sourceCount?.total ?? 0) >= COMPETITOR_WORKER.maximumSourcesPerBrand) return { kind: "limit_reached" as const };
    if (duplicate?.status === COMPETITOR_SOURCE_STATUS.archived) {
      await transaction.update(competitorSources).set({
        name: input.name, status: COMPETITOR_SOURCE_STATUS.active, nextFetchAt: new Date(),
        retrievalMethod: input.retrievalMethod ?? "rss_atom", lastErrorCode: null, lockedAt: null, updatedAt: new Date(),
      }).where(and(
        eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId), eq(competitorSources.id, duplicate.id),
      ));
      return { kind: "created" as const, id: duplicate.id };
    }
    const [source] = await transaction.insert(competitorSources).values({
      organizationId, brandId, createdBy, name: input.name, feedUrl: input.feedUrl,
      retrievalMethod: input.retrievalMethod ?? "rss_atom", nextFetchAt: new Date(),
    }).onConflictDoNothing({ target: [competitorSources.organizationId, competitorSources.brandId, competitorSources.feedUrl] })
      .returning({ id: competitorSources.id });
    return source ? { kind: "created" as const, id: source.id } : { kind: "duplicate" as const };
  });
}

export async function getCompetitorLookupContext(organizationId: string, brandId: string, platform: "youtube" | "facebook" | "x" = "youtube") {
  const [row] = await getDatabase().select({
    brandId: brands.id, profileId: socialProfiles.id, externalAccountId: socialProfiles.externalAccountId,
    scopes: socialProfileCredentials.scopes,
  }).from(brands).leftJoin(socialProfiles, and(
    eq(socialProfiles.organizationId, brands.organizationId), eq(socialProfiles.brandId, brands.id),
    eq(socialProfiles.platform, platform), eq(socialProfiles.status, "connected"),
  )).leftJoin(socialProfileCredentials, and(
    eq(socialProfileCredentials.organizationId, socialProfiles.organizationId),
    eq(socialProfileCredentials.socialProfileId, socialProfiles.id),
  )).where(and(eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true))).limit(1);
  return row ? {
    brandExists: true,
    profile: row.profileId && row.scopes ? { id: row.profileId, externalAccountId: row.externalAccountId, scopes: row.scopes } : null,
  } : { brandExists: false, profile: null };
}

export async function listCompetitorLookupProfiles(organizationId: string, brandId: string, platform: "facebook") {
  return getDatabase().select({
    id: socialProfiles.id, externalAccountId: socialProfiles.externalAccountId, scopes: socialProfileCredentials.scopes,
  }).from(socialProfiles).innerJoin(socialProfileCredentials, and(
    eq(socialProfileCredentials.organizationId, socialProfiles.organizationId),
    eq(socialProfileCredentials.socialProfileId, socialProfiles.id),
  )).where(and(
    eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.brandId, brandId),
    eq(socialProfiles.platform, platform), eq(socialProfiles.status, "connected"),
  )).orderBy(asc(socialProfiles.displayName)).limit(25);
}

export async function getCompetitorFacebookPageId(organizationId: string, brandId: string, socialProfileId: string) {
  const [profile] = await getDatabase().select({ externalAccountId: socialProfiles.externalAccountId }).from(socialProfiles).where(and(
    eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.brandId, brandId),
    eq(socialProfiles.id, socialProfileId), eq(socialProfiles.platform, "facebook"), eq(socialProfiles.status, "connected"),
  )).limit(1);
  return profile?.externalAccountId ?? null;
}

export async function createSocialGraphCompetitorSource(organizationId: string, brandId: string, createdBy: string, input: {
  name: string; profileUrl: string; profileIdentifier: string; socialProfileId: string;
  retrievalMethod: "instagram_graph" | "facebook_graph" | "x_api";
}) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [brand] = await transaction.select({ id: brands.id }).from(brands).where(and(
      eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true),
    )).for("update").limit(1);
    if (!brand) return { kind: "not_found" as const };
    const expectedPlatform = input.retrievalMethod === "x_api" ? "x" : "facebook";
    const [profile] = await transaction.select({ id: socialProfiles.id }).from(socialProfiles).where(and(
      eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.brandId, brandId),
      eq(socialProfiles.id, input.socialProfileId), eq(socialProfiles.platform, expectedPlatform), eq(socialProfiles.status, "connected"),
    )).limit(1);
    if (!profile) return { kind: "connection_required" as const };
    const [duplicate] = await transaction.select({ id: competitorSources.id, status: competitorSources.status }).from(competitorSources).where(and(
      eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId), eq(competitorSources.feedUrl, input.profileUrl),
    )).limit(1);
    if (duplicate && duplicate.status !== COMPETITOR_SOURCE_STATUS.archived) return { kind: "duplicate" as const };
    const [sourceCount] = await transaction.select({ total: count() }).from(competitorSources).where(and(
      eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId),
      inArray(competitorSources.status, [COMPETITOR_SOURCE_STATUS.active, COMPETITOR_SOURCE_STATUS.paused]),
    ));
    if (!duplicate && Number(sourceCount?.total ?? 0) >= COMPETITOR_WORKER.maximumSourcesPerBrand) return { kind: "limit_reached" as const };
    if (duplicate?.status === COMPETITOR_SOURCE_STATUS.archived) {
      await transaction.update(competitorSources).set({
        name: input.name, externalProfileId: input.profileIdentifier, socialProfileId: profile.id,
        retrievalMethod: input.retrievalMethod, status: COMPETITOR_SOURCE_STATUS.active,
        nextFetchAt: new Date(), lastErrorCode: null, lockedAt: null, updatedAt: new Date(),
      }).where(and(eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId), eq(competitorSources.id, duplicate.id)));
      return { kind: "created" as const, id: duplicate.id };
    }
    const [source] = await transaction.insert(competitorSources).values({
      organizationId, brandId, createdBy, name: input.name, feedUrl: input.profileUrl,
      externalProfileId: input.profileIdentifier, socialProfileId: profile.id, retrievalMethod: input.retrievalMethod,
      nextFetchAt: new Date(),
    }).onConflictDoNothing({ target: [competitorSources.organizationId, competitorSources.brandId, competitorSources.feedUrl] })
      .returning({ id: competitorSources.id });
    return source ? { kind: "created" as const, id: source.id } : { kind: "duplicate" as const };
  });
}

export async function updateCompetitorSourceStatus(organizationId: string, brandId: string, sourceId: string, status: typeof COMPETITOR_SOURCE_STATUS[keyof typeof COMPETITOR_SOURCE_STATUS]) {
  const now = new Date();
  return getDatabase().transaction(async (transaction) => {
    const [source] = await transaction.update(competitorSources).set({
      ...(status === COMPETITOR_SOURCE_STATUS.active
        ? { status, nextFetchAt: now, failureCount: 0, lastErrorCode: null }
        : { status, lockedAt: null }),
      updatedAt: now,
    }).where(and(
      eq(competitorSources.organizationId, organizationId), eq(competitorSources.brandId, brandId), eq(competitorSources.id, sourceId),
    )).returning({ id: competitorSources.id });
    if (!source) return false;
    if (status !== COMPETITOR_SOURCE_STATUS.active) await transaction.update(competitorFetchRuns).set({
      status: COMPETITOR_FETCH_RUN_STATUS.interrupted, completedAt: now, errorCode: COMPETITOR_SOURCE_ERROR_CODES.workerInterrupted,
    }).where(and(
      eq(competitorFetchRuns.organizationId, organizationId), eq(competitorFetchRuns.brandId, brandId),
      eq(competitorFetchRuns.sourceId, sourceId), eq(competitorFetchRuns.status, COMPETITOR_FETCH_RUN_STATUS.running),
    ));
    return true;
  });
}

export async function claimDueCompetitorSource() {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const now = new Date();
    const expiredLease = new Date(now.getTime() - COMPETITOR_WORKER.leaseMilliseconds);
    const [source] = await transaction.select().from(competitorSources).where(and(
      eq(competitorSources.status, COMPETITOR_SOURCE_STATUS.active),
      lte(competitorSources.nextFetchAt, now),
      or(isNull(competitorSources.lockedAt), lte(competitorSources.lockedAt, expiredLease)),
      inArray(competitorSources.brandId, database.select({ id: brands.id }).from(brands).where(and(
        eq(brands.organizationId, competitorSources.organizationId), eq(brands.isActive, true),
      ))),
    )).orderBy(asc(competitorSources.nextFetchAt)).for("update", { skipLocked: true }).limit(1);
    if (!source) return null;
    await transaction.update(competitorFetchRuns).set({
      status: COMPETITOR_FETCH_RUN_STATUS.interrupted, completedAt: now, errorCode: COMPETITOR_SOURCE_ERROR_CODES.workerInterrupted,
    }).where(and(
      eq(competitorFetchRuns.organizationId, source.organizationId),
      eq(competitorFetchRuns.brandId, source.brandId), eq(competitorFetchRuns.sourceId, source.id),
      eq(competitorFetchRuns.status, COMPETITOR_FETCH_RUN_STATUS.running),
    ));
    const [run] = await transaction.insert(competitorFetchRuns).values({
      organizationId: source.organizationId, brandId: source.brandId, sourceId: source.id, startedAt: now,
    }).returning({ id: competitorFetchRuns.id });
    if (!run) return null;
    const expiredRuns = await transaction.select({ id: competitorFetchRuns.id }).from(competitorFetchRuns).where(and(
      eq(competitorFetchRuns.organizationId, source.organizationId), eq(competitorFetchRuns.brandId, source.brandId),
      eq(competitorFetchRuns.sourceId, source.id),
    )).orderBy(desc(competitorFetchRuns.startedAt)).offset(COMPETITOR_WORKER.fetchHistoryRetentionPerSource).limit(COMPETITOR_WORKER.fetchHistoryPruneBatch);
    if (expiredRuns.length) await transaction.delete(competitorFetchRuns).where(and(
      eq(competitorFetchRuns.organizationId, source.organizationId), eq(competitorFetchRuns.brandId, source.brandId),
      eq(competitorFetchRuns.sourceId, source.id), inArray(competitorFetchRuns.id, expiredRuns.map((item) => item.id)),
    ));
    await transaction.update(competitorSources).set({ lockedAt: now, updatedAt: now }).where(and(
      eq(competitorSources.organizationId, source.organizationId), eq(competitorSources.id, source.id),
      eq(competitorSources.status, COMPETITOR_SOURCE_STATUS.active),
    ));
    return { ...source, lockedAt: now, fetchRunId: run.id };
  });
}

export async function completeCompetitorFetch(source: NonNullable<Awaited<ReturnType<typeof claimDueCompetitorSource>>>, items: CompetitorFeedItem[], headers: { etag: string | null; lastModified: string | null }) {
  const database = getDatabase();
  const now = new Date();
  await database.transaction(async (transaction) => {
    const [currentSource] = await transaction.select({ id: competitorSources.id }).from(competitorSources).innerJoin(brands, and(
      eq(brands.organizationId, competitorSources.organizationId), eq(brands.id, competitorSources.brandId), eq(brands.isActive, true),
    )).where(and(
      eq(competitorSources.organizationId, source.organizationId), eq(competitorSources.brandId, source.brandId),
      eq(competitorSources.id, source.id), eq(competitorSources.status, COMPETITOR_SOURCE_STATUS.active),
      eq(competitorSources.lockedAt, source.lockedAt),
    )).for("update").limit(1);
    if (!currentSource) return;
    let insertedCount = 0;
    if (items.length) {
      const inserted = await transaction.insert(competitorObservations).values(items.map((item) => ({
        organizationId: source.organizationId, brandId: source.brandId, sourceId: source.id,
        externalId: item.externalId, title: item.title, summary: item.summary,
        sourceUrl: item.sourceUrl, contentPublishedAt: item.contentPublishedAt,
        retrievalMethod: source.retrievalMethod, dataQuality: "metadata_only" as const,
      }))).onConflictDoNothing({ target: [competitorObservations.organizationId, competitorObservations.sourceId, competitorObservations.externalId] })
        .returning({ id: competitorObservations.id });
      insertedCount = inserted.length;
    }
    await transaction.update(competitorSources).set({
      lockedAt: null, lastFetchedAt: now, nextFetchAt: new Date(now.getTime() + COMPETITOR_WORKER.pollIntervalMinutes * 60_000),
      failureCount: 0, lastErrorCode: null, etag: headers.etag, lastModified: headers.lastModified, updatedAt: now,
    }).where(and(
      eq(competitorSources.organizationId, source.organizationId), eq(competitorSources.brandId, source.brandId),
      eq(competitorSources.id, source.id), eq(competitorSources.lockedAt, source.lockedAt),
    ));
    await transaction.update(competitorFetchRuns).set({
      status: COMPETITOR_FETCH_RUN_STATUS.succeeded, completedAt: now, newItemCount: insertedCount, errorCode: null,
    }).where(and(
      eq(competitorFetchRuns.organizationId, source.organizationId), eq(competitorFetchRuns.brandId, source.brandId),
      eq(competitorFetchRuns.sourceId, source.id), eq(competitorFetchRuns.id, source.fetchRunId),
      eq(competitorFetchRuns.status, COMPETITOR_FETCH_RUN_STATUS.running),
    ));
  });
}

export async function failCompetitorFetch(source: NonNullable<Awaited<ReturnType<typeof claimDueCompetitorSource>>>, errorCode: string) {
  const nextFailureCount = source.failureCount + 1;
  const retryIndex = Math.min(nextFailureCount - 1, COMPETITOR_WORKER.retryDelayMinutes.length - 1);
  const retryDelay = COMPETITOR_WORKER.retryDelayMinutes[retryIndex] ?? COMPETITOR_WORKER.retryDelayMinutes.at(-1) ?? 360;
  const now = new Date();
  await getDatabase().transaction(async (transaction) => {
    await transaction.update(competitorSources).set({
      lockedAt: null,
      failureCount: nextFailureCount,
      lastErrorCode: errorCode,
      nextFetchAt: new Date(now.getTime() + retryDelay * 60_000),
      updatedAt: now,
    }).where(and(
      eq(competitorSources.organizationId, source.organizationId), eq(competitorSources.brandId, source.brandId),
      eq(competitorSources.id, source.id), eq(competitorSources.lockedAt, source.lockedAt),
    ));
    await transaction.update(competitorFetchRuns).set({
      status: COMPETITOR_FETCH_RUN_STATUS.failed, completedAt: now, errorCode,
    }).where(and(
      eq(competitorFetchRuns.organizationId, source.organizationId), eq(competitorFetchRuns.brandId, source.brandId),
      eq(competitorFetchRuns.sourceId, source.id), eq(competitorFetchRuns.id, source.fetchRunId),
      eq(competitorFetchRuns.status, COMPETITOR_FETCH_RUN_STATUS.running),
    ));
  });
}
