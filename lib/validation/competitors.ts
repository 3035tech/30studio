import { z } from "zod";
import { COMPETITOR_ALERT_TYPES, COMPETITOR_FETCH_RUN_STATUSES, COMPETITOR_OBSERVATION_ANALYSIS_STATUSES, COMPETITOR_OBSERVATION_DATA_QUALITIES, COMPETITOR_RETRIEVAL_METHODS, COMPETITOR_SOURCE_ERROR_CODES, COMPETITOR_SOURCE_STATUSES, COMPETITOR_TOPIC_KEYS, COMPETITOR_WORKER, COMPETITOR_WORKER_HEALTH_STATUSES } from "@/lib/constants";

export const competitorBrandIdSchema = z.string().uuid();

export const competitorProfileLookupRequestSchema = z.object({
  platform: z.enum(["youtube", "instagram", "facebook", "x"]),
  identifier: z.string().trim().min(1).max(COMPETITOR_WORKER.maximumProfileIdentifierCharacters),
}).strict();

export const competitorProfileLookupResponseSchema = z.object({ data: z.object({
  platform: z.enum(["youtube", "instagram", "facebook", "x"]),
  externalProfileId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  handle: z.string().max(100).nullable(),
  profileUrl: z.url().max(300),
  feedUrl: z.url().max(300).nullable(),
}).strict() }).strict();

export const competitorProfileSourceCreateSchema = z.object({
  platform: z.enum(["youtube", "instagram"]),
  identifier: z.string().trim().min(1).max(COMPETITOR_WORKER.maximumProfileIdentifierCharacters),
}).strict();

export const competitorSourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  feedUrl: z.string().trim().url().max(2048),
  retrievalMethod: z.enum(["rss_atom", "website_crawl"]).optional(),
}).superRefine((input, context) => {
  const url = new URL(input.feedUrl);
  const isWebsite = input.retrievalMethod === "website_crawl";
  const query = [...url.searchParams.entries()];
  const isYouTubeChannelFeed = !isWebsite && url.hostname === "www.youtube.com" && url.pathname === "/feeds/videos.xml"
    && query.length === 1 && query[0]?.[0] === "channel_id" && /^UC[a-zA-Z0-9_-]{22}$/u.test(query[0][1]);
  const isPublicHttpsHost = url.protocol === "https:" && !url.username && !url.password && !url.port
    && !url.hostname.includes(":") && !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(url.hostname)
    && url.hostname.includes(".") && !url.hostname.endsWith(".localhost");
  const validUrl = isWebsite
    ? isPublicHttpsHost && !url.search && !url.hash && (url.pathname === "/" || url.pathname === "")
    : isPublicHttpsHost && (!url.search || isYouTubeChannelFeed);
  if (!validUrl) context.addIssue({ code: "custom", path: ["feedUrl"], message: "INVALID_COMPETITOR_SOURCE_URL" });
}).transform((input) => {
  const url = new URL(input.feedUrl);
  url.hash = "";
  return {
    name: input.name,
    feedUrl: input.retrievalMethod === "website_crawl" ? `${url.origin}/` : url.toString(),
    retrievalMethod: input.retrievalMethod ?? "rss_atom" as const,
  };
});

export const competitorSourceUpdateSchema = z.object({ status: z.enum(COMPETITOR_SOURCE_STATUSES) }).strict();
export const competitorAlertSettingsSchema = z.object({
  enabled: z.boolean(),
  failureThreshold: z.number().int().min(COMPETITOR_WORKER.minimumAlertFailureThreshold).max(COMPETITOR_WORKER.maximumAlertFailureThreshold),
  staleAfterHours: z.number().int().min(COMPETITOR_WORKER.minimumAlertStaleAfterHours).max(COMPETITOR_WORKER.maximumAlertStaleAfterHours),
}).strict();

const competitorObservationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(COMPETITOR_WORKER.maximumTitleCharacters),
  summary: z.string().max(COMPETITOR_WORKER.maximumSummaryCharacters).nullable(),
  sourceUrl: z.string().url().max(2048),
  contentPublishedAt: z.iso.datetime({ offset: true }).nullable(),
  capturedAt: z.iso.datetime({ offset: true }),
  retrievalMethod: z.enum(COMPETITOR_RETRIEVAL_METHODS),
  dataQuality: z.enum(COMPETITOR_OBSERVATION_DATA_QUALITIES),
  analysisStatus: z.enum(COMPETITOR_OBSERVATION_ANALYSIS_STATUSES),
  analysis: z.object({
    topic: z.enum(COMPETITOR_TOPIC_KEYS),
    observedPattern: z.object({ en: z.string().max(COMPETITOR_WORKER.analysisMaximumOutputCharacters), pt: z.string().max(COMPETITOR_WORKER.analysisMaximumOutputCharacters) }),
    editorialOpportunity: z.object({ en: z.string().max(COMPETITOR_WORKER.analysisMaximumOutputCharacters), pt: z.string().max(COMPETITOR_WORKER.analysisMaximumOutputCharacters) }),
  }).nullable(),
});

