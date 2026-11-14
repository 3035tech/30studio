import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { BRAND_KIT_VERSION_STATUS, CONTENT_EDITABLE_STATUSES, CONTENT_LIMITS, CONTENT_MEDIA_RETRY_DELAYS_MS, CONTENT_MEDIA_STATUS, CONTENT_MEDIA_WORKER, CONTENT_STATUS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brandKitVersions, brands, campaigns, contentItems, contentMediaAssets, contentMediaReviews, contentVariants, contentVersions, user } from "@/lib/db/schema";
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
      id: current.id,
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

export async function getContentImageGenerationContext(organizationId: string, itemId: string, contentVersionId: string) {
  const database = getDatabase();
  const [item] = await database.select({
    brandId: contentItems.brandId,
    title: contentItems.title,
    campaignBrief: campaigns.brief,
    brandName: brands.name,
    brandDescription: brands.description,
    industry: brands.industry,
    canonicalCopy: contentVersions.canonicalCopy,
    brandKitVersionNumber: contentVersions.brandKitVersionNumber,
    platform: contentVariants.platform,
    variantCopy: contentVariants.copy,
  }).from(contentItems).innerJoin(brands, and(
    eq(brands.organizationId, contentItems.organizationId),
    eq(brands.id, contentItems.brandId),
  )).innerJoin(contentVersions, and(
    eq(contentVersions.organizationId, contentItems.organizationId),
    eq(contentVersions.contentItemId, contentItems.id),
    eq(contentVersions.brandId, contentItems.brandId),
    eq(contentVersions.id, contentVersionId),
  )).innerJoin(contentVariants, and(
    eq(contentVariants.organizationId, contentVersions.organizationId),
    eq(contentVariants.contentVersionId, contentVersions.id),
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

  const [brandKit] = item.brandKitVersionNumber === null ? [] : await database.select({ content: brandKitVersions.content }).from(brandKitVersions).where(and(
    eq(brandKitVersions.organizationId, organizationId),
    eq(brandKitVersions.brandId, item.brandId),
    eq(brandKitVersions.version, item.brandKitVersionNumber),
  )).limit(1);

  return { ...item, brandKit: brandKit?.content ?? null };
}

export async function enqueueContentMediaGeneration(input: {
  organizationId: string;
  itemId: string;
  contentVersionId: string;
  idempotencyKey: string;
  userId: string;
  modelId: string;
  prompt: string;
}) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [item] = await transaction.select({ brandId: contentItems.brandId }).from(contentItems).where(and(
      eq(contentItems.organizationId, input.organizationId),
      eq(contentItems.id, input.itemId),
      inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
    )).for("update").limit(1);
    if (!item) return { kind: "not_found" as const };

    const [existingRequest] = await transaction.select({ id: contentMediaAssets.id, status: contentMediaAssets.status, contentVersionId: contentMediaAssets.contentVersionId, contentItemId: contentMediaAssets.contentItemId }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, input.organizationId),
      eq(contentMediaAssets.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (existingRequest) {
      if (existingRequest.contentVersionId !== input.contentVersionId || existingRequest.contentItemId !== input.itemId) return { kind: "conflict" as const };
      return { kind: "existing" as const, assetId: existingRequest.id, status: existingRequest.status };
    }

    const [latestVersion] = await transaction.select({ id: contentVersions.id }).from(contentVersions).where(and(
      eq(contentVersions.organizationId, input.organizationId),
      eq(contentVersions.contentItemId, input.itemId),
    )).orderBy(desc(contentVersions.versionNumber)).limit(1);
    if (!latestVersion || latestVersion.id !== input.contentVersionId) return { kind: "conflict" as const };

    const [generatedCount] = await transaction.select({ value: count() }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, input.organizationId),
      eq(contentMediaAssets.contentVersionId, input.contentVersionId),
    ));
    if ((generatedCount?.value ?? 0) >= CONTENT_LIMITS.maximumGeneratedImagesPerVersion) return { kind: "limit" as const };

    const [asset] = await transaction.insert(contentMediaAssets).values({
      organizationId: input.organizationId,
      brandId: item.brandId,
      contentItemId: input.itemId,
      contentVersionId: input.contentVersionId,
      idempotencyKey: input.idempotencyKey,
      objectKey: `tenants/${encodeURIComponent(input.organizationId)}/brands/${item.brandId}/content/${input.itemId}/${input.contentVersionId}/${input.idempotencyKey}.webp`,
      fileName: `${input.idempotencyKey}.webp`,
      prompt: input.prompt,
      modelId: input.modelId,
      status: CONTENT_MEDIA_STATUS.queued,
      createdBy: input.userId,
    }).returning({ id: contentMediaAssets.id, status: contentMediaAssets.status });
    return asset ? { kind: "created" as const, assetId: asset.id, status: asset.status } : { kind: "not_found" as const };
  });
}

export async function listContentMediaForVersion(organizationId: string, itemId: string, contentVersionId: string) {
  const creator = user;
  const rows = await getDatabase().select({
    id: contentMediaAssets.id,
    status: contentMediaAssets.status,
    fileName: contentMediaAssets.fileName,
    contentType: contentMediaAssets.contentType,
    sizeBytes: contentMediaAssets.sizeBytes,
    width: contentMediaAssets.width,
    height: contentMediaAssets.height,
    createdAt: contentMediaAssets.createdAt,
    createdByName: creator.name,
    reviewedAt: contentMediaAssets.reviewedAt,
    reviewedBy: contentMediaAssets.reviewedBy,
    objectKey: contentMediaAssets.objectKey,
  }).from(contentMediaAssets).innerJoin(creator, eq(creator.id, contentMediaAssets.createdBy)).where(and(
    eq(contentMediaAssets.organizationId, organizationId),
    eq(contentMediaAssets.contentItemId, itemId),
    eq(contentMediaAssets.contentVersionId, contentVersionId),
  )).orderBy(asc(contentMediaAssets.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null }));
}

