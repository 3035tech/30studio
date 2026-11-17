export const PRODUCT = {
  name: "30studio",
  groupName: "Grupo 3035",
} as const;

export const DATABASE_CONNECTION = {
  urlEnvironmentName: "DATABASE_URL",
  directHostEnvironmentName: "DATABASE_DIRECT_HOST",
  sslRootCertificateEnvironmentName: "DATABASE_SSL_ROOT_CERT",
  postgresPort: "5432",
  sslMode: "verify-full",
} as const;

export const WORKSPACE_UI_EVENTS = { createContent: "30studio:create-content", openCalendarItem: "30studio:open-calendar-item", openCalendarList: "30studio:open-calendar-list", openSocialConnections: "30studio:open-social-connections" } as const;
export const WORKSPACE_API_PATHS = { settings: "/api/workspace/settings" } as const;
export const WORKSPACE_LIMITS = { nameCharacters: 100 } as const;
export const WORKSPACE_NOTIFICATION_TYPES = {
  socialConnected: "social_connected",
  socialConnectionFailed: "social_connection_failed",
  approvalRequested: "approval_requested",
  publicationFailed: "publication_failed",
  publicationIndeterminate: "publication_indeterminate",
} as const;
export const WORKSPACE_NOTIFICATION_TYPE_VALUES = ["social_connected", "social_connection_failed", "approval_requested", "publication_failed", "publication_indeterminate"] as const;
export const WORKSPACE_NOTIFICATION_LIMITS = { historyItems: 50 } as const;

export const WORKSPACE_SECTION_IDS = {
  overview: "workspace-overview",
  calendar: "workspace-calendar",
  approvals: "workspace-approvals",
  analytics: "workspace-analytics",
  competitors: "workspace-competitors",
  brands: "workspace-brands",
  connections: "workspace-connections",
  team: "workspace-team",
  profile: "workspace-profile",
} as const;

export const BRAND_ASSETS = {
  logoOnLight: "/brand/logos/logo-default.png",
  logoOnDark: "/brand/logos/logo-light.png",
  icon16: "/brand/icons/icon-16.png",
  icon32: "/brand/icons/icon-32.png",
  icon192: "/brand/icons/icon-192.png",
  icon512: "/brand/icons/icon-512.png",
  appleTouchIcon: "/brand/icons/icon-180.png",
  favicon: "/brand/icons/favicon.ico",
  manifest: "/brand/site.webmanifest",
} as const;

