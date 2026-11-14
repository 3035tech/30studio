import "server-only";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { BRAND_KIT_VERSION_STATUS, CONTENT_EDITABLE_STATUSES, CONTENT_LIMITS, CONTENT_STATUS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brandKitVersions, brands, campaigns, contentItems, contentVariants, contentVersions } from "@/lib/db/schema";
import type { CalendarCampaignCreateInput, CalendarContentVersionSaveInput, CalendarItemCreateInput, CalendarItemUpdateInput } from "@/lib/validation/calendar";

export type CalendarQuery = {
  start: Date;
  end: Date;
  brandId?: string;
  platform?: CalendarItemCreateInput["platform"];
  status?: typeof CONTENT_STATUS[keyof typeof CONTENT_STATUS];
};

export async function listCalendarItems(organizationId: string, query: CalendarQuery) {
  const conditions = [
    eq(contentItems.organizationId, organizationId),
    eq(brands.isActive, true),
    gte(contentItems.plannedAt, query.start),
    lt(contentItems.plannedAt, query.end),
  ];
  if (query.brandId) conditions.push(eq(contentItems.brandId, query.brandId));
  if (query.platform) conditions.push(eq(contentItems.platform, query.platform));
  if (query.status) conditions.push(eq(contentItems.status, query.status));

  const rows = await getDatabase().select({
    id: contentItems.id,
    brandId: contentItems.brandId,
    brandName: brands.name,
    campaignId: contentItems.campaignId,
    campaignTitle: campaigns.title,
    platform: contentItems.platform,
    title: contentItems.title,
    status: contentItems.status,
    plannedAt: contentItems.plannedAt,
    timeZone: contentItems.timeZone,
    createdAt: contentItems.createdAt,
  }).from(contentItems).innerJoin(brands, and(
    eq(brands.organizationId, contentItems.organizationId),
    eq(brands.id, contentItems.brandId),
  )).leftJoin(campaigns, and(
    eq(campaigns.organizationId, contentItems.organizationId),
    eq(campaigns.id, contentItems.campaignId),
    eq(campaigns.brandId, contentItems.brandId),
  )).where(and(...conditions)).orderBy(asc(contentItems.plannedAt), asc(contentItems.createdAt))
    .limit(CONTENT_LIMITS.maximumCalendarItems + 1);

  return {
    data: rows.slice(0, CONTENT_LIMITS.maximumCalendarItems),
    truncated: rows.length > CONTENT_LIMITS.maximumCalendarItems,
  };
}

export async function createCalendarCampaign(organizationId: string, userId: string, input: CalendarCampaignCreateInput) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [brand] = await transaction.select({ id: brands.id }).from(brands).where(and(
      eq(brands.organizationId, organizationId),
      eq(brands.id, input.brandId),
      eq(brands.isActive, true),
    )).for("update").limit(1);
    if (!brand) return null;

    const [campaign] = await transaction.insert(campaigns).values({
      organizationId,
      brandId: input.brandId,
      title: input.title,
      brief: input.brief,
      createdBy: userId,
    }).returning({ id: campaigns.id });
    if (!campaign) return null;

    const publications = await transaction.insert(contentItems).values(input.publications.map((publication) => ({
      organizationId,
      brandId: input.brandId,
      campaignId: campaign.id,
      platform: publication.platform,
      title: input.title,
      status: CONTENT_STATUS.idea,
      plannedAt: new Date(publication.plannedAt),
      timeZone: publication.timeZone,
      createdBy: userId,
    }))).returning({ id: contentItems.id, platform: contentItems.platform });
    return { campaignId: campaign.id, publications };
  });
}

export async function createCalendarIdea(organizationId: string, userId: string, input: CalendarItemCreateInput) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [brand] = await transaction.select({ id: brands.id }).from(brands).where(and(
      eq(brands.organizationId, organizationId),
      eq(brands.id, input.brandId),
      eq(brands.isActive, true),
    )).for("update").limit(1);
    if (!brand) return null;

    const [item] = await transaction.insert(contentItems).values({
      organizationId,
      brandId: input.brandId,
      platform: input.platform,
      title: input.title,
      status: CONTENT_STATUS.idea,
      plannedAt: new Date(input.plannedAt),
      timeZone: input.timeZone,
      createdBy: userId,
    }).returning({ id: contentItems.id });
    return item ?? null;
  });
}

export async function updateCalendarIdea(organizationId: string, itemId: string, input: CalendarItemUpdateInput) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [existing] = await transaction.select({ id: contentItems.id }).from(contentItems).where(and(
      eq(contentItems.id, itemId),
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.status, CONTENT_STATUS.idea),
    )).for("update").limit(1);
    if (!existing) return null;

    const [brand] = await transaction.select({ id: brands.id }).from(brands).where(and(
      eq(brands.organizationId, organizationId),
      eq(brands.id, input.brandId),
      eq(brands.isActive, true),
    )).for("update").limit(1);
    if (!brand) return null;

    const [item] = await transaction.update(contentItems).set({
      brandId: input.brandId,
      platform: input.platform,
      title: input.title,
      plannedAt: new Date(input.plannedAt),
      timeZone: input.timeZone,
      updatedAt: new Date(),
    }).where(and(
      eq(contentItems.id, itemId),
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.status, CONTENT_STATUS.idea),
    )).returning({ id: contentItems.id });
    return item ?? null;
  });
}