export async function getContentMediaForTenant(organizationId: string, itemId: string, mediaId: string) {
  const [asset] = await getDatabase().select().from(contentMediaAssets).where(and(
    eq(contentMediaAssets.organizationId, organizationId),
    eq(contentMediaAssets.contentItemId, itemId),
    eq(contentMediaAssets.id, mediaId),
  )).limit(1);
  return asset ?? null;
}

export async function reviewContentMedia(organizationId: string, itemId: string, mediaId: string, reviewerId: string, decision: typeof CONTENT_MEDIA_STATUS.approved | typeof CONTENT_MEDIA_STATUS.rejected, note: string | null) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [asset] = await transaction.select({ id: contentMediaAssets.id, brandId: contentMediaAssets.brandId }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, organizationId),
      eq(contentMediaAssets.contentItemId, itemId),
      eq(contentMediaAssets.id, mediaId),
      eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.pendingReview),
    )).for("update").limit(1);
    if (!asset) return null;
    const [reviewed] = await transaction.update(contentMediaAssets).set({
      status: decision,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    }).where(and(
      eq(contentMediaAssets.organizationId, organizationId),
      eq(contentMediaAssets.id, mediaId),
      eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.pendingReview),
    )).returning({ id: contentMediaAssets.id });
    if (!reviewed) return null;
    await transaction.insert(contentMediaReviews).values({ organizationId, brandId: asset.brandId, mediaAssetId: mediaId, reviewerId, decision, note });
    return reviewed;
  });
}

export async function claimNextContentMediaJob(now: Date, organizationId?: string) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const leaseCutoff = new Date(now.getTime() - CONTENT_MEDIA_WORKER.leaseMilliseconds);
    const [job] = await transaction.select().from(contentMediaAssets).where(and(
      ...(organizationId ? [eq(contentMediaAssets.organizationId, organizationId)] : []),
      inArray(contentMediaAssets.status, [CONTENT_MEDIA_STATUS.queued, CONTENT_MEDIA_STATUS.processing]),
      lt(contentMediaAssets.attempts, CONTENT_MEDIA_WORKER.maximumAttempts),
      or(
        and(eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.queued), lt(contentMediaAssets.availableAt, now)),
        and(eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing), lt(contentMediaAssets.claimedAt, leaseCutoff)),
      ),
    )).orderBy(asc(contentMediaAssets.availableAt), asc(contentMediaAssets.createdAt)).for("update", { skipLocked: true }).limit(1);
    if (!job) return null;
    const [claimed] = await transaction.update(contentMediaAssets).set({
      status: CONTENT_MEDIA_STATUS.processing,
      attempts: job.attempts + 1,
      claimedAt: now,
      failureCode: null,
    }).where(and(
      eq(contentMediaAssets.organizationId, job.organizationId),
      eq(contentMediaAssets.id, job.id),
    )).returning();
    return claimed ?? null;
  });
}

export async function expireExhaustedContentMediaJobs(now: Date) {
  const leaseCutoff = new Date(now.getTime() - CONTENT_MEDIA_WORKER.leaseMilliseconds);
  await getDatabase().update(contentMediaAssets).set({ status: CONTENT_MEDIA_STATUS.failed, failureCode: CONTENT_MEDIA_STATUS.failed, claimedAt: null }).where(and(
    inArray(contentMediaAssets.status, [CONTENT_MEDIA_STATUS.queued, CONTENT_MEDIA_STATUS.processing]),
    gte(contentMediaAssets.attempts, CONTENT_MEDIA_WORKER.maximumAttempts),
    or(
      and(eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.queued), lt(contentMediaAssets.availableAt, now)),
      and(eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing), lt(contentMediaAssets.claimedAt, leaseCutoff)),
    ),
  ));
}

export async function completeContentMediaJob(input: { organizationId: string; id: string; claimedAt: Date; contentType: string; sizeBytes: number; width: number; height: number; sha256: string }) {
  const [asset] = await getDatabase().update(contentMediaAssets).set({
    status: CONTENT_MEDIA_STATUS.pendingReview,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    width: input.width,
    height: input.height,
    sha256: input.sha256,
    claimedAt: null,
  }).where(and(
    eq(contentMediaAssets.organizationId, input.organizationId),
    eq(contentMediaAssets.id, input.id),
    eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing),
    eq(contentMediaAssets.claimedAt, input.claimedAt),
  )).returning({ id: contentMediaAssets.id });
  return asset ?? null;
}

export async function failContentMediaJob(job: { organizationId: string; id: string; claimedAt: Date; attempts: number }, now: Date) {
  const exhausted = job.attempts >= CONTENT_MEDIA_WORKER.maximumAttempts;
  const retryDelay = CONTENT_MEDIA_RETRY_DELAYS_MS[job.attempts - 1] ?? CONTENT_MEDIA_RETRY_DELAYS_MS.at(-1)!;
  await getDatabase().update(contentMediaAssets).set({
    status: exhausted ? CONTENT_MEDIA_STATUS.failed : CONTENT_MEDIA_STATUS.queued,
    failureCode: CONTENT_MEDIA_STATUS.failed,
    availableAt: new Date(now.getTime() + retryDelay),
    claimedAt: null,
  }).where(and(
    eq(contentMediaAssets.organizationId, job.organizationId),
    eq(contentMediaAssets.id, job.id),
    eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing),
    eq(contentMediaAssets.claimedAt, job.claimedAt),
  ));
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
