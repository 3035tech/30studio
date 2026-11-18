export const COMPETITOR_SOURCE_STATUSES = ["active", "paused", "archived"] as const;

export const COMPETITOR_SOURCE_STATUS = { active: "active", paused: "paused", archived: "archived" } as const;

export const COMPETITOR_FETCH_RUN_STATUSES = ["running", "succeeded", "failed", "interrupted"] as const;

export const COMPETITOR_FETCH_RUN_STATUS = { running: "running", succeeded: "succeeded", failed: "failed", interrupted: "interrupted" } as const;

export const COMPETITOR_ALERT_TYPES = ["failures", "stale", "new_publications"] as const;

export const COMPETITOR_WORKER_HEALTH_STATUSES = ["healthy", "stale", "unknown"] as const;

export const COMPETITOR_WORKER_HEALTH_STATUS = { healthy: "healthy", stale: "stale", unknown: "unknown" } as const;

export const COMPETITOR_OBSERVATION_DATA_QUALITIES = ["metadata_only"] as const;

export const COMPETITOR_RETRIEVAL_METHODS = ["rss_atom", "instagram_graph", "facebook_graph", "website_crawl", "x_api"] as const;

export const COMPETITOR_FEATURES = { xApi: process.env.X_COMPETITOR_RESEARCH_ENABLED === "true" } as const;

export const COMPETITOR_OBSERVATION_ANALYSIS_STATUSES = ["pending", "processing", "ready", "unavailable"] as const;

export const COMPETITOR_OBSERVATION_ANALYSIS_STATUS = { pending: "pending", processing: "processing", ready: "ready", unavailable: "unavailable" } as const;

export const COMPETITOR_TOPIC_KEYS = ["product_news", "education", "customer_story", "promotion", "event", "industry_news", "opinion", "other"] as const;

export const COMPETITOR_SOURCE_ERROR_CODES = {
  invalidUrl: "invalid_source_url",
  blockedAddress: "blocked_source_address",
  requestFailed: "source_request_failed",
  responseTooLarge: "source_response_too_large",
  unsupportedContentType: "source_content_type_unsupported",
  invalidFeed: "source_feed_invalid",
  httpFailure: "source_http_failure",
  analysisUnavailable: "analysis_unavailable",
  analysisProviderFailed: "analysis_provider_failed",
  analysisOutputInvalid: "analysis_output_invalid",
  socialConnectionRequired: "social_connection_required",
  socialPermissionRequired: "social_permission_required",
  xApiDisabled: "x_api_disabled",
  siteRobotsBlocked: "site_robots_blocked",
  siteSitemapUnavailable: "site_sitemap_unavailable",
  siteContentUnsupported: "site_content_unsupported",
  workerInterrupted: "worker_interrupted",
} as const;

export const COMPETITOR_WORKER = {
  pollIntervalMilliseconds: 10_000,
  leaseMilliseconds: 120_000,
  pollIntervalMinutes: 60,
  maximumFeedBytes: 1_000_000,
  maximumWebsitePagesPerFetch: 5,
  maximumWebsiteSitemapsPerFetch: 2,
  maximumWebsitePagesPerSitemap: 100,
  recentPublicationAlertHours: 24,
  trendWindowDays: 30,
  maximumEntriesPerFetch: 50,
  maximumTitleCharacters: 300,
  maximumSummaryCharacters: 1_500,
  requestTimeoutMilliseconds: 10_000,
  retryDelayMinutes: [5, 30, 120, 360] as const,
  maximumSourcesPerBrand: 25,
  maximumProfileIdentifierCharacters: 300,
  profileLookupTimeoutMilliseconds: 8_000,
  analysisBatchSize: 10,
  analysisMaximumAttempts: 3,
  analysisLeaseMilliseconds: 120_000,
  analysisWindowDays: 30,
  analysisMaximumInputCharacters: 1_000,
  analysisMaximumOutputCharacters: 320,
  analysisMaximumOutputTokens: 1_800,
  analysisTimeoutMilliseconds: 25_000,
  analysisRetryDelayMinutes: [5, 30] as const,
  heartbeatIntervalMilliseconds: 15_000,
  heartbeatStaleMilliseconds: 90_000,
  fetchHistoryLimitPerSource: 8,
  fetchHistoryRetentionPerSource: 50,
  fetchHistoryPruneBatch: 1_000,
  heartbeatKey: "competitor-research",
  defaultAlertFailureThreshold: 3,
  minimumAlertFailureThreshold: 1,
  maximumAlertFailureThreshold: 10,
  defaultAlertStaleAfterHours: 36,
  minimumAlertStaleAfterHours: 6,
  maximumAlertStaleAfterHours: 336,
} as const;
