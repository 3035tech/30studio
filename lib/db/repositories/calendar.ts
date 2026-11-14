import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { CONTENT_LIMITS, CONTENT_STATUS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brands, contentItems } from "@/lib/db/schema";
import type { CalendarItemCreateInput, CalendarItemUpdateInput } from "@/lib/validation/calendar";

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
    platform: contentItems.platform,
    title: contentItems.title,
    status: contentItems.status,
    plannedAt: contentItems.plannedAt,
    timeZone: contentItems.timeZone,
    createdAt: contentItems.createdAt,
  }).from(contentItems).innerJoin(brands, and(
    eq(brands.organizationId, contentItems.organizationId),
    eq(brands.id, contentItems.brandId),
  )).where(and(...conditions)).orderBy(asc(contentItems.plannedAt), asc(contentItems.createdAt))
    .limit(CONTENT_LIMITS.maximumCalendarItems + 1);

  return {
    data: rows.slice(0, CONTENT_LIMITS.maximumCalendarItems),
    truncated: rows.length > CONTENT_LIMITS.maximumCalendarItems,
  };
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
