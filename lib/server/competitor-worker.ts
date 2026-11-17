import { COMPETITOR_FEATURES, COMPETITOR_SOURCE_ERROR_CODES, COMPETITOR_WORKER } from "@/lib/constants";
import { claimCompetitorAnalysisBatch, claimDueCompetitorSource, completeCompetitorAnalysis, completeCompetitorFetch, failCompetitorAnalysis, failCompetitorFetch, getCompetitorFacebookPageId, recordCompetitorWorkerHeartbeat } from "@/lib/db/repositories/competitors";
import { analyzeCompetitorObservations, CompetitorAnalysisError } from "@/lib/server/competitor-analysis";
import { collectCompetitorFeed, CompetitorFeedError } from "@/lib/server/competitor-feed";
import { InstagramCompetitorError, lookupInstagramCompetitor } from "@/lib/server/competitor-instagram";
import { FacebookCompetitorError, lookupFacebookCompetitor } from "@/lib/server/competitor-facebook";
import { collectCompetitorWebsite } from "@/lib/server/competitor-website";
import { collectXCompetitorPosts, XCompetitorError } from "@/lib/server/competitor-x";
import { getValidSocialAccessToken } from "@/lib/server/social-access-token";
import type { CompetitorFeedItem } from "@/lib/db/repositories/competitors";
import { logOperationalError } from "@/lib/server/operational-logger";

async function processDueSource() {
  const source = await claimDueCompetitorSource();
  if (!source) return false;
  try {
    let items: CompetitorFeedItem[];
    let etag: string | null = null;
    let lastModified: string | null = null;
    if (source.retrievalMethod === "instagram_graph") {
      const token = source.socialProfileId ? await getValidSocialAccessToken(source.organizationId, source.socialProfileId) : null;
      if (!token) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.socialConnectionRequired);
      const pageId = source.socialProfileId ? await getCompetitorFacebookPageId(source.organizationId, source.brandId, source.socialProfileId) : null;
      if (!pageId) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.socialConnectionRequired);
      const result = await lookupInstagramCompetitor(token, pageId, source.externalProfileId ?? "");
      items = result.items;
    } else if (source.retrievalMethod === "facebook_graph") {
      const token = source.socialProfileId ? await getValidSocialAccessToken(source.organizationId, source.socialProfileId) : null;
      if (!token) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.socialConnectionRequired);
      const result = await lookupFacebookCompetitor(token, source.externalProfileId ?? "", true);
      items = result.items;
    } else if (source.retrievalMethod === "x_api") {
      if (!COMPETITOR_FEATURES.xApi) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.xApiDisabled);
      const token = source.socialProfileId ? await getValidSocialAccessToken(source.organizationId, source.socialProfileId) : null;
      if (!token) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.socialConnectionRequired);
      items = await collectXCompetitorPosts(token, source.externalProfileId ?? "", source.feedUrl);
    } else if (source.retrievalMethod === "website_crawl") {
      items = await collectCompetitorWebsite({ websiteUrl: source.feedUrl });
    } else {
      const feedResult = await collectCompetitorFeed({ feedUrl: source.feedUrl, etag: source.etag, lastModified: source.lastModified });
      items = feedResult.kind === "updated" ? feedResult.items : [];
      etag = feedResult.etag;
      lastModified = feedResult.lastModified;
    }
    await completeCompetitorFetch(source, items, { etag, lastModified });
  } catch (error) {
    const errorCode = error instanceof CompetitorFeedError ? error.code
      : error instanceof InstagramCompetitorError && error.code === "connection_required" ? COMPETITOR_SOURCE_ERROR_CODES.socialConnectionRequired
        : error instanceof InstagramCompetitorError && error.code === "permission_required" ? COMPETITOR_SOURCE_ERROR_CODES.socialPermissionRequired
          : error instanceof FacebookCompetitorError && error.code === "connection_required" ? COMPETITOR_SOURCE_ERROR_CODES.socialConnectionRequired
            : error instanceof FacebookCompetitorError && error.code === "permission_required" ? COMPETITOR_SOURCE_ERROR_CODES.socialPermissionRequired
            : error instanceof XCompetitorError && error.code === "connection_required" ? COMPETITOR_SOURCE_ERROR_CODES.socialConnectionRequired
              : error instanceof XCompetitorError && error.code === "permission_required" ? COMPETITOR_SOURCE_ERROR_CODES.socialPermissionRequired
              : COMPETITOR_SOURCE_ERROR_CODES.requestFailed;
    logOperationalError("worker.competitor.fetch_failed", error, {
      organizationId: source.organizationId,
      brandId: source.brandId,
      sourceId: source.id,
      failureCode: errorCode,
    });
    await failCompetitorFetch(source, errorCode);
  }
  return true;
}

async function processDueAnalysis() {
  const jobs = await claimCompetitorAnalysisBatch();
  if (jobs.length === 0) return false;
  const first = jobs[0];
  if (!first) return false;
  try {
    const result = await analyzeCompetitorObservations({
      brand: { name: first.brandName, industry: first.industry },
      observations: jobs.map(({ id, title, summary, sourceUrl, contentPublishedAt }) => ({ id, title, summary, sourceUrl, contentPublishedAt })),
    });
    if (!result) {
      await failCompetitorAnalysis(jobs, COMPETITOR_SOURCE_ERROR_CODES.analysisUnavailable, true);
      return true;
    }
    await completeCompetitorAnalysis(jobs, result.model, result.analyses);
  } catch (error) {
    const errorCode = error instanceof CompetitorAnalysisError ? error.code : COMPETITOR_SOURCE_ERROR_CODES.analysisProviderFailed;
    logOperationalError("worker.competitor.analysis_failed", error, {
      organizationId: first.organizationId,
      brandId: first.brandId,
      jobCount: jobs.length,
      failureCode: errorCode,
    });
    await failCompetitorAnalysis(jobs, errorCode);
  }
  return true;
}

export async function runCompetitorWorker(shouldStop: () => boolean, waitForNextJob: () => Promise<void>) {
  let lastHeartbeatAt = 0;
  while (!shouldStop()) {
    if (Date.now() - lastHeartbeatAt >= COMPETITOR_WORKER.heartbeatIntervalMilliseconds) {
      await recordCompetitorWorkerHeartbeat();
      lastHeartbeatAt = Date.now();
    }
    const found = await processDueSource();
    if (!found && !(await processDueAnalysis())) await waitForNextJob();
  }
}

export const competitorWorkerPollIntervalMilliseconds = COMPETITOR_WORKER.pollIntervalMilliseconds;
