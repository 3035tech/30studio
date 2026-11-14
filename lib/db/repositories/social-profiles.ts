import "server-only";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { brands, socialProfiles } from "@/lib/db/schema";
import type { SocialProfileCreateInput } from "@/lib/validation/social-profiles";

export async function createSocialProfile(organizationId: string, brandId: string, input: SocialProfileCreateInput) {
  const database = getDatabase();
  const [brand] = await database.select({ id: brands.id }).from(brands)
    .where(and(eq(brands.organizationId, organizationId), eq(brands.id, brandId))).limit(1);
  if (!brand) return { kind: "missing_brand" as const };

  const [profile] = await database
    .insert(socialProfiles)
    .values({
      organizationId,
      brandId,
      platform: input.platform,
      displayName: input.displayName,
      handle: input.handle || null,
    })
    .onConflictDoNothing()
    .returning();

  return profile ? { kind: "created" as const, profile } : { kind: "duplicate" as const };
}