export const competitorAnalysisItemSchema = z.object({
  observationId: z.string().uuid(),
  topic: z.enum(COMPETITOR_TOPIC_KEYS),
  observedPatternEn: z.string().trim().min(1).max(COMPETITOR_WORKER.analysisMaximumOutputCharacters),
  observedPatternPt: z.string().trim().min(1).max(COMPETITOR_WORKER.analysisMaximumOutputCharacters),
  editorialOpportunityEn: z.string().trim().min(1).max(COMPETITOR_WORKER.analysisMaximumOutputCharacters),
  editorialOpportunityPt: z.string().trim().min(1).max(COMPETITOR_WORKER.analysisMaximumOutputCharacters),
}).strict();

export const competitorAnalysisResponseSchema = z.object({ analyses: z.array(competitorAnalysisItemSchema).max(COMPETITOR_WORKER.analysisBatchSize) }).strict();
export const competitorAnalysisRetryResponseSchema = z.object({ data: z.object({ retried: z.number().int().nonnegative() }).strict() }).strict();

export const competitorSourcesResponseSchema = z.object({ data: z.object({
  sources: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().max(120),
    feedUrl: z.string().url().max(2048),
    retrievalMethod: z.enum(COMPETITOR_RETRIEVAL_METHODS),
    status: z.enum(COMPETITOR_SOURCE_STATUSES),
    lastFetchedAt: z.iso.datetime({ offset: true }).nullable(),
    nextFetchAt: z.iso.datetime({ offset: true }),
    failureCount: z.number().int().nonnegative(),
    newObservationCount: z.number().int().nonnegative(),
    createdAt: z.iso.datetime({ offset: true }),
    hasError: z.boolean(),
    lastErrorCode: z.enum([...Object.values(COMPETITOR_SOURCE_ERROR_CODES), "worker_interrupted"]).nullable(),
    isStale: z.boolean(),
    analysisUnavailableCount: z.number().int().nonnegative(),
    alertReasons: z.array(z.enum(COMPETITOR_ALERT_TYPES)).max(COMPETITOR_ALERT_TYPES.length),
    fetchRuns: z.array(z.object({
      id: z.string().uuid(), status: z.enum(COMPETITOR_FETCH_RUN_STATUSES),
      startedAt: z.iso.datetime({ offset: true }), completedAt: z.iso.datetime({ offset: true }).nullable(),
      newItemCount: z.number().int().nonnegative(), errorCode: z.string().max(80).nullable(),
    })).max(COMPETITOR_WORKER.fetchHistoryLimitPerSource),
    observations: z.array(competitorObservationSchema).max(100),
  })).max(100),
  worker: z.object({ status: z.enum(COMPETITOR_WORKER_HEALTH_STATUSES), lastSeenAt: z.iso.datetime({ offset: true }).nullable() }).strict(),
  coverage: z.object({ total: z.number().int().nonnegative(), pending: z.number().int().nonnegative(), processing: z.number().int().nonnegative(), ready: z.number().int().nonnegative(), unavailable: z.number().int().nonnegative() }).strict(),
  alertSettings: competitorAlertSettingsSchema,
  alerts: z.array(z.object({ sourceId: z.string().uuid(), sourceName: z.string().max(120), type: z.enum(COMPETITOR_ALERT_TYPES), count: z.number().int().positive().nullable() })).max(200),
  trendComparison: z.object({
    windowDays: z.number().int().positive(), currentTotal: z.number().int().nonnegative(), previousTotal: z.number().int().nonnegative(),
    topics: z.array(z.object({ topic: z.enum(COMPETITOR_TOPIC_KEYS), current: z.number().int().nonnegative(), previous: z.number().int().nonnegative() })).max(COMPETITOR_TOPIC_KEYS.length),
  }).strict(),
  features: z.object({ xApiEnabled: z.boolean() }).strict(),
  canManage: z.boolean(),
}) });
