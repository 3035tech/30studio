import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { BRAND_ASSET_STATUS } from "@/lib/constants";
import { brandAssets, brandKitVersions, brands } from "@/lib/db/schema";
import type { BrandCreateInput, BrandUpdateInput } from "@/lib/validation/brands";

const SLUG_SEPARATOR = "-";
const EMPTY_SLUG_PREFIX = "brand";

export function slugifyBrandName(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, SLUG_SEPARATOR)
    .replace(/^-+|-+$/g, "");

  return normalized || `${EMPTY_SLUG_PREFIX}-${crypto.randomUUID()}`;
}

export async function listBrands(organizationId: string, canManage = false) {
  const database = getDatabase();
  const brandRows = await database.query.brands.findMany({
    with: { socialProfiles: true },
    where: and(eq(brands.organizationId, organizationId), eq(brands.isActive, true)),
    orderBy: [asc(brands.name)],
  });

  if (brandRows.length === 0) return [];

  const logoRows = await database.select({ brandId: brandAssets.brandId, assetId: brandAssets.id, status: brandAssets.status })
    .from(brandAssets)
    .where(and(
      eq(brandAssets.organizationId, organizationId),
      inArray(brandAssets.brandId, brandRows.map((brand) => brand.id)),
      eq(brandAssets.kind, "logo"),
      inArray(brandAssets.status, canManage ? [BRAND_ASSET_STATUS.approved, BRAND_ASSET_STATUS.pendingReview] : [BRAND_ASSET_STATUS.approved]),
    ))
    .orderBy(desc(brandAssets.createdAt));
  const logos = new Map<string, typeof logoRows[number]>();
  for (const logo of logoRows) if (!logos.has(logo.brandId)) logos.set(logo.brandId, logo);

  const kitVersions = await database
    .select({ brandId: brandKitVersions.brandId, status: brandKitVersions.status, version: brandKitVersions.version })
    .from(brandKitVersions)
    .where(and(eq(brandKitVersions.organizationId, organizationId), inArray(brandKitVersions.brandId, brandRows.map((brand) => brand.id))))
    .orderBy(desc(brandKitVersions.version));
  const latestKitStatus = new Map<string, typeof kitVersions[number]["status"]>();
  for (const version of kitVersions) {
    if (!latestKitStatus.has(version.brandId)) latestKitStatus.set(version.brandId, version.status);
  }

  return brandRows.map((brand) => {
    const logo = logos.get(brand.id);
    return { ...brand, logoAssetId: logo?.assetId ?? null, logoAssetStatus: logo?.status ?? null, brandKitStatus: latestKitStatus.get(brand.id) ?? null };
  });
}

export async function createBrand(input: BrandCreateInput, organizationId: string, createdBy: string) {
  const database = getDatabase();
  const [brand] = await database
    .insert(brands)
    .values({
      organizationId,
      slug: slugifyBrandName(input.name),
      name: input.name,
      description: input.description || null,
      industry: input.industry || null,
      websiteUrl: input.websiteUrl || null,
      createdBy,
    })
    .onConflictDoNothing({ target: [brands.organizationId, brands.slug] })
    .returning();

  return brand ?? null;
}

export async function updateBrand(brandId: string, input: BrandUpdateInput, organizationId: string) {
  const [brand] = await getDatabase()
    .update(brands)
    .set({
      ...input,
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.industry !== undefined ? { industry: input.industry || null } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl || null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(brands.id, brandId), eq(brands.organizationId, organizationId), eq(brands.isActive, true)))
    .returning();

  return brand ?? null;
}

export async function archiveBrand(brandId: string, organizationId: string) {
  const [brand] = await getDatabase()
    .update(brands)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(brands.id, brandId), eq(brands.organizationId, organizationId), eq(brands.isActive, true)))
    .returning({ id: brands.id });

  return Boolean(brand);
}
