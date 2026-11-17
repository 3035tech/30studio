import { relations, sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { BRAND_ASSET_KINDS, BRAND_ASSET_REVIEW_DECISIONS, BRAND_ASSET_STATUSES, BRAND_ASSET_STATUS, BRAND_KIT_VERSION_STATUSES, BRAND_KIT_VERSION_STATUS, COMPETITOR_FETCH_RUN_STATUSES, COMPETITOR_OBSERVATION_ANALYSIS_STATUSES, COMPETITOR_OBSERVATION_DATA_QUALITIES, COMPETITOR_RETRIEVAL_METHODS, COMPETITOR_SOURCE_STATUSES, COMPETITOR_TOPIC_KEYS, CONTENT_APPROVAL_DECISIONS, CONTENT_APPROVAL_POLICY, CONTENT_APPROVAL_STATUSES, CONTENT_MEDIA_REVIEW_DECISIONS, CONTENT_MEDIA_STATUSES, CONTENT_STATUSES, CONTENT_STATUS, SOCIAL_ANALYTICS_COLLECTION_STATUSES, SOCIAL_CONNECTION_EVENT_TYPES, SOCIAL_PLATFORMS, SOCIAL_PROFILE_STATUSES, SOCIAL_PUBLICATION_JOB_STATUSES, SOCIAL_PUBLICATION_RECONCILIATION_OUTCOMES, SOCIAL_PUBLICATION_RECONCILIATION_SOURCES, TEAM_AUDIT_ACTION_VALUES } from "@/lib/constants";
import { organization, user } from "@/lib/db/auth-schema";
import type { SocialCapabilitySnapshot } from "@/lib/constants";
import type { BrandKitContent } from "@/lib/validation/brand-kits";

export * from "@/lib/db/auth-schema";

export const socialPlatform = pgEnum("social_platform", SOCIAL_PLATFORMS);
export const socialProfileStatus = pgEnum("social_profile_status", SOCIAL_PROFILE_STATUSES);
export const socialConnectionEventType = pgEnum("social_connection_event_type", SOCIAL_CONNECTION_EVENT_TYPES);
export const teamAuditAction = pgEnum("team_audit_action", TEAM_AUDIT_ACTION_VALUES);
export const brandKitVersionStatus = pgEnum("brand_kit_version_status", BRAND_KIT_VERSION_STATUSES);
export const brandAssetStatus = pgEnum("brand_asset_status", BRAND_ASSET_STATUSES);
export const brandAssetKind = pgEnum("brand_asset_kind", BRAND_ASSET_KINDS);
export const brandAssetReviewDecision = pgEnum("brand_asset_review_decision", BRAND_ASSET_REVIEW_DECISIONS);
export const contentStatus = pgEnum("content_status", CONTENT_STATUSES);
export const contentMediaStatus = pgEnum("content_media_status", CONTENT_MEDIA_STATUSES);
export const contentMediaReviewDecision = pgEnum("content_media_review_decision", CONTENT_MEDIA_REVIEW_DECISIONS);
export const contentApprovalStatus = pgEnum("content_approval_status", CONTENT_APPROVAL_STATUSES);
export const contentApprovalDecision = pgEnum("content_approval_decision", CONTENT_APPROVAL_DECISIONS);
export const socialPublicationJobStatus = pgEnum("social_publication_job_status", SOCIAL_PUBLICATION_JOB_STATUSES);
export const socialPublicationReconciliationOutcome = pgEnum("social_publication_reconciliation_outcome", SOCIAL_PUBLICATION_RECONCILIATION_OUTCOMES);
export const socialPublicationReconciliationSource = pgEnum("social_publication_reconciliation_source", SOCIAL_PUBLICATION_RECONCILIATION_SOURCES);
export const socialAnalyticsCollectionStatus = pgEnum("social_analytics_collection_status", SOCIAL_ANALYTICS_COLLECTION_STATUSES);
export const competitorSourceStatus = pgEnum("competitor_source_status", COMPETITOR_SOURCE_STATUSES);
export const competitorRetrievalMethod = pgEnum("competitor_retrieval_method", COMPETITOR_RETRIEVAL_METHODS);
export const competitorObservationDataQuality = pgEnum("competitor_observation_data_quality", COMPETITOR_OBSERVATION_DATA_QUALITIES);
export const competitorObservationAnalysisStatus = pgEnum("competitor_observation_analysis_status", COMPETITOR_OBSERVATION_ANALYSIS_STATUSES);
export const competitorTopic = pgEnum("competitor_topic", COMPETITOR_TOPIC_KEYS);
export const competitorFetchRunStatus = pgEnum("competitor_fetch_run_status", COMPETITOR_FETCH_RUN_STATUSES);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    industry: text("industry"),
    websiteUrl: text("website_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("brands_organization_slug_unique").on(table.organizationId, table.slug),
    unique("brands_organization_id_unique").on(table.organizationId, table.id),
    index("brands_organization_id_idx").on(table.organizationId),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    title: text("title").notNull(),
    brief: text("brief").notNull(),
    idempotencyKey: uuid("idempotency_key"),
    requestFingerprint: text("request_fingerprint"),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "campaigns_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    unique("campaigns_org_id_brand_unique").on(table.organizationId, table.id, table.brandId),
    uniqueIndex("campaigns_org_creator_idempotency_unique").on(table.organizationId, table.createdBy, table.idempotencyKey),
    index("campaigns_org_brand_created_idx").on(table.organizationId, table.brandId, table.createdAt),
  ],
);

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    campaignId: uuid("campaign_id"),
    platform: socialPlatform("platform").notNull(),
    title: text("title").notNull(),
    status: contentStatus("status").notNull().default(CONTENT_STATUS.idea),
    plannedAt: timestamp("planned_at", { withTimezone: true, mode: "date" }).notNull(),
    timeZone: text("time_zone").notNull(),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "content_items_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    foreignKey({ name: "content_items_org_campaign_brand_fk", columns: [table.organizationId, table.campaignId, table.brandId], foreignColumns: [campaigns.organizationId, campaigns.id, campaigns.brandId] }).onDelete("cascade"),
    unique("content_items_org_id_brand_unique").on(table.organizationId, table.id, table.brandId),
    index("content_items_org_planned_idx").on(table.organizationId, table.plannedAt),
    index("content_items_org_brand_planned_idx").on(table.organizationId, table.brandId, table.plannedAt),
  ],
);

