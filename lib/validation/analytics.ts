import { z } from "zod";
import { DASHBOARD_GOALS, SOCIAL_PLATFORMS, SOCIAL_PUBLICATION_JOB_STATUSES, SOCIAL_PUBLISHING_WORKER_STATUSES } from "@/lib/constants";

export const analyticsQuerySchema = z.object({
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  brandId: z.string().uuid().optional(),
  platform: z.enum(SOCIAL_PLATFORMS).optional(),
}).refine((value) => Date.parse(value.end) > Date.parse(value.start)
  && Date.parse(value.end) - Date.parse(value.start) <= 93 * 24 * 60 * 60 * 1000, { path: ["end"] });

export const analyticsRefreshRequestSchema = analyticsQuerySchema;
export const dashboardPublicationGoalSchema = z.object({
  brandId: z.string().uuid(),
  platform: z.enum(SOCIAL_PLATFORMS),
  monthlyTarget: z.number().int().min(DASHBOARD_GOALS.minimumMonthlyPublications).max(DASHBOARD_GOALS.maximumMonthlyPublications),
}).strict();
export const analyticsRefreshResponseSchema = z.object({ data: z.object({
  attempted: z.number().int().nonnegative(),
  success: z.number().int().nonnegative(),
  permissionDenied: z.number().int().nonnegative(),
  authenticationRequired: z.number().int().nonnegative(),
  unavailable: z.number().int().nonnegative(),
}) });

const analyticsCountSchema = z.number().int().nonnegative();
export const analyticsResponseSchema = z.object({
  data: z.object({
    start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }),
    totals: z.record(z.enum(SOCIAL_PUBLICATION_JOB_STATUSES), analyticsCountSchema),
    comparison: z.object({ previousPublished: analyticsCountSchema, publishedChange: z.number().int() }),
    attention: z.object({
      failedPublications: analyticsCountSchema,
      indeterminatePublications: analyticsCountSchema,
      pendingApprovals: analyticsCountSchema,
      connectionsNeedReauth: analyticsCountSchema,
    }),
    issues: z.object({
      publications: z.array(z.object({ id: z.string().uuid(), itemId: z.string().uuid(), title: z.string(), brandId: z.string().uuid(), brandName: z.string(), platform: z.enum(SOCIAL_PLATFORMS), plannedAt: z.iso.datetime({ offset: true }), status: z.enum(["failed", "indeterminate"]) })).max(10),
      approvals: z.array(z.object({ id: z.string().uuid(), itemId: z.string().uuid(), title: z.string(), brandId: z.string().uuid(), brandName: z.string(), platform: z.enum(SOCIAL_PLATFORMS), plannedAt: z.iso.datetime({ offset: true }) })).max(10),
      connections: z.array(z.object({ id: z.string().uuid(), brandId: z.string().uuid(), brandName: z.string(), platform: z.enum(SOCIAL_PLATFORMS), displayName: z.string() })).max(10),
    }),
    goalTargets: z.array(z.object({ platform: z.enum(SOCIAL_PLATFORMS), monthlyTarget: analyticsCountSchema })).max(SOCIAL_PLATFORMS.length),
    canManageGoals: z.boolean(),
    worker: z.object({
      status: z.enum(SOCIAL_PUBLISHING_WORKER_STATUSES),
      lastSeenAt: z.iso.datetime({ offset: true }).nullable(),
      queued: analyticsCountSchema,
      processing: analyticsCountSchema,
      oldestQueuedAt: z.iso.datetime({ offset: true }).nullable(),
    }),
    engagement: z.object({
      platforms: z.array(z.object({
        platform: z.enum(["facebook", "instagram"]),
        totalPublished: analyticsCountSchema,
        collectedPosts: analyticsCountSchema,
        statusCounts: z.record(z.enum(["success", "permission_denied", "authentication_required", "unavailable"]), analyticsCountSchema),
        metrics: z.object({ likes: analyticsCountSchema.nullable(), comments: analyticsCountSchema.nullable(), shares: analyticsCountSchema.nullable() }),
        latestCollectedAt: z.iso.datetime({ offset: true }).nullable(),
        topPosts: z.array(z.object({
          jobId: z.string().uuid(),
          title: z.string(),
          brandName: z.string(),
          scheduledAt: z.iso.datetime({ offset: true }),
          likes: analyticsCountSchema.nullable(),
          comments: analyticsCountSchema.nullable(),
          shares: analyticsCountSchema.nullable(),
          interactions: analyticsCountSchema,
          previousCheckChange: z.number().int().nullable(),
          previousCheckAt: z.iso.datetime({ offset: true }).nullable(),
        })),
      })),
    }),
    platforms: z.array(z.object({
      platform: z.enum(SOCIAL_PLATFORMS),
      totals: z.record(z.enum(SOCIAL_PUBLICATION_JOB_STATUSES), analyticsCountSchema),
    })),
  }),
});
