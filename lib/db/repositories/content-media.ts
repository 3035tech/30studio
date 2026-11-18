import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { CONTENT_EDITABLE_STATUSES, CONTENT_LIMITS, CONTENT_MEDIA_CAROUSEL, CONTENT_MEDIA_RETRY_DELAYS_MS, CONTENT_MEDIA_STATUS, CONTENT_MEDIA_USER_UPLOAD_MODEL_ID, CONTENT_MEDIA_WORKER } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brandKitVersions, brands, campaigns, contentItems, contentMediaAssets, contentMediaReviews, contentVariants, contentVersions, user } from "@/lib/db/schema";

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

    const [existingRequest] = await transaction.select({ id: contentMediaAssets.id, status: contentMediaAssets.status, contentVersionId: contentMediaAssets.contentVersionId, contentItemId: contentMediaAssets.contentItemId, modelId: contentMediaAssets.modelId, prompt: contentMediaAssets.prompt }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, input.organizationId),
      eq(contentMediaAssets.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (existingRequest) {
      if (existingRequest.contentVersionId !== input.contentVersionId || existingRequest.contentItemId !== input.itemId || existingRequest.modelId !== input.modelId || existingRequest.prompt !== input.prompt) return { kind: "conflict" as const };
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

export async function createContentMediaUpload(input: {
  organizationId: string;
  itemId: string;
  contentVersionId: string;
  idempotencyKey: string;
  userId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [item] = await transaction.select({ brandId: contentItems.brandId }).from(contentItems).where(and(
      eq(contentItems.organizationId, input.organizationId),
      eq(contentItems.id, input.itemId),
      inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
    )).for("update").limit(1);
    if (!item) return { kind: "not_found" as const };

    const [latestVersion] = await transaction.select({ id: contentVersions.id }).from(contentVersions).where(and(
      eq(contentVersions.organizationId, input.organizationId),
      eq(contentVersions.contentItemId, input.itemId),
    )).orderBy(desc(contentVersions.versionNumber)).limit(1);
    if (!latestVersion || latestVersion.id !== input.contentVersionId) return { kind: "conflict" as const };

    const [existing] = await transaction.select({ id: contentMediaAssets.id, status: contentMediaAssets.status }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, input.organizationId),
      eq(contentMediaAssets.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (existing) return { kind: "existing" as const, assetId: existing.id, status: existing.status };

    const [assetCount] = await transaction.select({ value: count() }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, input.organizationId),
      eq(contentMediaAssets.contentVersionId, input.contentVersionId),
    ));
    if ((assetCount?.value ?? 0) >= CONTENT_LIMITS.maximumGeneratedImagesPerVersion) return { kind: "limit" as const };

    const [asset] = await transaction.insert(contentMediaAssets).values({
      organizationId: input.organizationId,
      brandId: item.brandId,
      contentItemId: input.itemId,
      contentVersionId: input.contentVersionId,
      idempotencyKey: input.idempotencyKey,
      objectKey: `staging/tenants/${encodeURIComponent(input.organizationId)}/brands/${item.brandId}/content/${input.itemId}/${input.idempotencyKey}`,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      prompt: "User uploaded image",
      modelId: CONTENT_MEDIA_USER_UPLOAD_MODEL_ID,
      status: CONTENT_MEDIA_STATUS.processing,
      createdBy: input.userId,
    }).returning({ id: contentMediaAssets.id, status: contentMediaAssets.status, objectKey: contentMediaAssets.objectKey });
    return asset ? { kind: "created" as const, ...asset } : { kind: "not_found" as const };
  });
}

export async function getPendingContentMediaUpload(organizationId: string, itemId: string, mediaId: string) {
  const [asset] = await getDatabase().select().from(contentMediaAssets).where(and(
    eq(contentMediaAssets.organizationId, organizationId),
    eq(contentMediaAssets.contentItemId, itemId),
    eq(contentMediaAssets.id, mediaId),
    eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing),
  )).limit(1);
  return asset ?? null;
}

export async function completeContentMediaUpload(organizationId: string, itemId: string, mediaId: string, objectKey: string, width: number, height: number) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [item] = await transaction.select({ id: contentItems.id }).from(contentItems).where(and(
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.id, itemId),
      inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
    )).for("update").limit(1);
    if (!item) return null;
    const [asset] = await transaction.update(contentMediaAssets).set({
      objectKey,
      width,
      height,
      status: CONTENT_MEDIA_STATUS.pendingReview,
    }).where(and(
      eq(contentMediaAssets.organizationId, organizationId),
      eq(contentMediaAssets.contentItemId, itemId),
      eq(contentMediaAssets.id, mediaId),
      eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing),
    )).returning({ id: contentMediaAssets.id });
    return asset ?? null;
  });
}