export const socialProfiles = pgTable(
  "social_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    platform: socialPlatform("platform").notNull(),
    displayName: text("display_name").notNull(),
    handle: text("handle"),
    externalAccountId: text("external_account_id"),
    connectedBy: text("connected_by").references(() => user.id, { onDelete: "set null" }),
    connectedAt: timestamp("connected_at", { withTimezone: true, mode: "date" }),
    status: socialProfileStatus("status").notNull().default("not_connected"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "social_profiles_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    index("social_profiles_organization_brand_idx").on(table.organizationId, table.brandId),
    unique("social_profiles_org_profile_unique").on(table.organizationId, table.id),
    unique("social_profiles_org_brand_profile_unique").on(table.organizationId, table.brandId, table.id),
    unique("social_profiles_org_profile_prerequisite_unique").on(table.organizationId, table.id),
    unique("social_profiles_org_brand_profile_prerequisite_unique").on(table.organizationId, table.brandId, table.id),
    uniqueIndex("social_profiles_identity_unique").on(table.brandId, table.platform, table.handle),
    uniqueIndex("social_profiles_external_identity_unique").on(table.organizationId, table.brandId, table.platform, table.externalAccountId),
  ],
);

export const socialProfileCredentials = pgTable(
  "social_profile_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    socialProfileId: uuid("social_profile_id").notNull(),
    accessTokenCiphertext: text("access_token_ciphertext").notNull(),
    refreshTokenCiphertext: text("refresh_token_ciphertext"),
    tokenType: text("token_type").notNull().default("Bearer"),
    scopes: text("scopes").array().notNull().default([]),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
    encryptionKeyVersion: integer("encryption_key_version").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "social_profile_credentials_org_profile_fk", columns: [table.organizationId, table.socialProfileId], foreignColumns: [socialProfiles.organizationId, socialProfiles.id] }).onDelete("cascade"),
    uniqueIndex("social_profile_credentials_org_profile_unique").on(table.organizationId, table.socialProfileId),
    index("social_profile_credentials_expiry_idx").on(table.tokenExpiresAt),
  ],
);

