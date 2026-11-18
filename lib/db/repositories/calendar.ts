import "server-only";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { BRAND_KIT_VERSION_STATUS, CONTENT_EDITABLE_STATUSES, CONTENT_LIMITS, CONTENT_REVIEWABLE_STATUSES, CONTENT_STATUS, SOCIAL_PUBLICATION_JOB_STATUS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { getCampaignRequestFingerprint } from "@/lib/server/campaign-idempotency";
import { getContentApprovalState } from "@/lib/db/repositories/content-approvals";
import { getSocialCapabilitySnapshot } from "@/lib/server/social-publisher/registry";
import { brandKitVersions, brands, campaigns, contentItems, contentVariants, contentVersions, socialPublicationJobs } from "@/lib/db/schema";
import type { CalendarCampaignCreateInput, CalendarContentVersionSaveInput, CalendarItemCreateInput, CalendarItemUpdateInput } from "@/lib/validation/calendar";

export type CalendarQuery = {
  start: Date;
  end: Date;
  brandId?: string;
  platform?: CalendarItemCreateInput["platform"];
  status?: typeof CONTENT_STATUS[keyof typeof CONTENT_STATUS];
  publicationStatus?: typeof SOCIAL_PUBLICATION_JOB_STATUS[keyof typeof SOCIAL_PUBLICATION_JOB_STATUS];
};

export async function listCalendarItems(organizationId: string, query: CalendarQuery) {
  const database = getDatabase();
  const conditions = [
    eq(contentItems.organizationId, organizationId),
    eq(brands.isActive, true),
    gte(contentItems.plannedAt, query.start),
    lt(contentItems.plannedAt, query.end),
  ];
  if (query.brandId) conditions.push(eq(contentItems.brandId, query.brandId));
  if (query.platform) conditions.push(eq(contentItems.platform, query.platform));
  if (query.status) conditions.push(eq(contentItems.status, query.status));
  if (query.publicationStatus) conditions.push(inArray(contentItems.id, database.select({ contentItemId: socialPublicationJobs.contentItemId }).from(socialPublicationJobs).where(and(
    eq(socialPublicationJobs.organizationId, organizationId), eq(socialPublicationJobs.status, query.publicationStatus),
  ))));

  const rows = await database.select({
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

  const publicationRows = rows.length === 0 ? [] : await database.select({
    contentItemId: socialPublicationJobs.contentItemId,
    status: socialPublicationJobs.status,
  }).from(socialPublicationJobs).where(and(
    eq(socialPublicationJobs.organizationId, organizationId),
    inArray(socialPublicationJobs.contentItemId, rows.map((row) => row.id)),
  )).orderBy(desc(socialPublicationJobs.createdAt));
  const latestPublicationStatus = new Map<string, typeof publicationRows[number]["status"]>();
  for (const publication of publicationRows) {
    if (!latestPublicationStatus.has(publication.contentItemId)) latestPublicationStatus.set(publication.contentItemId, publication.status);
  }

  return {
    data: rows.slice(0, CONTENT_LIMITS.maximumCalendarItems).map((row) => ({ ...row, publicationStatus: latestPublicationStatus.get(row.id) ?? null })),
    truncated: rows.length > CONTENT_LIMITS.maximumCalendarItems,
  };
}

export async function createCalendarCampaign(organizationId: string, userId: string, input: CalendarCampaignCreateInput) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const { idempotencyKey, ...requestPayload } = input;
    const requestFingerprint = getCampaignRequestFingerprint(requestPayload);
    const [previousCampaign] = await transaction.select({
      id: campaigns.id,
      requestFingerprint: campaigns.requestFingerprint,
    }).from(campaigns).where(and(
      eq(campaigns.organizationId, organizationId),
      eq(campaigns.createdBy, userId),
      eq(campaigns.idempotencyKey, idempotencyKey),
    )).limit(1);
    if (previousCampaign) {
      if (previousCampaign.requestFingerprint !== requestFingerprint) return { kind: "conflict" as const };
      const publications = await transaction.select({ id: contentItems.id, platform: contentItems.platform }).from(contentItems).where(and(
        eq(contentItems.organizationId, organizationId),
        eq(contentItems.campaignId, previousCampaign.id),
      )).orderBy(asc(contentItems.plannedAt));
      return { kind: "replayed" as const, campaignId: previousCampaign.id, publications, replayed: true };
    }

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
      idempotencyKey,
      requestFingerprint,
      createdBy: userId,
    }).onConflictDoNothing().returning({ id: campaigns.id });
    if (!campaign) {
      const [concurrentCampaign] = await transaction.select({ id: campaigns.id, requestFingerprint: campaigns.requestFingerprint }).from(campaigns).where(and(
        eq(campaigns.organizationId, organizationId),
        eq(campaigns.createdBy, userId),
        eq(campaigns.idempotencyKey, idempotencyKey),
      )).limit(1);
      if (!concurrentCampaign) return null;
      if (concurrentCampaign.requestFingerprint !== requestFingerprint) return { kind: "conflict" as const };
      const publications = await transaction.select({ id: contentItems.id, platform: contentItems.platform }).from(contentItems).where(and(
        eq(contentItems.organizationId, organizationId),
        eq(contentItems.campaignId, concurrentCampaign.id),
      )).orderBy(asc(contentItems.plannedAt));
      return { kind: "replayed" as const, campaignId: concurrentCampaign.id, publications, replayed: true };
    }

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
    return { kind: "created" as const, campaignId: campaign.id, publications, replayed: false };
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
  const [item] = await database.select({ id: contentItems.id, platform: contentItems.platform, status: contentItems.status }).from(contentItems).where(and(
    eq(contentItems.id, itemId),
    eq(contentItems.organizationId, organizationId),
    inArray(contentItems.status, CONTENT_REVIEWABLE_STATUSES),
  )).limit(1);
  if (!item) return null;

  const versions = await database.select({
    id: contentVersions.id,
    versionNumber: contentVersions.versionNumber,
    brandKitVersionNumber: contentVersions.brandKitVersionNumber,
    capabilitySnapshot: contentVersions.capabilitySnapshot,
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
    itemStatus: item.status,
    current: current && currentVariant ? {
      id: current.id,
      versionNumber: current.versionNumber,
      brandKitVersionNumber: current.brandKitVersionNumber,
      capabilitySnapshot: current.capabilitySnapshot,
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
    approval: await getContentApprovalState(organizationId, itemId),
  };
}

export async function getCalendarCopyGenerationContext(organizationId: string, itemId: string, brandId: string) {
  const database = getDatabase();
  const [item] = await database.select({
    brandId: contentItems.brandId,
    title: contentItems.title,
    campaignId: contentItems.campaignId,
    campaignBrief: campaigns.brief,
  }).from(contentItems).innerJoin(brands, and(
    eq(brands.organizationId, contentItems.organizationId),
    eq(brands.id, contentItems.brandId),
  )).leftJoin(campaigns, and(
    eq(campaigns.organizationId, contentItems.organizationId),
    eq(campaigns.id, contentItems.campaignId),
    eq(campaigns.brandId, contentItems.brandId),
  )).where(and(
    eq(contentItems.organizationId, organizationId),
    eq(contentItems.id, itemId),
    eq(brands.isActive, true),
    inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
  )).limit(1);
  if (!item) return null;
  if (item.campaignId && item.brandId !== brandId) return null;

  const [brand] = await database.select({
    id: brands.id,
    name: brands.name,
    description: brands.description,
    industry: brands.industry,
  }).from(brands).where(and(
    eq(brands.organizationId, organizationId),
    eq(brands.id, brandId),
    eq(brands.isActive, true),
  )).limit(1);
  if (!brand) return null;

  const [brandKit] = await database.select({ version: brandKitVersions.version, content: brandKitVersions.content }).from(brandKitVersions).where(and(
    eq(brandKitVersions.organizationId, organizationId),
    eq(brandKitVersions.brandId, brandId),
    eq(brandKitVersions.status, BRAND_KIT_VERSION_STATUS.approved),
  )).orderBy(desc(brandKitVersions.version)).limit(1);

  return { title: item.title, campaignBrief: item.campaignBrief, brandId: brand.id, brandName: brand.name, brandDescription: brand.description, industry: brand.industry, brandKit };
}

export async function getCalendarContentReviewContext(organizationId: string, itemId: string) {
  const database = getDatabase();
  const [item] = await database.select({
    id: contentItems.id,
    brandId: contentItems.brandId,
    title: contentItems.title,
    platform: contentItems.platform,
    status: contentItems.status,
    brandName: brands.name,
    brandDescription: brands.description,
    industry: brands.industry,
  }).from(contentItems).innerJoin(brands, and(
    eq(brands.organizationId, contentItems.organizationId),
    eq(brands.id, contentItems.brandId),
  )).where(and(
    eq(contentItems.organizationId, organizationId),
    eq(contentItems.id, itemId),
    eq(brands.isActive, true),
    inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
  )).limit(1);
  if (!item) return null;
  const [version] = await database.select({
    id: contentVersions.id,
    versionNumber: contentVersions.versionNumber,
    brandKitVersionNumber: contentVersions.brandKitVersionNumber,
    canonicalCopy: contentVersions.canonicalCopy,
    variantCopy: contentVariants.copy,
  }).from(contentVersions).innerJoin(contentVariants, and(
    eq(contentVariants.organizationId, contentVersions.organizationId),
    eq(contentVariants.contentVersionId, contentVersions.id),
    eq(contentVariants.platform, item.platform),
  )).where(and(
    eq(contentVersions.organizationId, organizationId),
    eq(contentVersions.contentItemId, itemId),
  )).orderBy(desc(contentVersions.versionNumber)).limit(1);
  if (!version) return null;
  const [brandKit] = version.brandKitVersionNumber === null ? [] : await database.select({ version: brandKitVersions.version, content: brandKitVersions.content }).from(brandKitVersions).where(and(
    eq(brandKitVersions.organizationId, organizationId),
    eq(brandKitVersions.brandId, item.brandId),
    eq(brandKitVersions.version, version.brandKitVersionNumber),
  )).limit(1);
  return { item, version, brandKit: brandKit ?? null };
}

export * from "./content-media";

export async function createCalendarContentVersion(organizationId: string, userId: string, itemId: string, input: CalendarContentVersionSaveInput) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [item] = await transaction.select({ id: contentItems.id, brandId: contentItems.brandId, campaignId: contentItems.campaignId, platform: contentItems.platform }).from(contentItems).where(and(
      eq(contentItems.id, itemId),
      eq(contentItems.organizationId, organizationId),
      inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
    )).for("update").limit(1);
    if (!item) return null;
    if (item.campaignId && (item.brandId !== input.brandId || item.platform !== input.platform)) return { kind: "conflict" as const };

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
    if ((latestVersion?.versionNumber ?? 0) !== input.expectedVersionNumber) return { kind: "conflict" as const };
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
      capabilitySnapshot: getSocialCapabilitySnapshot(input.platform),
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
    return updatedItem ? { kind: "created" as const, id: version.id, versionNumber } : null;
  });
}
