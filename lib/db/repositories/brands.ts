import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { brands } from "@/lib/db/schema";
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

export async function listBrands(organizationId: string) {
  return getDatabase().query.brands.findMany({
    with: { socialProfiles: true },
    where: and(eq(brands.organizationId, organizationId), eq(brands.isActive, true)),
    orderBy: [asc(brands.name)],
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