export const LOCALES = ["pt", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt";
export const HTML_LANG: Record<Locale, string> = { pt: "pt-BR", en: "en" };

export const SOCIAL_PLATFORMS = [
  "linkedin",
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "youtube",
  "threads",
  "pinterest",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export const DASHBOARD_FILTERS = { rangeDays: [30, 90] as const, storageKey: "30studio:dashboard-filters" } as const;
export const DASHBOARD_ALERTS = { storageKey: "30studio:dashboard-muted", snoozeMilliseconds: 24 * 60 * 60 * 1_000 } as const;
export const DASHBOARD_GOALS = { minimumMonthlyPublications: 1, maximumMonthlyPublications: 500 } as const;
export type DashboardRangeDays = typeof DASHBOARD_FILTERS.rangeDays[number];
export type DashboardFilters = { brandId: string; platform: SocialPlatform | ""; rangeDays: DashboardRangeDays };
export const SOCIAL_PROFILE_STATUSES = ["not_connected", "pending", "connected", "reauth_required", "disabled"] as const;
export type SocialProfileStatus = (typeof SOCIAL_PROFILE_STATUSES)[number];
export const SOCIAL_PROFILE_STATUS = { notConnected: "not_connected", pending: "pending", connected: "connected", reauthRequired: "reauth_required", disabled: "disabled" } as const;
export const SOCIAL_CONNECTION = {
  oauthStateLifetimeMilliseconds: 10 * 60 * 1_000,
  providerRequestTimeoutMilliseconds: 10_000,
  maximumProviderResponseBytes: 64 * 1024,
  refreshBeforeExpiryMilliseconds: 5 * 60 * 1_000,
  encryptionKeyVersion: 1,
  callbackPath: "/api/social-connections/callback",
} as const;
export const SOCIAL_PUBLICATION_LIMITS = {
  facebook: {
    publishablePageTasks: ["CREATE_CONTENT", "MANAGE", "PROFILE_PLUS_CREATE_CONTENT", "PROFILE_PLUS_MANAGE", "PROFILE_PLUS_FULL_CONTROL"],
  },
  instagram: {
    captionCharacters: 2_200,
    supportedSourceImageTypes: ["image/jpeg", "image/png", "image/webp"],
    maximumSourceImageBytes: 10 * 1024 * 1024,
    maximumPublishedImageBytes: 8 * 1024 * 1024,
    minimumAspectRatio: 4 / 5,
    maximumAspectRatio: 1.91,
    maximumImageWidth: 1_440,
    signedImageUrlLifetimeSeconds: 60 * 60,
    stagingRetentionMilliseconds: 24 * 60 * 60 * 1_000,
    containerReadinessChecks: 5,
    containerReadinessIntervalMilliseconds: 5_000,
  },
} as const;
export const SOCIAL_PUBLISHING_CAPABILITIES = ["connection_only", "text", "single_image"] as const;
export const SOCIAL_CAPABILITY_SNAPSHOT_SCHEMA_VERSION = 1 as const;
export const SOCIAL_CAPABILITY_CATALOG_VERSION = 1 as const;
export type SocialCapabilitySnapshot = {
  schemaVersion: typeof SOCIAL_CAPABILITY_SNAPSHOT_SCHEMA_VERSION;
  capabilityVersion: typeof SOCIAL_CAPABILITY_CATALOG_VERSION;
  platform: SocialPlatform;
  publication: (typeof SOCIAL_PUBLISHING_CAPABILITIES)[number];
  maximumTextCharacters: number | null;
  image: {
    acceptedSourceTypes: readonly string[];
    maximumSourceBytes: number;
    maximumPublishedBytes: number;
    minimumAspectRatio: number;
    maximumAspectRatio: number;
    maximumWidth: number;
  } | null;
};
export const SOCIAL_CONNECTION_EVENT_TYPES = ["connected", "refreshed", "disconnected", "reauth_required"] as const;
export const SOCIAL_CONNECTION_EVENT = {
  connected: "connected",
  refreshed: "refreshed",
  disconnected: "disconnected",
  reauthRequired: "reauth_required",
} as const;
export const SOCIAL_CONNECTION_API_PATHS = {
  brandConnections: (brandId: string) => `/api/brands/${brandId}/social-connections`,
  profileConnection: (brandId: string, profileId: string) => `/api/brands/${brandId}/social-connections/${profileId}`,
  oauthCallback: SOCIAL_CONNECTION.callbackPath,
} as const;

export const BRAND_COLORS = ["violet", "blue", "green", "orange", "ink"] as const;
export type BrandColor = (typeof BRAND_COLORS)[number];

export const BRAND_LIMITS = {
  nameCharacters: 80,
  descriptionCharacters: 180,
  industryCharacters: 80,
  websiteUrlCharacters: 2_048,
  markCharacters: 2,
} as const;

export const BRAND_SEGMENTS = [
  "personal",
  "technology",
  "marketing",
  "education",
  "finance",
  "health",
  "retail",
  "food",
  "fashion",
  "entertainment",
  "professional_services",
  "industry",
  "nonprofit",
  "other",
] as const;
export type BrandSegment = (typeof BRAND_SEGMENTS)[number];

export const CONTENT_STATUSES = ["idea", "draft", "in_review", "approved", "scheduled", "published", "failed", "cancelled"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const CONTENT_STATUS = {
  idea: "idea",
  draft: "draft",
  inReview: "in_review",
  approved: "approved",
  scheduled: "scheduled",
  published: "published",
  failed: "failed",
  cancelled: "cancelled",
} as const;
export const CONTENT_LIMITS = {
  titleCharacters: 180,
  campaignBriefCharacters: 5_000,
  maximumCampaignPublications: SOCIAL_PLATFORMS.length,
  canonicalCopyCharacters: 5_000,
  variantCopyCharacters: 5_000,
  maximumCalendarItems: 300,
  maximumVisibleCalendarItemsPerDay: 3,
  maximumContentVersionsInHistory: 10,
  maximumGeneratedImagesPerVersion: 3,
} as const;
export const CONTENT_MEDIA_STATUSES = ["queued", "processing", "pending_review", "approved", "rejected", "failed"] as const;
export type ContentMediaStatus = (typeof CONTENT_MEDIA_STATUSES)[number];
export const CONTENT_MEDIA_STATUS = {
  queued: "queued",
  processing: "processing",
  pendingReview: "pending_review",
  approved: "approved",
  rejected: "rejected",
  failed: "failed",
} as const;
export const CONTENT_APPROVAL_BLOCKING_MEDIA_STATUSES = [CONTENT_MEDIA_STATUS.queued, CONTENT_MEDIA_STATUS.processing, CONTENT_MEDIA_STATUS.pendingReview] as const;
export const CONTENT_MEDIA_REVIEW_DECISIONS = [CONTENT_MEDIA_STATUS.approved, CONTENT_MEDIA_STATUS.rejected] as const;
export const CONTENT_MEDIA_RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;
export const CONTENT_MEDIA_WORKER = {
  pollIntervalMilliseconds: 2_000,
  leaseMilliseconds: 180_000,
  maximumAttempts: CONTENT_MEDIA_RETRY_DELAYS_MS.length + 1,
  maximumImageBytes: 10 * 1024 * 1024,
  maximumImagePixels: 20_000_000,
  outputFormat: "webp",
  outputQuality: 82,
} as const;
export const CONTENT_MEDIA_GENERATION_MODES = ["ai_image", "text_card", "carousel"] as const;
export const CONTENT_MEDIA_GENERATION_MODE = { aiImage: "ai_image", textCard: "text_card", carousel: "carousel" } as const;
export const CONTENT_MEDIA_CAROUSEL = { pageCount: 3 } as const;
export const CONTENT_MEDIA_EXPORTS = {
  linkedin: { width: 1080, height: 1080 },
  instagram: { width: 1080, height: 1350 },
  facebook: { width: 1080, height: 1080 },
  tiktok: { width: 1080, height: 1080 },
  x: { width: 1600, height: 900 },
  youtube: { width: 1280, height: 720 },
  threads: { width: 1080, height: 1350 },
  pinterest: { width: 1000, height: 1500 },
} as const satisfies Record<SocialPlatform, { width: number; height: number }>;
export const CONTENT_MEDIA_TEMPLATE = {
  textCardModelId: "native:text-card:v1",
  width: 1080,
  height: 1080,
  maximumCarouselPageCharacters: 2_000,
  maximumTitleCharacters: 180,
  maximumCopyExcerptCharacters: 220,
  maximumTitleLines: 3,
  maximumCopyLines: 4,
  neutralBackground: "#F8FAFC",
  neutralForeground: "#0B1B3B",
  neutralAccent: "#64748B",
  fontFamilyPattern: /^[\p{L}\p{N}][\p{L}\p{N} ,.-]{0,79}$/u,
} as const;
export const CONTENT_EDITABLE_STATUSES = [CONTENT_STATUS.idea, CONTENT_STATUS.draft] as const;
export const CONTENT_REVIEWABLE_STATUSES = [...CONTENT_EDITABLE_STATUSES, CONTENT_STATUS.inReview, CONTENT_STATUS.approved] as const;
export const CONTENT_APPROVAL_STATUSES = ["pending", "approved", "rejected", "changes_requested", "stale"] as const;
export type ContentApprovalStatus = (typeof CONTENT_APPROVAL_STATUSES)[number];
export const CONTENT_APPROVAL_STATUS = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  changesRequested: "changes_requested",
  stale: "stale",
} as const;
export const CONTENT_APPROVAL_DECISIONS = [CONTENT_APPROVAL_STATUS.approved, CONTENT_APPROVAL_STATUS.rejected, CONTENT_APPROVAL_STATUS.changesRequested] as const;
export const CONTENT_APPROVAL_ACTION = {
  submit: "submit",
  approve: CONTENT_APPROVAL_STATUS.approved,
  reject: CONTENT_APPROVAL_STATUS.rejected,
  requestChanges: CONTENT_APPROVAL_STATUS.changesRequested,
} as const;
export const CONTENT_APPROVAL_ACTIONS = [CONTENT_APPROVAL_ACTION.submit, CONTENT_APPROVAL_ACTION.approve, CONTENT_APPROVAL_ACTION.reject, CONTENT_APPROVAL_ACTION.requestChanges] as const;
export const CONTENT_APPROVAL_LIMITS = { maximumNoteCharacters: 2_000, maximumHistoryEntries: 10 } as const;
export const CONTENT_APPROVAL_POLICY = {
  defaultScopeKey: "organization",
  brandScopePrefix: "brand:",
  defaultRequiredApprovals: 1,
  maximumRequiredApprovals: 5,
} as const;
export const CONTENT_APPROVAL_POLICY_API_PATHS = { collection: "/api/approval-policies" } as const;
export const SOCIAL_PUBLICATION_JOB_STATUSES = ["queued", "processing", "published", "failed", "indeterminate"] as const;
export const SOCIAL_PUBLICATION_JOB_STATUS = { queued: "queued", processing: "processing", published: "published", failed: "failed", indeterminate: "indeterminate" } as const;
export const SOCIAL_PUBLICATION_RECONCILIATION_OUTCOMES = ["published", "not_published", "retry"] as const;
export const SOCIAL_PUBLICATION_RECONCILIATION_SOURCES = ["manual", "automatic"] as const;
export const SOCIAL_ANALYTICS_COLLECTION_STATUSES = ["success", "permission_denied", "authentication_required", "unavailable"] as const;
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
export const SOCIAL_ANALYTICS_LIMITS = { refreshCandidateCount: 10, refreshConcurrency: 3, refreshCooldownMilliseconds: 60 * 60 * 1_000 } as const;
export const SOCIAL_ANALYTICS_FRESHNESS_MILLISECONDS = 24 * 60 * 60 * 1_000;
export const SOCIAL_ANALYTICS_DEFINITION_VERSION = "meta_post_counts_lifetime_v1" as const;
export const SOCIAL_PUBLICATION_RECONCILIATION_LIMITS = { minimumEvidenceCharacters: 10, maximumEvidenceCharacters: 1_000, maximumExternalPostIdCharacters: 256, maximumManualRetriesPerJob: 1, automaticCheckIntervalMilliseconds: 60_000, maximumAutomaticChecksPerJob: 5 } as const;
export const SOCIAL_PUBLICATION_POLL_INTERVAL_MILLISECONDS = 15_000;
export const SOCIAL_PUBLISHING_WORKER = { heartbeatKey: "social-publishing", heartbeatIntervalMilliseconds: 30_000, heartbeatStaleMilliseconds: 90_000 } as const;
export const SOCIAL_PUBLISHING_WORKER_STATUSES = ["disabled", "healthy", "stale", "unknown"] as const;
export const SOCIAL_PUBLICATION_LEASE_TIMEOUT_MILLISECONDS = 180_000;
export const APPROVAL_POLICY_LIMITS = { minimumApprovals: 1, maximumApprovals: CONTENT_APPROVAL_POLICY.maximumRequiredApprovals } as const;
export const CALENDAR = {
  daysPerWeek: 7,
  weeksPerView: 6,
  maximumRequestRangeDays: 43,
  millisecondsPerDay: 86_400_000,
  previousMonthStep: -1,
  nextMonthStep: 1,
  maximumVisibleItemsPerDay: CONTENT_LIMITS.maximumVisibleCalendarItemsPerDay,
  defaultPlannedTime: "09:00",
  firstWeekday: { pt: 1, en: 0 },
} as const;
export const CALENDAR_API_PATHS = {
  collection: "/api/calendar",
  item: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}`,
  versions: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/versions`,
  generateCopy: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/copy-draft`,
  reviewCopy: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/review`,
  approval: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/approval`,
  reconcilePublication: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/publication-reconciliation`,
} as const;
export const COPY_GENERATION = {
  timeoutMilliseconds: 30_000,
  maximumOutputTokens: 1_100,
  variantOptionCount: 3,
  maximumVariantOptionCharacters: 1_200,
  imageTimeoutMilliseconds: 90_000,
} as const;
export const CONTENT_REVIEW = {
  timeoutMilliseconds: 30_000,
  maximumFindings: 8,
  maximumOutputTokens: 900,
  maximumFindingTextCharacters: 600,
} as const;
export const CONTENT_REVIEW_CATEGORIES = ["grammar", "unsupported_claim", "restricted_claim", "brand_voice", "channel_fit", "clarity"] as const;
export const CONTENT_REVIEW_SEVERITIES = ["high", "medium", "low"] as const;
export const CONTENT_REVIEW_LOCALES = ["pt", "en"] as const;
export const AI_PROVIDER_ENV = {
  apiKey: "OPENAI_API_KEY",
  model: "OPENAI_MODEL",
  imageModel: "OPENAI_IMAGE_MODEL",
} as const;
export const CONTENT_MEDIA_API_PATHS = {
  collection: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/media`,
  review: (itemId: string, mediaId: string) => `/api/calendar/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}/review`,
} as const;
export const CAMPAIGN_API_PATHS = { collection: "/api/campaigns" } as const;
export const CAMPAIGN_FORM_FIELDS = {
  platforms: "platforms",
  publicationDatePrefix: "publication-date-",
  publicationTimePrefix: "publication-time-",
  publicationDate: (platform: SocialPlatform) => `publication-date-${platform}`,
  publicationTime: (platform: SocialPlatform) => `publication-time-${platform}`,
  platformCheckboxId: (platform: SocialPlatform) => `calendar-platform-${platform}`,
} as const;
export const CALENDAR_VIEW_MODES = ["month", "list"] as const;
export type CalendarViewMode = (typeof CALENDAR_VIEW_MODES)[number];
export const CALENDAR_VIEW_MODE = { month: "month", list: "list" } as const;
export const CALENDAR_QUERY_PARAMETERS = {
  start: "start",
  end: "end",
  brandId: "brandId",
  platform: "platform",
  status: "status",
  publicationStatus: "publicationStatus",
} as const;
export const CALENDAR_UI_IDS = {
  section: WORKSPACE_SECTION_IDS.calendar,
  title: "editorial-calendar-title",
  filters: "editorial-calendar-filters",
  newCampaignForm: "editorial-calendar-new-campaign",
  createCampaignTitle: "calendar-create-campaign-title",
  createCampaignDescription: "calendar-create-campaign-description",
  campaignTitle: "calendar-campaign-title",
  campaignBrand: "calendar-campaign-brand",
  campaignBrief: "calendar-campaign-brief",
  editTitle: "calendar-edit-title",
  editDescription: "calendar-edit-description",
  canonicalCopy: "calendar-canonical-copy",
  variantCopy: "calendar-variant-copy",
} as const;
export const CALENDAR_FORM_FIELDS = { brandId: "brandId", platform: "platform" } as const;

export const BRAND_KIT_VERSION_STATUSES = ["draft", "approved", "superseded"] as const;
export type BrandKitVersionStatus = (typeof BRAND_KIT_VERSION_STATUSES)[number];
export const BRAND_KIT_VERSION_STATUS = {
  draft: "draft",
  approved: "approved",
  superseded: "superseded",
} as const;
export const BRAND_ASSET_STATUSES = ["upload_pending", "pending_review", "approved", "rejected"] as const;
export type BrandAssetStatus = (typeof BRAND_ASSET_STATUSES)[number];
export const BRAND_ASSET_STATUS = {
  uploadPending: "upload_pending",
  pendingReview: "pending_review",
  approved: "approved",
  rejected: "rejected",
} as const;
export const BRAND_ASSET_KINDS = ["logo", "template_reference", "other"] as const;
export type BrandAssetKind = (typeof BRAND_ASSET_KINDS)[number];
export const BRAND_ASSET_REVIEW_DECISIONS = ["approved", "rejected"] as const;
export const BRAND_ASSET_REVIEW_DECISION = {
  approved: "approved",
  rejected: "rejected",
} as const;
export const BRAND_ASSET_LIMITS = {
  maximumBytes: 10 * 1024 * 1024,
  maximumImagePixels: 20_000_000,
  maximumFileNameCharacters: 180,
  maximumSourceUrlCharacters: 2_048,
  maximumLicenseCharacters: 500,
  maximumAltTextCharacters: 500,
  uploadExpirySeconds: 300,
  abandonedUploadRetentionSeconds: 86_400,
  cleanupBatchSize: 100,
  downloadExpirySeconds: 60,
  listItems: 100,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;
export const BRAND_ASSET_EXTENSIONS_BY_MIME = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
} as const;
export const BRAND_ASSET_FORMATS_BY_MIME = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export const BRAND_ASSET_API_PATHS = {
  brands: "/api/brands",
  segment: "assets",
  finalizeAction: "finalize",
  reviewAction: "review",
  downloadAction: "download",
} as const;
export const BRAND_ASSET_ACTIONS = {
  finalize: BRAND_ASSET_API_PATHS.finalizeAction,
  review: BRAND_ASSET_API_PATHS.reviewAction,
  download: BRAND_ASSET_API_PATHS.downloadAction,
} as const;
export const BRAND_ASSET_ENV = {
  bucket: "STUDIO_ASSET_BUCKET",
  region: "AWS_REGION",
  endpoint: "STUDIO_ASSET_ENDPOINT",
} as const;
export const LOCAL_DEVELOPMENT = {
  seedUserEmail: "demo@30studio.local",
  seedUserPassword: "30studio-local-only",
  seedUserName: "30studio Demo",
  seedOrganizationName: "30studio Local",
  seedOrganizationSlug: "30studio-local",
  credentialProviderId: "credential",
  allowedDatabaseHosts: ["localhost", "127.0.0.1", "::1", "postgres"] as const,
  allowedDatabaseNames: ["30studio", "30studio_test"] as const,
  ownerRole: "owner",
  enabledEnvironmentValue: "true",
  enabledEnvironmentName: "STUDIO_LOCAL_DEVELOPMENT",
  objectStorageBucket: "30studio-media",
  objectStorageEndpoint: "http://localstack:4566",
  objectStorageHostname: "localstack",
  objectStoragePort: "4566",
  region: "us-east-1",
  runtimeEnvironment: "development",
} as const;
export const BRAND_ASSET_ENDPOINT_SECURITY = {
  allowedProtocols: ["http:", "https:"] as const,
  loopbackHostnames: ["localhost", "127.0.0.1", "::1", "[::1]"] as const,
  rootPath: "/",
} as const;
export function getBrandAssetsApiPath(brandId: string) {
  return `${BRAND_ASSET_API_PATHS.brands}/${encodeURIComponent(brandId)}/${BRAND_ASSET_API_PATHS.segment}`;
}
export function getBrandAssetActionApiPath(brandId: string, assetId: string, action: typeof BRAND_ASSET_ACTIONS[keyof typeof BRAND_ASSET_ACTIONS]) {
  return `${getBrandAssetsApiPath(brandId)}/${encodeURIComponent(assetId)}/${action}`;
}
export const BRAND_ASSET_UI_IDS = {
  libraryPrefix: "brand-asset-library-",
  filePrefix: "brand-asset-file-",
  kindPrefix: "brand-asset-kind-",
  sourcePrefix: "brand-asset-source-",
  licensePrefix: "brand-asset-license-",
  rightsExpiryPrefix: "brand-asset-rights-expiry-",
  altTextPrefix: "brand-asset-alt-text-",
  reviewNotePrefix: "brand-asset-review-note-",
} as const;
export const BRAND_KIT_LIMITS = {
  textCharacters: 2_000,
  itemCharacters: 200,
  itemsPerField: 30,
  colors: 12,
  facts: 30,
  sourceUrlCharacters: 2_048,
  historyVersions: 100,
  initialVersion: 0,
  versionIncrement: 1,
} as const;

export const AUTH_LIMITS = {
  emailCharacters: 254,
  passwordCharacters: 8,
  nameCharacters: 100,
  slugCharacters: 48,
} as const;

export const DATABASE_LIMITS = {
  poolConnections: 8,
  connectionTimeoutMilliseconds: 5_000,
  idleTimeoutMilliseconds: 30_000,
} as const;

export const AUTH_STORAGE = {
  redisUrlEnvironmentName: "REDIS_URL",
  redisKeyPrefix: "30studio:auth:",
  redisConnectTimeoutMilliseconds: 5_000,
  redisMaxRetriesPerRequest: 1,
} as const;

export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  accepted: 202,
  unprocessable: 422,
  internalError: 500,
  unavailable: 503,
} as const;

export const API_ERROR_CODES = {
  authUnavailable: "AUTH_UNAVAILABLE",
  unauthenticated: "UNAUTHENTICATED",
  forbidden: "FORBIDDEN",
  organizationRequired: "ORGANIZATION_REQUIRED",
  organizationNotFound: "ORGANIZATION_NOT_FOUND",
  invalidRequest: "INVALID_REQUEST",
  brandExists: "BRAND_EXISTS",
  brandNotFound: "BRAND_NOT_FOUND",
  profileExists: "PROFILE_EXISTS",
  socialConnectorUnavailable: "SOCIAL_CONNECTOR_UNAVAILABLE",
  socialConnectionConflict: "SOCIAL_CONNECTION_CONFLICT",
  socialConnectionNotFound: "SOCIAL_CONNECTION_NOT_FOUND",
  competitorSourceNotFound: "COMPETITOR_SOURCE_NOT_FOUND",
  competitorSourceExists: "COMPETITOR_SOURCE_EXISTS",
  competitorSourceLimitReached: "COMPETITOR_SOURCE_LIMIT_REACHED",
  competitorYouTubeConnectionRequired: "COMPETITOR_YOUTUBE_CONNECTION_REQUIRED",
  competitorInstagramConnectionRequired: "COMPETITOR_INSTAGRAM_CONNECTION_REQUIRED",
  competitorFacebookConnectionRequired: "COMPETITOR_FACEBOOK_CONNECTION_REQUIRED",
  competitorXConnectionRequired: "COMPETITOR_X_CONNECTION_REQUIRED",
  competitorXApiDisabled: "COMPETITOR_X_API_DISABLED",
  competitorProfileNotFound: "COMPETITOR_PROFILE_NOT_FOUND",
  competitorProfileLookupUnavailable: "COMPETITOR_PROFILE_LOOKUP_UNAVAILABLE",
  socialOAuthInvalid: "SOCIAL_OAUTH_INVALID",
  brandAssetNotFound: "BRAND_ASSET_NOT_FOUND",
  brandAssetInvalid: "BRAND_ASSET_INVALID",
  brandAssetStateConflict: "BRAND_ASSET_STATE_CONFLICT",
  calendarItemNotFound: "CALENDAR_ITEM_NOT_FOUND",
  contentMediaNotFound: "CONTENT_MEDIA_NOT_FOUND",
  contentMediaConflict: "CONTENT_MEDIA_CONFLICT",
  campaignIdempotencyConflict: "CAMPAIGN_IDEMPOTENCY_CONFLICT",
  contentVersionConflict: "CONTENT_VERSION_CONFLICT",
  contentApprovalConflict: "CONTENT_APPROVAL_CONFLICT",
  contentApprovalContentRequired: "CONTENT_APPROVAL_CONTENT_REQUIRED",
  contentApprovalMediaPending: "CONTENT_APPROVAL_MEDIA_PENDING",
  contentApprovalSelfReview: "CONTENT_APPROVAL_SELF_REVIEW",
  contentApprovalStale: "CONTENT_APPROVAL_STALE",
  contentApprovalPublisherConnectionRequired: "CONTENT_APPROVAL_PUBLISHER_CONNECTION_REQUIRED",
  contentApprovalPublisherMediaUnsupported: "CONTENT_APPROVAL_PUBLISHER_MEDIA_UNSUPPORTED",
  contentApprovalPublisherTextLimit: "CONTENT_APPROVAL_PUBLISHER_TEXT_LIMIT",
  socialPublicationReconciliationConflict: "SOCIAL_PUBLICATION_RECONCILIATION_CONFLICT",
  socialPublicationRetryLimitReached: "SOCIAL_PUBLICATION_RETRY_LIMIT_REACHED",
  contentMediaLimitReached: "CONTENT_MEDIA_LIMIT_REACHED",
  contentMediaGenerationFailed: "CONTENT_MEDIA_GENERATION_FAILED",
  contentMediaGenerationUnavailable: "CONTENT_MEDIA_GENERATION_UNAVAILABLE",
  aiServiceUnavailable: "AI_SERVICE_UNAVAILABLE",
  teamMemberNotFound: "TEAM_MEMBER_NOT_FOUND",
  workspaceNotificationNotFound: "WORKSPACE_NOTIFICATION_NOT_FOUND",
  teamOperationNotAllowed: "TEAM_OPERATION_NOT_ALLOWED",
  invitationNotFound: "INVITATION_NOT_FOUND",
  invitationDeliveryUnavailable: "INVITATION_DELIVERY_UNAVAILABLE",
  invitationAlreadyExists: "INVITATION_ALREADY_EXISTS",
  serviceUnavailable: "SERVICE_UNAVAILABLE",
  internalError: "INTERNAL_ERROR",
} as const;

export const TEAM_AUDIT_ACTIONS = {
  memberRoleChanged: "member_role_changed",
  memberRemoved: "member_removed",
  invitationCreated: "invitation_created",
  invitationResent: "invitation_resent",
  invitationCancelled: "invitation_cancelled",
  invitationAccepted: "invitation_accepted",
  invitationDeliveryFailed: "invitation_delivery_failed",
} as const;
export const TEAM_AUDIT_ACTION_VALUES = [
  TEAM_AUDIT_ACTIONS.memberRoleChanged,
  TEAM_AUDIT_ACTIONS.memberRemoved,
  TEAM_AUDIT_ACTIONS.invitationCreated,
  TEAM_AUDIT_ACTIONS.invitationResent,
  TEAM_AUDIT_ACTIONS.invitationCancelled,
  TEAM_AUDIT_ACTIONS.invitationAccepted,
  TEAM_AUDIT_ACTIONS.invitationDeliveryFailed,
] as const;
export const INVITATION_STATUSES = ["pending", "accepted", "rejected", "canceled"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export const INVITATION_STATUS = {
  pending: "pending",
  accepted: "accepted",
  rejected: "rejected",
  canceled: "canceled",
} as const;
export const TEAM_MEMBER_LIMIT = 100;
export const TEAM_INVITATION_LIMIT = 100;
export const TEAM_AUDIT_LIMIT = 100;
export const DATA_TABLE_PAGE_SIZES = [10, 25, 50] as const;
export const DATA_TABLE_DEFAULT_PAGE_SIZE = 10;
export const DATA_TABLE_FIELD_PREFIXES = {
  filter: "data-table-filter-",
  pageSize: "data-table-page-size-",
} as const;
export const TEAM_API_PATHS = {
  collection: "/api/team",
  invitations: "/api/team/invitations",
  audit: "/api/team/audit",
} as const;
export const BRAND_KIT_API_PATHS = {
  brands: "/api/brands",
  segment: "brand-kit",
  approveAction: "approve",
} as const;
export function getBrandKitApiPath(brandId: string) {
  return `${BRAND_KIT_API_PATHS.brands}/${encodeURIComponent(brandId)}/${BRAND_KIT_API_PATHS.segment}`;
}
export const BRAND_KIT_UI_IDS = {
  editorPrefix: "brand-kit-editor-",
  titleSuffix: "-title",
  historySuffix: "-history",
} as const;
export const TEAM_FORM_ID_PREFIXES = {
  role: "team-role-",
  invite: "team-invite-",
} as const;

export const BETTER_AUTH_ENV = {
  secret: "BETTER_AUTH_SECRET",
  url: "BETTER_AUTH_URL",
  trustedOrigins: "BETTER_AUTH_TRUSTED_ORIGINS",
} as const;

export const EMAIL_ENV = {
  host: "SMTP_HOST",
  port: "SMTP_PORT",
  secure: "SMTP_SECURE",
  requireTls: "SMTP_REQUIRE_TLS",
  user: "SMTP_USER",
  password: "SMTP_PASSWORD",
  from: "MAIL_FROM_EMAIL",
} as const;
export const EMAIL_DELIVERY_LIMITS = {
  connectionTimeoutMilliseconds: 10_000,
  greetingTimeoutMilliseconds: 10_000,
  socketTimeoutMilliseconds: 20_000,
  verificationExpirySeconds: 3_600,
  invitationExpirySeconds: 604_800,
  passwordResetExpirySeconds: 3_600,
} as const;
export const AUTH_QUERY_PARAMETERS = {
  invitationId: "invitationId",
} as const;
export const EMAIL_ROUTES = {
  invitationAccept: `/${DEFAULT_LOCALE}/accept-invitation`,
  passwordReset: (locale: Locale) => `/${locale}/reset-password`,
} as const;
export const INVITATION_PAGE_ROUTE = "/accept-invitation";
export const INVITATION_ID_MAX_CHARACTERS = 256;

export const TENANT_ROLE = {
  owner: "owner",
  admin: "admin",
  editor: "editor",
  approver: "approver",
  analyst: "analyst",
} as const;
export const TENANT_ROLES = Object.values(TENANT_ROLE);
export const TEAM_ROLES = TENANT_ROLES;
export type TenantRole = (typeof TENANT_ROLES)[number];
export const TENANT_PERMISSIONS = {
  organizationManage: "organization:manage",
  membersManage: "members:manage",
  brandsRead: "brands:read",
  brandsManage: "brands:manage",
  contentRead: "content:read",
  contentManage: "content:manage",
  contentApprove: "content:approve",
  contentApprovalPoliciesManage: "content:approval-policies:manage",
  analyticsRead: "analytics:read",
  competitorResearchRead: "competitor-research:read",
  competitorResearchManage: "competitor-research:manage",
} as const;
export type TenantPermission = (typeof TENANT_PERMISSIONS)[keyof typeof TENANT_PERMISSIONS];

export const TENANT_ROLE_PERMISSIONS = {
  [TENANT_ROLE.owner]: [TENANT_PERMISSIONS.organizationManage, TENANT_PERMISSIONS.membersManage, TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.brandsManage, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentManage, TENANT_PERMISSIONS.contentApprove, TENANT_PERMISSIONS.contentApprovalPoliciesManage, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead, TENANT_PERMISSIONS.competitorResearchManage],
  [TENANT_ROLE.admin]: [TENANT_PERMISSIONS.membersManage, TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.brandsManage, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentManage, TENANT_PERMISSIONS.contentApprove, TENANT_PERMISSIONS.contentApprovalPoliciesManage, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead, TENANT_PERMISSIONS.competitorResearchManage],
  [TENANT_ROLE.editor]: [TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentManage, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead, TENANT_PERMISSIONS.competitorResearchManage],
  [TENANT_ROLE.approver]: [TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentApprove, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead],
  [TENANT_ROLE.analyst]: [TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead],
} as const;
