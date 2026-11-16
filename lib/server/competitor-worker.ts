import { COMPETITOR_SOURCE_ERROR_CODES, COMPETITOR_WORKER } from "@/lib/constants";
import { claimCompetitorAnalysisBatch, claimDueCompetitorSource, completeCompetitorAnalysis, completeCompetitorFetch, failCompetitorAnalysis, failCompetitorFetch, recordCompetitorWorkerHeartbeat } from "@/lib/db/repositories/competitors";
import { analyzeCompetitorObservations, CompetitorAnalysisError } from "@/lib/server/competitor-analysis";
import { collectCompetitorFeed, CompetitorFeedError } from "@/lib/server/competitor-feed";

async function processDueSource() {
  const source = await claimDueCompetitorSource();
  if (!source) return false;
  try {
    const result = await collectCompetitorFeed({ feedUrl: source.feedUrl, etag: source.etag, lastModified: source.lastModified });
    await completeCompetitorFetch(source, result.kind === "updated" ? result.items : [], {
      etag: result.etag,
      lastModified: result.lastModified,
    });
  } catch (error) {
    const errorCode = error instanceof CompetitorFeedError ? error.code : COMPETITOR_SOURCE_ERROR_CODES.requestFailed;
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
