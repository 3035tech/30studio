import "server-only";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { BRAND_ASSET_LIMITS, BRAND_ASSET_REVIEW_DECISION, BRAND_ASSET_STATUS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brandAssetReviews, brandAssets, brands, user } from "@/lib/db/schema";
import type { BrandAssetUpload } from "@/lib/validation/brand-assets";

export async function createPendingBrandAsset(organizationId: string, brandId: string, createdBy: string, assetId: string, objectKey: string, uploadKey: string, input: BrandAssetUpload) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [brand] = await transaction.select({ id: brands.id }).from(brands).where(and(
      eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true),
    )).limit(1);
    if (!brand) return null;

    const [asset] = await transaction.insert(brandAssets).values({
      id: assetId,
      organizationId,
      brandId,
      createdBy,
      objectKey,
      uploadKey,
      kind: input.kind,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      sourceUrl: input.sourceUrl,
      license: input.license,
      rightsExpiresAt: input.rightsExpiresAt,
      altText: input.altText,
    }).returning({ id: brandAssets.id, objectKey: brandAssets.objectKey, uploadKey: brandAssets.uploadKey });
    return asset ?? null;
  });
}

export async function removePendingBrandAsset(organizationId: string, brandId: string, assetId: string) {
  await getDatabase().delete(brandAssets).where(and(
    eq(brandAssets.organizationId, organizationId),
    eq(brandAssets.brandId, brandId),
    eq(brandAssets.id, assetId),
    eq(brandAssets.status, BRAND_ASSET_STATUS.uploadPending),
  ));
}

export async function listAbandonedBrandAssetUploads(cutoff: Date, limit: number) {
  return getDatabase().select({ id: brandAssets.id, uploadKey: brandAssets.uploadKey })
    .from(brandAssets)
    .where(and(eq(brandAssets.status, BRAND_ASSET_STATUS.uploadPending), lt(brandAssets.createdAt, cutoff)))
    .orderBy(asc(brandAssets.createdAt))
    .limit(limit);
}

export async function removeAbandonedBrandAssetUpload(assetId: string, cutoff: Date) {
  const [removed] = await getDatabase().delete(brandAssets).where(and(
    eq(brandAssets.id, assetId),
    eq(brandAssets.status, BRAND_ASSET_STATUS.uploadPending),
    lt(brandAssets.createdAt, cutoff),
  )).returning({ id: brandAssets.id });
  return Boolean(removed);
}

export async function getBrandAssetForTenant(organizationId: string, brandId: string, assetId: string) {
  const [brand] = await getDatabase().select({ id: brands.id }).from(brands).where(and(
    eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true),
  )).limit(1);
  if (!brand) return null;
  const [asset] = await getDatabase().select().from(brandAssets).where(and(
    eq(brandAssets.organizationId, organizationId), eq(brandAssets.brandId, brandId), eq(brandAssets.id, assetId),
  )).limit(1);
  return asset ?? null;
}

export async function listBrandAssets(organizationId: string, brandId: string, includeUnreviewed: boolean) {
  const [brand] = await getDatabase().select({ id: brands.id }).from(brands).where(and(
    eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true),
  )).limit(1);
  if (!brand) return null;

  const creator = alias(user, "brand_asset_creator");
  const reviewer = alias(user, "brand_asset_reviewer");
  const rows = await getDatabase().select({
    id: brandAssets.id,
    kind: brandAssets.kind,
    status: brandAssets.status,
    fileName: brandAssets.fileName,
    contentType: brandAssets.contentType,
    sizeBytes: brandAssets.sizeBytes,
    width: brandAssets.width,
    height: brandAssets.height,
    sha256: brandAssets.sha256,
    sourceUrl: brandAssets.sourceUrl,
    license: brandAssets.license,
    rightsExpiresAt: brandAssets.rightsExpiresAt,
    altText: brandAssets.altText,
    createdAt: brandAssets.createdAt,
    createdByName: creator.name,
    reviewedAt: brandAssets.reviewedAt,
    reviewedByName: reviewer.name,
  }).from(brandAssets)
    .innerJoin(creator, eq(creator.id, brandAssets.createdBy))
    .leftJoin(reviewer, eq(reviewer.id, brandAssets.reviewedBy))
    .where(and(
      eq(brandAssets.organizationId, organizationId),
      eq(brandAssets.brandId, brandId),
      ...(includeUnreviewed ? [] : [eq(brandAssets.status, BRAND_ASSET_STATUS.approved)]),
    ))
    .orderBy(desc(brandAssets.createdAt))
    .limit(BRAND_ASSET_LIMITS.listItems);

  return rows.map((asset) => ({
    ...asset,
    createdAt: asset.createdAt.toISOString(),
    reviewedAt: asset.reviewedAt?.toISOString() ?? null,
    createdByName: asset.createdByName,
    reviewedByName: asset.reviewedByName,
  }));
}

export async function completeBrandAssetUpload(organizationId: string, brandId: string, assetId: string, width: number, height: number) {
  const [asset] = await getDatabase().update(brandAssets).set({
    width,
    height,
    status: BRAND_ASSET_STATUS.pendingReview,
  }).where(and(
    eq(brandAssets.organizationId, organizationId),
    eq(brandAssets.brandId, brandId),
    eq(brandAssets.id, assetId),
    eq(brandAssets.status, BRAND_ASSET_STATUS.uploadPending),
  )).returning({ id: brandAssets.id });
  return asset?.id ?? null;
}

export async function reviewBrandAsset(organizationId: string, brandId: string, assetId: string, reviewerId: string, decision: typeof BRAND_ASSET_REVIEW_DECISION[keyof typeof BRAND_ASSET_REVIEW_DECISION], note: string | null) {
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [brand] = await transaction.select({ id: brands.id }).from(brands).where(and(
      eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true),
    )).for("update").limit(1);
    if (!brand) return null;
    const [asset] = await transaction.select({ id: brandAssets.id }).from(brandAssets).where(and(
      eq(brandAssets.organizationId, organizationId),
      eq(brandAssets.brandId, brandId),
      eq(brandAssets.id, assetId),
      eq(brandAssets.status, BRAND_ASSET_STATUS.pendingReview),
    )).for("update").limit(1);
    if (!asset) return null;

    const [updated] = await transaction.update(brandAssets).set({
      status: decision,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    }).where(and(
      eq(brandAssets.organizationId, organizationId),
      eq(brandAssets.brandId, brandId),
      eq(brandAssets.id, assetId),
      eq(brandAssets.status, BRAND_ASSET_STATUS.pendingReview),
    )).returning({ id: brandAssets.id });
    if (!updated) return null;

    await transaction.insert(brandAssetReviews).values({ organizationId, brandId, assetId, reviewerId, decision, note });
    return updated;
  });
}