export async function removePendingContentMediaUpload(organizationId: string, itemId: string, mediaId: string) {
  await getDatabase().delete(contentMediaAssets).where(and(
    eq(contentMediaAssets.organizationId, organizationId),
    eq(contentMediaAssets.contentItemId, itemId),
    eq(contentMediaAssets.id, mediaId),
    eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing),
  ));
}

export async function listAbandonedContentMediaUploads(cutoff: Date, limit: number) {
  return getDatabase().select({ id: contentMediaAssets.id, uploadKey: contentMediaAssets.objectKey })
    .from(contentMediaAssets)
    .where(and(
      eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing),
      eq(contentMediaAssets.modelId, CONTENT_MEDIA_USER_UPLOAD_MODEL_ID),
      lt(contentMediaAssets.createdAt, cutoff),
    ))
    .orderBy(asc(contentMediaAssets.createdAt))
    .limit(limit);
}

export async function removeAbandonedContentMediaUpload(mediaId: string, cutoff: Date) {
  const [removed] = await getDatabase().delete(contentMediaAssets).where(and(
    eq(contentMediaAssets.id, mediaId),
    eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing),
    eq(contentMediaAssets.modelId, CONTENT_MEDIA_USER_UPLOAD_MODEL_ID),
    lt(contentMediaAssets.createdAt, cutoff),
  )).returning({ id: contentMediaAssets.id });
  return Boolean(removed);
}

export async function groupUploadedContentMediaAsCarousel(organizationId: string, itemId: string, contentVersionId: string, mediaIds: string[]) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    if (mediaIds.length !== CONTENT_MEDIA_CAROUSEL.pageCount || new Set(mediaIds).size !== mediaIds.length) return null;
    const [item] = await transaction.select({ id: contentItems.id }).from(contentItems).where(and(
      eq(contentItems.organizationId, organizationId),
      eq(contentItems.id, itemId),
      inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
    )).for("update").limit(1);
    if (!item) return null;
    const [latestVersion] = await transaction.select({ id: contentVersions.id }).from(contentVersions).where(and(
      eq(contentVersions.organizationId, organizationId),
      eq(contentVersions.contentItemId, itemId),
    )).orderBy(desc(contentVersions.versionNumber)).limit(1);
    if (!latestVersion || latestVersion.id !== contentVersionId) return null;
    const assets = await transaction.select({ id: contentMediaAssets.id, status: contentMediaAssets.status, carouselId: contentMediaAssets.carouselId, modelId: contentMediaAssets.modelId }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, organizationId),
      eq(contentMediaAssets.contentItemId, itemId),
      eq(contentMediaAssets.contentVersionId, contentVersionId),
      inArray(contentMediaAssets.id, mediaIds),
    )).for("update");
    if (assets.length !== mediaIds.length || assets.some((asset) => asset.status !== CONTENT_MEDIA_STATUS.pendingReview || asset.carouselId !== null || asset.modelId !== CONTENT_MEDIA_USER_UPLOAD_MODEL_ID)) return null;

    const carouselId = randomUUID();
    for (const [index, mediaId] of mediaIds.entries()) {
      await transaction.update(contentMediaAssets).set({ carouselId, pageNumber: index + 1, pageCount: mediaIds.length }).where(and(
        eq(contentMediaAssets.organizationId, organizationId),
        eq(contentMediaAssets.contentItemId, itemId),
        eq(contentMediaAssets.contentVersionId, contentVersionId),
        eq(contentMediaAssets.id, mediaId),
        eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.pendingReview),
        eq(contentMediaAssets.modelId, CONTENT_MEDIA_USER_UPLOAD_MODEL_ID),
      ));
    }
    return { carouselId, pageCount: mediaIds.length };
  });
}

