import { relations } from "drizzle-orm";
import { boolean, foreignKey, index, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { SOCIAL_PLATFORMS, SOCIAL_PROFILE_STATUSES, TEAM_AUDIT_ACTION_VALUES } from "@/lib/constants";
import { organization, user } from "@/lib/db/auth-schema";

export * from "@/lib/db/auth-schema";

export const socialPlatform = pgEnum("social_platform", SOCIAL_PLATFORMS);
export const socialProfileStatus = pgEnum("social_profile_status", SOCIAL_PROFILE_STATUSES);
export const teamAuditAction = pgEnum("team_audit_action", TEAM_AUDIT_ACTION_VALUES);

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

export const brandRelations = relations(brands, ({ many }) => ({ socialProfiles: many(socialProfiles) }));
export const socialProfileRelations = relations(socialProfiles, ({ one }) => ({
  brand: one(brands, { fields: [socialProfiles.brandId], references: [brands.id] }),
}));
