import "server-only";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { WORKSPACE_NOTIFICATION_LIMITS } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brands, contentItems, workspaceNotificationReads, workspaceNotifications } from "@/lib/db/schema";
import { logOperationalError } from "@/lib/server/operational-logger";

export type WorkspaceNotificationInput = {
  organizationId: string;
  eventType: typeof workspaceNotifications.$inferInsert.eventType;
  dedupeKey: string;
  brandId?: string | null;
  contentItemId?: string | null;
  platform?: typeof workspaceNotifications.$inferInsert.platform;
};

export async function recordWorkspaceNotification(input: WorkspaceNotificationInput) {
  try {
    const database = getDatabase();
    await database.insert(workspaceNotifications).values({
      organizationId: input.organizationId,
      eventType: input.eventType,
      dedupeKey: input.dedupeKey,
      brandId: input.brandId ?? null,
      contentItemId: input.contentItemId ?? null,
      platform: input.platform ?? null,
    }).onConflictDoNothing({ target: [workspaceNotifications.organizationId, workspaceNotifications.dedupeKey] });
  } catch (error) {
    logOperationalError("workspace.notification.record_failed", error, { organizationId: input.organizationId, eventType: input.eventType });
  }
}

export async function listWorkspaceNotifications(organizationId: string, userId: string) {
  return getDatabase().select({
    id: workspaceNotifications.id,
    eventType: workspaceNotifications.eventType,
    brandId: workspaceNotifications.brandId,
    brandName: brands.name,
    contentItemId: workspaceNotifications.contentItemId,
    contentTitle: contentItems.title,
    plannedAt: contentItems.plannedAt,
    platform: workspaceNotifications.platform,
    occurredAt: workspaceNotifications.occurredAt,
    readAt: workspaceNotificationReads.readAt,
  }).from(workspaceNotifications)
    .leftJoin(brands, and(eq(brands.organizationId, workspaceNotifications.organizationId), eq(brands.id, workspaceNotifications.brandId)))
    .leftJoin(contentItems, and(eq(contentItems.organizationId, workspaceNotifications.organizationId), eq(contentItems.id, workspaceNotifications.contentItemId), eq(contentItems.brandId, workspaceNotifications.brandId)))
    .leftJoin(workspaceNotificationReads, and(
      eq(workspaceNotificationReads.organizationId, workspaceNotifications.organizationId),
      eq(workspaceNotificationReads.notificationId, workspaceNotifications.id),
      eq(workspaceNotificationReads.userId, userId),
    ))
    .where(and(
      eq(workspaceNotifications.organizationId, organizationId),
      or(isNull(workspaceNotifications.recipientUserId), eq(workspaceNotifications.recipientUserId, userId)),
    ))
    .orderBy(desc(workspaceNotifications.occurredAt))
    .limit(WORKSPACE_NOTIFICATION_LIMITS.historyItems);
}

export async function markWorkspaceNotificationRead(organizationId: string, userId: string, notificationId: string, read: boolean) {
  const database = getDatabase();
  const [notification] = await database.select({ id: workspaceNotifications.id }).from(workspaceNotifications).where(and(
    eq(workspaceNotifications.organizationId, organizationId),
    eq(workspaceNotifications.id, notificationId),
    or(isNull(workspaceNotifications.recipientUserId), eq(workspaceNotifications.recipientUserId, userId)),
  )).limit(1);
  if (!notification) return false;

  const conditions = and(
    eq(workspaceNotificationReads.organizationId, organizationId),
    eq(workspaceNotificationReads.notificationId, notificationId),
    eq(workspaceNotificationReads.userId, userId),
  );
  if (read) {
    await database.insert(workspaceNotificationReads).values({ organizationId, notificationId, userId })
      .onConflictDoUpdate({
        target: [workspaceNotificationReads.organizationId, workspaceNotificationReads.notificationId, workspaceNotificationReads.userId],
        set: { readAt: new Date() },
      });
  } else {
    await database.delete(workspaceNotificationReads).where(conditions);
  }
  return true;
}

