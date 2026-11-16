import "server-only";
import { and, eq, sum } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { brands, dashboardPublicationGoals } from "@/lib/db/schema";
import type { SocialPlatform } from "@/lib/constants";

export async function getDashboardPublicationGoals(organizationId: string, brandId?: string) {
  const conditions = [eq(dashboardPublicationGoals.organizationId, organizationId)];
  if (brandId) conditions.push(eq(dashboardPublicationGoals.brandId, brandId));
  const rows = await getDatabase().select({ platform: dashboardPublicationGoals.platform, monthlyTarget: sum(dashboardPublicationGoals.monthlyTarget) })
    .from(dashboardPublicationGoals).innerJoin(brands, and(
      eq(brands.organizationId, dashboardPublicationGoals.organizationId), eq(brands.id, dashboardPublicationGoals.brandId), eq(brands.isActive, true),
    )).where(and(...conditions)).groupBy(dashboardPublicationGoals.platform);
  return rows.map((row) => ({ platform: row.platform, monthlyTarget: Number(row.monthlyTarget ?? 0) }));
}

export async function saveDashboardPublicationGoal(organizationId: string, brandId: string, platform: SocialPlatform, monthlyTarget: number, updatedBy: string) {
  const database = getDatabase();
  const [brand] = await database.select({ id: brands.id }).from(brands).where(and(
    eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true),
  )).limit(1);
  if (!brand) return false;
  await database.insert(dashboardPublicationGoals).values({ organizationId, brandId, platform, monthlyTarget, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [dashboardPublicationGoals.organizationId, dashboardPublicationGoals.brandId, dashboardPublicationGoals.platform],
      set: { monthlyTarget, updatedBy, updatedAt: new Date() },
    });
  return true;
}
