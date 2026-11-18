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
  tokenRefreshLeaseMilliseconds: 15_000,
  tokenRefreshWaitMilliseconds: 12_000,
  tokenRefreshPollMilliseconds: 1_000,
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

export const SOCIAL_PUBLICATION_JOB_STATUSES = ["queued", "processing", "published", "failed", "indeterminate"] as const;

export const SOCIAL_PUBLICATION_JOB_STATUS = { queued: "queued", processing: "processing", published: "published", failed: "failed", indeterminate: "indeterminate" } as const;

export const SOCIAL_PUBLICATION_RECONCILIATION_OUTCOMES = ["published", "not_published", "retry"] as const;

export const SOCIAL_PUBLICATION_RECONCILIATION_SOURCES = ["manual", "automatic"] as const;

export const SOCIAL_ANALYTICS_COLLECTION_STATUSES = ["success", "permission_denied", "authentication_required", "unavailable"] as const;

export const SOCIAL_ANALYTICS_LIMITS = { refreshCandidateCount: 10, refreshConcurrency: 3, refreshCooldownMilliseconds: 60 * 60 * 1_000, maximumComparisonSnapshots: 240 } as const;

export const SOCIAL_ANALYTICS_FRESHNESS_MILLISECONDS = 24 * 60 * 60 * 1_000;

export const SOCIAL_ANALYTICS_DEFINITION_VERSION = "meta_post_counts_lifetime_v1" as const;

export const SOCIAL_PUBLICATION_RECONCILIATION_LIMITS = { minimumEvidenceCharacters: 10, maximumEvidenceCharacters: 1_000, maximumExternalPostIdCharacters: 256, maximumManualRetriesPerJob: 1, automaticCheckIntervalMilliseconds: 60_000, maximumAutomaticChecksPerJob: 5 } as const;

export const SOCIAL_PUBLICATION_POLL_INTERVAL_MILLISECONDS = 15_000;

export const SOCIAL_PUBLISHING_WORKER = { heartbeatKey: "social-publishing", heartbeatIntervalMilliseconds: 30_000, heartbeatStaleMilliseconds: 90_000 } as const;

export const SOCIAL_PUBLISHING_WORKER_STATUSES = ["disabled", "healthy", "stale", "unknown"] as const;

export const SOCIAL_PUBLICATION_LEASE_TIMEOUT_MILLISECONDS = 180_000;