export const socialOAuthStates = pgTable(
  "social_oauth_states",
  {
    stateHash: text("state_hash").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    platform: socialPlatform("platform").notNull(),
    initiatedBy: text("initiated_by").notNull().references(() => user.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    codeVerifierCiphertext: text("code_verifier_ciphertext"),
    nonceCiphertext: text("nonce_ciphertext"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "social_oauth_states_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    index("social_oauth_states_expiry_idx").on(table.expiresAt),
  ],
);

export const socialConnectionEvents = pgTable(
  "social_connection_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    socialProfileId: uuid("social_profile_id").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    platform: socialPlatform("platform").notNull(),
    eventType: socialConnectionEventType("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "social_connection_events_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    foreignKey({ name: "social_connection_events_org_profile_fk", columns: [table.organizationId, table.socialProfileId], foreignColumns: [socialProfiles.organizationId, socialProfiles.id] }).onDelete("cascade"),
    index("social_connection_events_org_brand_time_idx").on(table.organizationId, table.brandId, table.occurredAt),
  ],
);

export const teamAuditEvents = pgTable(
  "team_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    targetUserId: text("target_user_id"),
    targetEmail: text("target_email"),
    invitationId: text("invitation_id"),
    action: teamAuditAction("action").notNull(),
    previousRole: text("previous_role"),
    newRole: text("new_role"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("team_audit_events_org_occurred_idx").on(table.organizationId, table.occurredAt),
    index("team_audit_events_org_target_idx").on(table.organizationId, table.targetUserId),
  ],
);

export const brandKitVersions = pgTable(
  "brand_kit_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    version: integer("version").notNull(),
    status: brandKitVersionStatus("status").notNull().default(BRAND_KIT_VERSION_STATUS.draft),
    content: jsonb("content").$type<BrandKitContent>().notNull(),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    foreignKey({ name: "brand_kit_versions_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    uniqueIndex("brand_kit_versions_identity_unique").on(table.organizationId, table.brandId, table.version),
    index("brand_kit_versions_brand_idx").on(table.organizationId, table.brandId, table.version),
  ],
);

export const contentVersions = pgTable(
  "content_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    canonicalCopy: text("canonical_copy").notNull(),
    brandKitVersionNumber: integer("brand_kit_version_number"),
    capabilitySnapshot: jsonb("capability_snapshot").$type<SocialCapabilitySnapshot>(),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "content_versions_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    foreignKey({ name: "content_versions_org_brand_kit_fk", columns: [table.organizationId, table.brandId, table.brandKitVersionNumber], foreignColumns: [brandKitVersions.organizationId, brandKitVersions.brandId, brandKitVersions.version] }).onDelete("cascade"),
    unique("content_versions_org_id_unique").on(table.organizationId, table.id),
    unique("content_versions_org_id_item_brand_unique").on(table.organizationId, table.id, table.contentItemId, table.brandId),
    foreignKey({ name: "content_versions_org_item_brand_fk", columns: [table.organizationId, table.contentItemId, table.brandId], foreignColumns: [contentItems.organizationId, contentItems.id, contentItems.brandId] }).onDelete("cascade"),
    uniqueIndex("content_versions_item_number_unique").on(table.organizationId, table.contentItemId, table.versionNumber),
    index("content_versions_item_created_idx").on(table.organizationId, table.contentItemId, table.createdAt),
  ],
);

export const contentVariants = pgTable(
  "content_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    contentVersionId: uuid("content_version_id").notNull(),
    platform: socialPlatform("platform").notNull(),
    copy: text("copy").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "content_variants_org_version_fk", columns: [table.organizationId, table.contentVersionId], foreignColumns: [contentVersions.organizationId, contentVersions.id] }).onDelete("cascade"),
    uniqueIndex("content_variants_version_platform_unique").on(table.organizationId, table.contentVersionId, table.platform),
    index("content_variants_org_platform_idx").on(table.organizationId, table.platform),
  ],
);

