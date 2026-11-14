import { relations } from "drizzle-orm";
import { boolean, foreignKey, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { SOCIAL_PLATFORMS, SOCIAL_PROFILE_STATUSES } from "@/lib/constants";
import { organization, user } from "@/lib/db/auth-schema";

export * from "@/lib/db/auth-schema";

export const socialPlatform = pgEnum("social_platform", SOCIAL_PLATFORMS);
export const socialProfileStatus = pgEnum("social_profile_status", SOCIAL_PROFILE_STATUSES);

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
    uniqueIndex("brands_organization_id_unique").on(table.organizationId, table.id),
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
    foreignKey({ columns: [table.organizationId, table.brandId], foreignColumns: [brands.organizationId, brands.id] }).onDelete("cascade"),
    index("social_profiles_organization_brand_idx").on(table.organizationId, table.brandId),
    uniqueIndex("social_profiles_identity_unique").on(table.brandId, table.platform, table.handle),
  ],
);

export const brandRelations = relations(brands, ({ many }) => ({ socialProfiles: many(socialProfiles) }));
export const socialProfileRelations = relations(socialProfiles, ({ one }) => ({
  brand: one(brands, { fields: [socialProfiles.brandId], references: [brands.id] }),
}));
