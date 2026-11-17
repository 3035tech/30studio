import { z } from "zod";
import { SOCIAL_PLATFORMS, WORKSPACE_NOTIFICATION_TYPE_VALUES } from "@/lib/constants";

export const workspaceNotificationResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string().uuid(),
    eventType: z.enum(WORKSPACE_NOTIFICATION_TYPE_VALUES),
    brandId: z.string().uuid().nullable(),
    brandName: z.string().nullable(),
    contentItemId: z.string().uuid().nullable(),
    contentTitle: z.string().nullable(),
    plannedAt: z.string().datetime({ offset: true }).nullable(),
    platform: z.enum(SOCIAL_PLATFORMS).nullable(),
    occurredAt: z.string().datetime({ offset: true }),
    readAt: z.string().datetime({ offset: true }).nullable(),
  })),
});

export const workspaceNotificationReadRequestSchema = z.object({ read: z.boolean() }).strict();