export const contentApprovalRequests = pgTable(
  "content_approval_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    contentVersionId: uuid("content_version_id").notNull(),
    socialProfileId: uuid("social_profile_id"),
    fingerprint: text("fingerprint").notNull(),
    submittedBy: text("submitted_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    requiredApprovals: integer("required_approvals").notNull().default(CONTENT_APPROVAL_POLICY.defaultRequiredApprovals),
    status: contentApprovalStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    foreignKey({ name: "content_approval_requests_org_item_brand_fk", columns: [table.organizationId, table.contentItemId, table.brandId], foreignColumns: [contentItems.organizationId, contentItems.id, contentItems.brandId] }).onDelete("cascade"),
    foreignKey({ name: "content_approval_requests_org_brand_profile_fk", columns: [table.organizationId, table.brandId, table.socialProfileId], foreignColumns: [socialProfiles.organizationId, socialProfiles.brandId, socialProfiles.id] }).onDelete("restrict"),
    foreignKey({ name: "content_approval_requests_org_version_item_brand_fk", columns: [table.organizationId, table.contentVersionId, table.contentItemId, table.brandId], foreignColumns: [contentVersions.organizationId, contentVersions.id, contentVersions.contentItemId, contentVersions.brandId] }).onDelete("cascade"),
    unique("content_approval_requests_org_id_unique").on(table.organizationId, table.id),
    uniqueIndex("content_approval_requests_item_version_unique").on(table.organizationId, table.contentItemId, table.contentVersionId),
    index("content_approval_requests_org_status_created_idx").on(table.organizationId, table.status, table.createdAt),
  ],
);

