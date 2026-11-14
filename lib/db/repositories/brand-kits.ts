import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { BRAND_KIT_LIMITS, BRAND_KIT_VERSION_STATUS } from "@/lib/constants";
import type { BrandKitContent } from "@/lib/validation/brand-kits";
import { getDatabase } from "@/lib/db/client";
import { brandKitVersions, brands, user } from "@/lib/db/schema";

export async function listBrandKitVersions(organizationId: string, brandId: string) {
  const [brand] = await getDatabase()
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true)))
    .limit(1);
  if (!brand) return null;

  const creator = alias(user, "brand_kit_creator");
  const approver = alias(user, "brand_kit_approver");
  const rows = await getDatabase()
    .select({
      id: brandKitVersions.id,
      version: brandKitVersions.version,
      status: brandKitVersions.status,
      content: brandKitVersions.content,
      createdAt: brandKitVersions.createdAt,
      createdByName: creator.name,
      approvedAt: brandKitVersions.approvedAt,
      approvedByName: approver.name,
    })
    .from(brandKitVersions)
    .innerJoin(creator, eq(creator.id, brandKitVersions.createdBy))
    .leftJoin(approver, eq(approver.id, brandKitVersions.approvedBy))
    .where(and(eq(brandKitVersions.organizationId, organizationId), eq(brandKitVersions.brandId, brandId)))
    .orderBy(desc(brandKitVersions.version))
    .limit(BRAND_KIT_LIMITS.historyVersions);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdByName,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByName: row.approvedByName,
  }));
}

export async function createBrandKitVersion(organizationId: string, brandId: string, createdBy: string, content: BrandKitContent) {
  const database = getDatabase();
  const createdId = await database.transaction(async (transaction) => {
    const [brand] = await transaction
      .select({ id: brands.id })
      .from(brands)
      .where(and(eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true)))
      .for("update")
      .limit(1);
    if (!brand) return null;

    const [latest] = await transaction
      .select({ version: brandKitVersions.version, status: brandKitVersions.status })
      .from(brandKitVersions)
      .where(and(eq(brandKitVersions.organizationId, organizationId), eq(brandKitVersions.brandId, brandId)))
      .orderBy(desc(brandKitVersions.version))
      .limit(1);

    if (latest?.status === BRAND_KIT_VERSION_STATUS.draft) {
      await transaction
        .update(brandKitVersions)
        .set({ status: BRAND_KIT_VERSION_STATUS.superseded })
        .where(and(
          eq(brandKitVersions.organizationId, organizationId),
          eq(brandKitVersions.brandId, brandId),
          eq(brandKitVersions.version, latest.version),
          eq(brandKitVersions.status, BRAND_KIT_VERSION_STATUS.draft),
        ));
    }

    const [created] = await transaction
      .insert(brandKitVersions)
      .values({
        organizationId,
        brandId,
        version: (latest?.version ?? BRAND_KIT_LIMITS.initialVersion) + BRAND_KIT_LIMITS.versionIncrement,
        status: BRAND_KIT_VERSION_STATUS.draft,
        content,
        createdBy,
      })
      .returning({ id: brandKitVersions.id });
    return created?.id ?? null;
  });

  return createdId ? getBrandKitVersion(organizationId, brandId, createdId) : null;
}

export async function approveBrandKitVersion(organizationId: string, brandId: string, versionId: string, approvedBy: string) {
  const database = getDatabase();
  const approvedId = await database.transaction(async (transaction) => {
    const [brand] = await transaction
      .select({ id: brands.id })
      .from(brands)
      .where(and(eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true)))
      .for("update")
      .limit(1);
    if (!brand) return null;

    const [latest] = await transaction
      .select({ id: brandKitVersions.id, status: brandKitVersions.status })
      .from(brandKitVersions)
      .where(and(eq(brandKitVersions.organizationId, organizationId), eq(brandKitVersions.brandId, brandId)))
      .orderBy(desc(brandKitVersions.version))
      .limit(1);
    if (!latest || latest.id !== versionId || latest.status !== BRAND_KIT_VERSION_STATUS.draft) return null;

    await transaction
      .update(brandKitVersions)
      .set({ status: BRAND_KIT_VERSION_STATUS.superseded })
      .where(and(
        eq(brandKitVersions.organizationId, organizationId),
        eq(brandKitVersions.brandId, brandId),
        eq(brandKitVersions.status, BRAND_KIT_VERSION_STATUS.approved),
      ));

    const [approved] = await transaction
      .update(brandKitVersions)
      .set({ status: BRAND_KIT_VERSION_STATUS.approved, approvedBy, approvedAt: new Date() })
      .where(and(
        eq(brandKitVersions.organizationId, organizationId),
        eq(brandKitVersions.brandId, brandId),
        eq(brandKitVersions.id, versionId),
        eq(brandKitVersions.status, BRAND_KIT_VERSION_STATUS.draft),
      ))
      .returning({ id: brandKitVersions.id });
    return approved?.id ?? null;
  });

  return approvedId ? getBrandKitVersion(organizationId, brandId, approvedId) : null;
}

async function getBrandKitVersion(organizationId: string, brandId: string, versionId: string) {
  const creator = alias(user, "brand_kit_creator");
  const approver = alias(user, "brand_kit_approver");
  const [row] = await getDatabase()
    .select({
      id: brandKitVersions.id,
      version: brandKitVersions.version,
      status: brandKitVersions.status,
      content: brandKitVersions.content,
      createdAt: brandKitVersions.createdAt,
      createdByName: creator.name,
      approvedAt: brandKitVersions.approvedAt,
      approvedByName: approver.name,
    })
    .from(brandKitVersions)
    .innerJoin(creator, eq(creator.id, brandKitVersions.createdBy))
    .leftJoin(approver, eq(approver.id, brandKitVersions.approvedBy))
    .where(and(
      eq(brandKitVersions.organizationId, organizationId),
      eq(brandKitVersions.brandId, brandId),
      eq(brandKitVersions.id, versionId),
    ))
    .limit(1);

  return row ? {
    ...row,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdByName,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByName: row.approvedByName,
  } : null;
}
