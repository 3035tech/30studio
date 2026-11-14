import { relations } from "drizzle-orm";
import { boolean, date, foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { BRAND_ASSET_KINDS, BRAND_ASSET_REVIEW_DECISIONS, BRAND_ASSET_STATUSES, BRAND_ASSET_STATUS, BRAND_KIT_VERSION_STATUSES, BRAND_KIT_VERSION_STATUS, CONTENT_STATUSES, CONTENT_STATUS, SOCIAL_PLATFORMS, SOCIAL_PROFILE_STATUSES, TEAM_AUDIT_ACTION_VALUES } from "@/lib/constants";
import { organization, user } from "@/lib/db/auth-schema";
import type { BrandKitContent } from "@/lib/validation/brand-kits";

export * from "@/lib/db/auth-schema";

export const socialPlatform = pgEnum("social_platform", SOCIAL_PLATFORMS);
export const socialProfileStatus = pgEnum("social_profile_status", SOCIAL_PROFILE_STATUSES);
export const teamAuditAction = pgEnum("team_audit_action", TEAM_AUDIT_ACTION_VALUES);
export const brandKitVersionStatus = pgEnum("brand_kit_version_status", BRAND_KIT_VERSION_STATUSES);
export const brandAssetStatus = pgEnum("brand_asset_status", BRAND_ASSET_STATUSES);
export const brandAssetKind = pgEnum("brand_asset_kind", BRAND_ASSET_KINDS);
export const brandAssetReviewDecision = pgEnum("brand_asset_review_decision", BRAND_ASSET_REVIEW_DECISIONS);
export const contentStatus = pgEnum("content_status", CONTENT_STATUSES);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    industry: text("industry"),
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

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
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
    status: socialProfileStatus("status").notNull().default("not_connected"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: "social_profiles_org_brand_fk", columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    index("social_profiles_organization_brand_idx").on(table.organizationId, table.brandId),
    uniqueIndex("social_profiles_identity_unique").on(table.brandId, table.platform, table.handle),
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
export const contentItemRelations = relations(contentItems, ({ one }) => ({
  brand: one(brands, { fields: [contentItems.brandId], references: [brands.id] }),
  creator: one(user, { fields: [contentItems.createdBy], references: [user.id] }),
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