export const socialPublicationJobs = pgTable("social_publication_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull(),
  contentItemId: uuid("content_item_id").notNull(),
  approvalRequestId: uuid("approval_request_id").notNull(),
  socialProfileId: uuid("social_profile_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  status: socialPublicationJobStatus("status").notNull().default("queued"),
  attemptCount: integer("attempt_count").notNull().default(0),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" }).notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
  externalPostId: text("external_post_id"),
  providerReferenceId: text("provider_reference_id"),
  reconciliationAttemptCount: integer("reconciliation_attempt_count").notNull().default(0),
  nextReconciliationAt: timestamp("next_reconciliation_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: "social_publication_jobs_org_item_brand_fk", columns: [table.organizationId, table.contentItemId, table.brandId], foreignColumns: [contentItems.organizationId, contentItems.id, contentItems.brandId] }).onDelete("cascade"),
  foreignKey({ name: "social_publication_jobs_org_approval_fk", columns: [table.organizationId, table.approvalRequestId], foreignColumns: [contentApprovalRequests.organizationId, contentApprovalRequests.id] }).onDelete("cascade"),
  foreignKey({ name: "social_publication_jobs_org_profile_fk", columns: [table.organizationId, table.socialProfileId], foreignColumns: [socialProfiles.organizationId, socialProfiles.id] }).onDelete("restrict"),
  uniqueIndex("social_publication_jobs_idempotency_unique").on(table.organizationId, table.idempotencyKey),
  uniqueIndex("social_publication_jobs_approval_unique").on(table.organizationId, table.approvalRequestId),
  index("social_publication_jobs_claim_idx").on(table.status, table.nextAttemptAt),
]);

export const socialAnalyticsSnapshots = pgTable("social_analytics_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull(),
  socialProfileId: uuid("social_profile_id").notNull(),
  publicationJobId: uuid("publication_job_id").notNull(),
  collectionStatus: socialAnalyticsCollectionStatus("collection_status").notNull(),
  likes: integer("likes"),
  comments: integer("comments"),
  shares: integer("shares"),
  source: text("source").notNull(),
  definitionVersion: text("definition_version").notNull(),
  coverage: text("coverage").notNull().default("post_lifetime"),
  collectedAt: timestamp("collected_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: "social_analytics_snapshots_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
  foreignKey({ name: "social_analytics_snapshots_org_profile_fk", columns: [table.organizationId, table.brandId, table.socialProfileId], foreignColumns: [socialProfiles.organizationId, socialProfiles.brandId, socialProfiles.id] }).onDelete("cascade"),
  foreignKey({ name: "social_analytics_snapshots_job_fk", columns: [table.publicationJobId], foreignColumns: [socialPublicationJobs.id] }).onDelete("cascade"),
  index("social_analytics_snapshots_org_time_idx").on(table.organizationId, table.collectedAt),
  index("social_analytics_snapshots_org_brand_time_idx").on(table.organizationId, table.brandId, table.collectedAt),
  index("social_analytics_snapshots_org_job_time_idx").on(table.organizationId, table.publicationJobId, table.collectedAt),
]);

export const competitorSources = pgTable("competitor_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull(),
  name: text("name").notNull(),
  feedUrl: text("feed_url").notNull(),
  externalProfileId: text("external_profile_id"),
  socialProfileId: uuid("social_profile_id"),
  retrievalMethod: competitorRetrievalMethod("retrieval_method").notNull().default("rss_atom"),
  status: competitorSourceStatus("status").notNull().default("active"),
  nextFetchAt: timestamp("next_fetch_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true, mode: "date" }),
  failureCount: integer("failure_count").notNull().default(0),
  lastErrorCode: text("last_error_code"),
  etag: text("etag"),
  lastModified: text("last_modified"),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: "competitor_sources_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
  foreignKey({ name: "competitor_sources_org_brand_social_profile_fk", columns: [table.organizationId, table.brandId, table.socialProfileId], foreignColumns: [socialProfiles.organizationId, socialProfiles.brandId, socialProfiles.id] }).onDelete("restrict"),
  unique("competitor_sources_org_id_brand_unique").on(table.organizationId, table.id, table.brandId),
  uniqueIndex("competitor_sources_org_brand_url_unique").on(table.organizationId, table.brandId, table.feedUrl),
  index("competitor_sources_due_idx").on(table.status, table.nextFetchAt, table.lockedAt),
]);

export const competitorFetchRuns = pgTable("competitor_fetch_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull(),
  sourceId: uuid("source_id").notNull(),
  status: competitorFetchRunStatus("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  newItemCount: integer("new_item_count").notNull().default(0),
  errorCode: text("error_code"),
}, (table) => [
  foreignKey({ name: "competitor_fetch_runs_org_source_fk", columns: [table.organizationId, table.sourceId, table.brandId], foreignColumns: [competitorSources.organizationId, competitorSources.id, competitorSources.brandId] }).onDelete("cascade"),
  index("competitor_fetch_runs_org_brand_source_time_idx").on(table.organizationId, table.brandId, table.sourceId, table.startedAt),
]);

export const competitorWorkerHeartbeat = pgTable("competitor_worker_heartbeat", {
  workerKey: text("worker_key").primaryKey(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const backgroundWorkerHeartbeats = pgTable("background_worker_heartbeats", {
  workerKey: text("worker_key").primaryKey(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const competitorAlertSettings = pgTable("competitor_alert_settings", {
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  failureThreshold: integer("failure_threshold").notNull().default(3),
  staleAfterHours: integer("stale_after_hours").notNull().default(36),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: "competitor_alert_settings_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
  unique("competitor_alert_settings_org_brand_unique").on(table.organizationId, table.brandId),
]);

export const dashboardPublicationGoals = pgTable("dashboard_publication_goals", {
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull(),
  platform: socialPlatform("platform").notNull(),
  monthlyTarget: integer("monthly_target").notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: "dashboard_publication_goals_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
  unique("dashboard_publication_goals_org_brand_platform_unique").on(table.organizationId, table.brandId, table.platform),
  check("dashboard_publication_goals_monthly_target_check", sql`${table.monthlyTarget} between 1 and 500`),
]);

export const competitorObservations = pgTable("competitor_observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull(),
  sourceId: uuid("source_id").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  sourceUrl: text("source_url").notNull(),
  contentPublishedAt: timestamp("content_published_at", { withTimezone: true, mode: "date" }),
  capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  retrievalMethod: competitorRetrievalMethod("retrieval_method").notNull(),
  dataQuality: competitorObservationDataQuality("data_quality").notNull().default("metadata_only"),
  analysisStatus: competitorObservationAnalysisStatus("analysis_status").notNull().default("pending"),
  analysisLockedAt: timestamp("analysis_locked_at", { withTimezone: true, mode: "date" }),
  analysisNextAttemptAt: timestamp("analysis_next_attempt_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  analysisAttemptCount: integer("analysis_attempt_count").notNull().default(0),
  analysisErrorCode: text("analysis_error_code"),
  analysisModel: text("analysis_model"),
  topic: competitorTopic("topic"),
  observedPatternEn: text("observed_pattern_en"),
  observedPatternPt: text("observed_pattern_pt"),
  editorialOpportunityEn: text("editorial_opportunity_en"),
  editorialOpportunityPt: text("editorial_opportunity_pt"),
}, (table) => [
  foreignKey({ name: "competitor_observations_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
  foreignKey({ name: "competitor_observations_org_source_fk", columns: [table.organizationId, table.sourceId, table.brandId], foreignColumns: [competitorSources.organizationId, competitorSources.id, competitorSources.brandId] }).onDelete("cascade"),
  uniqueIndex("competitor_observations_source_external_unique").on(table.organizationId, table.sourceId, table.externalId),
  index("competitor_observations_org_brand_date_idx").on(table.organizationId, table.brandId, table.contentPublishedAt),
  index("competitor_observations_org_brand_analysis_idx").on(table.organizationId, table.brandId, table.analysisStatus),
  index("competitor_observations_analysis_queue_idx").on(table.analysisStatus, table.analysisNextAttemptAt, table.analysisLockedAt),
]);

export const socialPublicationAttempts = pgTable("social_publication_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  outcome: text("outcome").notNull(),
  errorCode: text("error_code"),
  externalPostId: text("external_post_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: "social_publication_attempts_job_fk", columns: [table.jobId], foreignColumns: [socialPublicationJobs.id] }).onDelete("cascade"),
  uniqueIndex("social_publication_attempts_number_unique").on(table.organizationId, table.jobId, table.attemptNumber),
]);

export const socialPublicationReconciliations = pgTable("social_publication_reconciliations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull(),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "restrict" }),
  source: socialPublicationReconciliationSource("source").notNull().default("manual"),
  outcome: socialPublicationReconciliationOutcome("outcome").notNull(),
  evidence: text("evidence").notNull(),
  externalPostId: text("external_post_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: "social_publication_reconciliations_job_fk", columns: [table.jobId], foreignColumns: [socialPublicationJobs.id] }).onDelete("cascade"),
  index("social_publication_reconciliations_org_job_time_idx").on(table.organizationId, table.jobId, table.occurredAt),
]);

export const contentApprovalPolicies = pgTable(
  "content_approval_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    scopeKey: text("scope_key").notNull(),
    brandId: uuid("brand_id"),
    requiredApprovals: integer("required_approvals").notNull(),
    updatedBy: text("updated_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "content_approval_policies_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    uniqueIndex("content_approval_policies_org_scope_unique").on(table.organizationId, table.scopeKey),
    index("content_approval_policies_org_brand_idx").on(table.organizationId, table.brandId),
  ],
);

export const contentApprovalDecisions = pgTable(
  "content_approval_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    approvalRequestId: uuid("approval_request_id").notNull(),
    reviewerId: text("reviewer_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    decision: contentApprovalDecision("decision").notNull(),
    note: text("note"),
    fingerprint: text("fingerprint").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "content_approval_decisions_org_request_fk", columns: [table.organizationId, table.approvalRequestId], foreignColumns: [contentApprovalRequests.organizationId, contentApprovalRequests.id] }).onDelete("cascade"),
    uniqueIndex("content_approval_decisions_org_request_reviewer_unique").on(table.organizationId, table.approvalRequestId, table.reviewerId),
    index("content_approval_decisions_request_time_idx").on(table.organizationId, table.approvalRequestId, table.occurredAt),
  ],
);

export const contentMediaAssets = pgTable(
  "content_media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    contentItemId: uuid("content_item_id").notNull(),
    contentVersionId: uuid("content_version_id").notNull(),
    carouselId: uuid("carousel_id"),
    pageNumber: integer("page_number"),
    pageCount: integer("page_count"),
    idempotencyKey: uuid("idempotency_key").notNull(),
    objectKey: text("object_key").notNull().unique(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    sha256: text("sha256"),
    prompt: text("prompt").notNull(),
    modelId: text("model_id").notNull(),
    status: contentMediaStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    failureCode: text("failure_code"),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    foreignKey({ name: "content_media_org_item_brand_fk", columns: [table.organizationId, table.contentItemId, table.brandId], foreignColumns: [contentItems.organizationId, contentItems.id, contentItems.brandId] }).onDelete("cascade"),
    foreignKey({ name: "content_media_org_version_item_brand_fk", columns: [table.organizationId, table.contentVersionId, table.contentItemId, table.brandId], foreignColumns: [contentVersions.organizationId, contentVersions.id, contentVersions.contentItemId, contentVersions.brandId] }).onDelete("cascade"),
    unique("content_media_org_id_brand_unique").on(table.organizationId, table.id, table.brandId),
    uniqueIndex("content_media_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    uniqueIndex("content_media_carousel_page_unique").on(table.organizationId, table.carouselId, table.pageNumber),
    index("content_media_version_created_idx").on(table.organizationId, table.contentVersionId, table.createdAt),
    index("content_media_queue_idx").on(table.status, table.availableAt, table.createdAt),
  ],
);

export const contentMediaReviews = pgTable(
  "content_media_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    mediaAssetId: uuid("media_asset_id").notNull(),
    reviewerId: text("reviewer_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    decision: contentMediaReviewDecision("decision").notNull(),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "content_media_reviews_org_asset_fk", columns: [table.organizationId, table.mediaAssetId, table.brandId], foreignColumns: [contentMediaAssets.organizationId, contentMediaAssets.id, contentMediaAssets.brandId] }).onDelete("cascade"),
    index("content_media_reviews_org_asset_time_idx").on(table.organizationId, table.mediaAssetId, table.occurredAt),
  ],
);

export const brandAssets = pgTable(
  "brand_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    status: brandAssetStatus("status").notNull().default(BRAND_ASSET_STATUS.uploadPending),
    kind: brandAssetKind("kind").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    sha256: text("sha256").notNull(),
    objectKey: text("object_key").notNull().unique(),
    uploadKey: text("upload_key").notNull().unique(),
    sourceUrl: text("source_url"),
    license: text("license"),
    rightsExpiresAt: date("rights_expires_at", { mode: "string" }),
    altText: text("alt_text"),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    foreignKey({ name: "brand_assets_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    unique("brand_assets_org_brand_id_unique").on(table.organizationId, table.brandId, table.id),
    index("brand_assets_org_brand_created_idx").on(table.organizationId, table.brandId, table.createdAt),
    index("brand_assets_org_brand_status_idx").on(table.organizationId, table.brandId, table.status),
    index("brand_assets_checksum_identity_idx").on(table.organizationId, table.brandId, table.sha256),
  ],
);

export const brandAssetReviews = pgTable(
  "brand_asset_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    reviewerId: text("reviewer_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    decision: brandAssetReviewDecision("decision").notNull(),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "brand_asset_reviews_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    foreignKey({ name: "brand_asset_reviews_asset_fk", columns: [table.organizationId, table.brandId, table.assetId], foreignColumns: [brandAssets.organizationId, brandAssets.brandId, brandAssets.id] }).onDelete("cascade"),
    index("brand_asset_reviews_org_asset_time_idx").on(table.organizationId, table.assetId, table.occurredAt),
  ],
);

export const brandRelations = relations(brands, ({ many }) => ({ socialProfiles: many(socialProfiles), contentItems: many(contentItems), brandKitVersions: many(brandKitVersions), assets: many(brandAssets) }));
export const campaignRelations = relations(campaigns, ({ one, many }) => ({
  brand: one(brands, { fields: [campaigns.brandId], references: [brands.id] }),
  items: many(contentItems),
}));
export const contentItemRelations = relations(contentItems, ({ one }) => ({
  brand: one(brands, { fields: [contentItems.brandId], references: [brands.id] }),
  campaign: one(campaigns, { fields: [contentItems.campaignId], references: [campaigns.id] }),
  creator: one(user, { fields: [contentItems.createdBy], references: [user.id] }),
}));
export const contentVersionRelations = relations(contentVersions, ({ one, many }) => ({
  item: one(contentItems, { fields: [contentVersions.contentItemId], references: [contentItems.id] }),
  brand: one(brands, { fields: [contentVersions.brandId], references: [brands.id] }),
  variants: many(contentVariants),
}));
export const contentVariantRelations = relations(contentVariants, ({ one }) => ({
  version: one(contentVersions, { fields: [contentVariants.contentVersionId], references: [contentVersions.id] }),
}));
export const contentMediaAssetRelations = relations(contentMediaAssets, ({ one, many }) => ({
  item: one(contentItems, { fields: [contentMediaAssets.contentItemId], references: [contentItems.id] }),
  version: one(contentVersions, { fields: [contentMediaAssets.contentVersionId], references: [contentVersions.id] }),
  reviews: many(contentMediaReviews),
}));
export const contentMediaReviewRelations = relations(contentMediaReviews, ({ one }) => ({
  mediaAsset: one(contentMediaAssets, { fields: [contentMediaReviews.mediaAssetId], references: [contentMediaAssets.id] }),
}));
export const socialProfileRelations = relations(socialProfiles, ({ one }) => ({
  brand: one(brands, { fields: [socialProfiles.brandId], references: [brands.id] }),
}));
export const brandKitVersionRelations = relations(brandKitVersions, ({ one }) => ({
  brand: one(brands, { fields: [brandKitVersions.brandId], references: [brands.id] }),
}));
export const brandAssetRelations = relations(brandAssets, ({ one }) => ({
  brand: one(brands, { fields: [brandAssets.brandId], references: [brands.id] }),
}));