export async function getCalendarContentVersions(organizationId: string, itemId: string) {
  const database = getDatabase();
  const [item] = await database.select({ id: contentItems.id, platform: contentItems.platform }).from(contentItems).where(and(
    eq(contentItems.id, itemId),
    eq(contentItems.organizationId, organizationId),
    inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
  )).limit(1);
  if (!item) return null;

  const versions = await database.select({
    id: contentVersions.id,
    versionNumber: contentVersions.versionNumber,
    brandKitVersionNumber: contentVersions.brandKitVersionNumber,
    canonicalCopy: contentVersions.canonicalCopy,
    createdAt: contentVersions.createdAt,
  }).from(contentVersions).where(and(
    eq(contentVersions.organizationId, organizationId),
    eq(contentVersions.contentItemId, itemId),
  )).orderBy(desc(contentVersions.versionNumber)).limit(CONTENT_LIMITS.maximumContentVersionsInHistory);

  const variants = versions.length === 0 ? [] : await database.select({
    contentVersionId: contentVariants.contentVersionId,
    platform: contentVariants.platform,
    copy: contentVariants.copy,
  }).from(contentVariants).where(and(
    eq(contentVariants.organizationId, organizationId),
    inArray(contentVariants.contentVersionId, versions.map((version) => version.id)),
  ));
  const variantByVersion = new Map(variants.map((variant) => [variant.contentVersionId, variant]));
  const current = versions[0];
  const currentVariant = current ? variantByVersion.get(current.id) : undefined;

  return {
    current: current && currentVariant ? {
      versionNumber: current.versionNumber,
      brandKitVersionNumber: current.brandKitVersionNumber,
      canonicalCopy: current.canonicalCopy,
      variantCopy: currentVariant.copy,
      platform: currentVariant.platform,
      createdAt: current.createdAt.toISOString(),
    } : null,
    history: versions.map((version) => {
      const variant = variantByVersion.get(version.id);
      return variant ? {
        versionNumber: version.versionNumber,
        platform: variant.platform,
        createdAt: version.createdAt.toISOString(),
      } : null;
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  };
}

export async function createCalendarContentVersion(organizationId: string, userId: string, itemId: string, input: CalendarContentVersionSaveInput) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [item] = await transaction.select({ id: contentItems.id }).from(contentItems).where(and(
      eq(contentItems.id, itemId),
      eq(contentItems.organizationId, organizationId),
      inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
    )).for("update").limit(1);
    if (!item) return null;

    const [brand] = await transaction.select({ id: brands.id }).from(brands).where(and(
      eq(brands.organizationId, organizationId),
      eq(brands.id, input.brandId),
      eq(brands.isActive, true),
    )).for("update").limit(1);
    if (!brand) return null;

    const [latestVersion] = await transaction.select({ versionNumber: contentVersions.versionNumber }).from(contentVersions).where(and(
      eq(contentVersions.organizationId, organizationId),
      eq(contentVersions.contentItemId, itemId),
    )).orderBy(desc(contentVersions.versionNumber)).limit(1);
    const [brandKitVersion] = await transaction.select({ version: brandKitVersions.version }).from(brandKitVersions).where(and(
      eq(brandKitVersions.organizationId, organizationId),
      eq(brandKitVersions.brandId, input.brandId),
      eq(brandKitVersions.status, BRAND_KIT_VERSION_STATUS.approved),
    )).orderBy(desc(brandKitVersions.version)).limit(1);
    const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const [version] = await transaction.insert(contentVersions).values({
      organizationId,
      contentItemId: itemId,
      brandId: input.brandId,
      versionNumber,
      canonicalCopy: input.canonicalCopy,
      brandKitVersionNumber: brandKitVersion?.version ?? null,
      createdBy: userId,
    }).returning({ id: contentVersions.id });
    if (!version) return null;

    await transaction.insert(contentVariants).values({
      organizationId,
      contentVersionId: version.id,
      platform: input.platform,
      copy: input.variantCopy,
    });
    const [updatedItem] = await transaction.update(contentItems).set({
      brandId: input.brandId,
      platform: input.platform,
      title: input.title,
      status: CONTENT_STATUS.draft,
      plannedAt: new Date(input.plannedAt),
      timeZone: input.timeZone,
      updatedAt: new Date(),
    }).where(and(
      eq(contentItems.id, itemId),
      eq(contentItems.organizationId, organizationId),
      inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
    )).returning({ id: contentItems.id });
    return updatedItem ? { id: version.id, versionNumber } : null;
  });
}