export async function enqueueContentCarouselGeneration(input: {
  organizationId: string;
  itemId: string;
  contentVersionId: string;
  idempotencyKey: string;
  userId: string;
  modelId: string;
  prompts: string[];
}) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    if (input.prompts.length !== CONTENT_MEDIA_CAROUSEL.pageCount) return { kind: "conflict" as const };
    const [item] = await transaction.select({ brandId: contentItems.brandId }).from(contentItems).where(and(
      eq(contentItems.organizationId, input.organizationId),
      eq(contentItems.id, input.itemId),
      inArray(contentItems.status, CONTENT_EDITABLE_STATUSES),
    )).for("update").limit(1);
    if (!item) return { kind: "not_found" as const };

    const existing = await transaction.select({ id: contentMediaAssets.id, status: contentMediaAssets.status, contentVersionId: contentMediaAssets.contentVersionId, modelId: contentMediaAssets.modelId, prompt: contentMediaAssets.prompt, pageNumber: contentMediaAssets.pageNumber }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, input.organizationId),
      eq(contentMediaAssets.carouselId, input.idempotencyKey),
    )).orderBy(asc(contentMediaAssets.pageNumber));
    if (existing.length > 0) {
      const matches = existing.length === input.prompts.length && existing.every((asset, index) => asset.contentVersionId === input.contentVersionId && asset.modelId === input.modelId && asset.prompt === input.prompts[index] && asset.pageNumber === index + 1);
      if (!matches) return { kind: "conflict" as const };
      return { kind: "existing" as const, assetId: existing[0]!.id, status: existing[0]!.status };
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
    if ((generatedCount?.value ?? 0) + input.prompts.length > CONTENT_LIMITS.maximumGeneratedImagesPerVersion) return { kind: "limit" as const };

    const values = input.prompts.map((prompt, index) => {
      const idempotencyKey = randomUUID();
      const fileName = `${input.idempotencyKey}-${index + 1}.webp`;
      return {
        organizationId: input.organizationId,
        brandId: item.brandId,
        contentItemId: input.itemId,
        contentVersionId: input.contentVersionId,
        carouselId: input.idempotencyKey,
        pageNumber: index + 1,
        pageCount: input.prompts.length,
        idempotencyKey,
        objectKey: `tenants/${encodeURIComponent(input.organizationId)}/brands/${item.brandId}/content/${input.itemId}/${input.contentVersionId}/${fileName}`,
        fileName,
        prompt,
        modelId: input.modelId,
        status: CONTENT_MEDIA_STATUS.queued,
        createdBy: input.userId,
      };
    });
    const assets = await transaction.insert(contentMediaAssets).values(values).returning({ id: contentMediaAssets.id, status: contentMediaAssets.status });
    const firstAsset = assets[0];
    return firstAsset ? { kind: "created" as const, assetId: firstAsset.id, status: firstAsset.status } : { kind: "not_found" as const };
  });
}

export async function listContentMediaForVersion(organizationId: string, itemId: string, contentVersionId: string) {
  const creator = user;
  const rows = await getDatabase().select({
    id: contentMediaAssets.id,
    carouselId: contentMediaAssets.carouselId,
    pageNumber: contentMediaAssets.pageNumber,
    pageCount: contentMediaAssets.pageCount,
    status: contentMediaAssets.status,
    origin: contentMediaAssets.modelId,
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
  return rows.map((row) => ({ ...row, origin: row.origin.startsWith("user-upload:") ? "user" as const : "ai" as const, createdAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null }));
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
    const [asset] = await transaction.select({ id: contentMediaAssets.id, brandId: contentMediaAssets.brandId, carouselId: contentMediaAssets.carouselId, pageCount: contentMediaAssets.pageCount }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, organizationId),
      eq(contentMediaAssets.contentItemId, itemId),
      eq(contentMediaAssets.id, mediaId),
    )).limit(1);
    if (!asset) return null;
    const group = asset.carouselId ? await transaction.select({ id: contentMediaAssets.id, status: contentMediaAssets.status, brandId: contentMediaAssets.brandId }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, organizationId),
      eq(contentMediaAssets.contentItemId, itemId),
      eq(contentMediaAssets.carouselId, asset.carouselId),
    )).orderBy(asc(contentMediaAssets.pageNumber)).for("update") : await transaction.select({ id: contentMediaAssets.id, status: contentMediaAssets.status, brandId: contentMediaAssets.brandId }).from(contentMediaAssets).where(and(
      eq(contentMediaAssets.organizationId, organizationId),
      eq(contentMediaAssets.id, mediaId),
      eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.pendingReview),
    )).for("update").limit(1);
    if (group.length !== (asset.pageCount ?? 1) || group.some((page) => page.status !== CONTENT_MEDIA_STATUS.pendingReview)) return null;
    const reviewed = await transaction.update(contentMediaAssets).set({
      status: decision,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    }).where(and(
      eq(contentMediaAssets.organizationId, organizationId),
      asset.carouselId ? eq(contentMediaAssets.carouselId, asset.carouselId) : eq(contentMediaAssets.id, mediaId),
      eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.pendingReview),
    )).returning({ id: contentMediaAssets.id });
    if (!reviewed) return null;
    await transaction.insert(contentMediaReviews).values(group.map((page) => ({ organizationId, brandId: page.brandId, mediaAssetId: page.id, reviewerId, decision, note })));
    return reviewed.find((page) => page.id === mediaId) ?? reviewed[0];
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

