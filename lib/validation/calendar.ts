import { z } from "zod";
import { CALENDAR, CONTENT_LIMITS, CONTENT_MEDIA_REVIEW_DECISIONS, CONTENT_MEDIA_STATUSES, CONTENT_STATUSES, DEFAULT_LOCALE, LOCALES, SOCIAL_PLATFORMS } from "@/lib/constants";

const validTimeZone = z.string().trim().min(1).max(64).refine((timeZone) => {
  try {
    new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeZone });
    return true;
  } catch {
    return false;
  }
});

const isoDateTime = z.iso.datetime({ offset: true });

export const calendarQuerySchema = z.object({
  start: isoDateTime,
  end: isoDateTime,
  brandId: z.uuid().optional(),
  platform: z.enum(SOCIAL_PLATFORMS).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
}).strict().refine((value) => {
  const start = Date.parse(value.start);
  const end = Date.parse(value.end);
  return end > start && end - start <= CALENDAR.maximumRequestRangeDays * CALENDAR.millisecondsPerDay;
});

export const calendarItemCreateSchema = z.object({
  brandId: z.uuid(),
  platform: z.enum(SOCIAL_PLATFORMS),
  title: z.string().trim().min(1).max(CONTENT_LIMITS.titleCharacters),
  plannedAt: isoDateTime,
  timeZone: validTimeZone,
}).strict();

const campaignPublicationSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  plannedAt: isoDateTime,
  timeZone: validTimeZone,
}).strict();

export const calendarCampaignCreateSchema = z.object({
  brandId: z.uuid(),
  idempotencyKey: z.uuid(),
  title: z.string().trim().min(1).max(CONTENT_LIMITS.titleCharacters),
  brief: z.string().trim().min(1).max(CONTENT_LIMITS.campaignBriefCharacters),
  publications: z.array(campaignPublicationSchema).min(1).max(CONTENT_LIMITS.maximumCampaignPublications),
}).strict().refine((campaign) => new Set(campaign.publications.map((publication) => publication.platform)).size === campaign.publications.length);

export const calendarCampaignCreateResponseSchema = z.object({
  data: z.object({
    campaignId: z.uuid(),
    publications: z.array(z.object({ id: z.uuid(), platform: z.enum(SOCIAL_PLATFORMS) })),
    replayed: z.boolean(),
  }),
});

export const calendarItemUpdateSchema = calendarItemCreateSchema;

export const calendarContentVersionSaveSchema = calendarItemCreateSchema.extend({
  expectedVersionNumber: z.number().int().nonnegative(),
  canonicalCopy: z.string().trim().min(1).max(CONTENT_LIMITS.canonicalCopyCharacters),
  variantCopy: z.string().trim().min(1).max(CONTENT_LIMITS.variantCopyCharacters),
}).strict();

export const calendarContentVersionSchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int().positive(),
  brandKitVersionNumber: z.number().int().positive().nullable(),
  canonicalCopy: z.string(),
  variantCopy: z.string(),
  platform: z.enum(SOCIAL_PLATFORMS),
  createdAt: z.iso.datetime(),
});

export const contentMediaSchema = z.object({
  id: z.uuid(),
  status: z.enum(CONTENT_MEDIA_STATUSES),
  fileName: z.string(),
  contentType: z.enum(["image/webp"]).nullable(),
  sizeBytes: z.number().int().positive().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  createdAt: z.iso.datetime(),
  createdByName: z.string(),
  reviewedAt: z.iso.datetime().nullable(),
  previewUrl: z.url({ protocol: /^https?$/ }).nullable(),
}).strict();
export const contentMediaResponseSchema = z.object({ data: z.array(contentMediaSchema), canManage: z.boolean(), canReview: z.boolean() }).strict();
export const contentMediaGenerationRequestSchema = z.object({ contentVersionId: z.uuid(), idempotencyKey: z.uuid() }).strict();
export const contentMediaGenerationResponseSchema = z.object({ data: z.object({ id: z.uuid(), status: z.enum(CONTENT_MEDIA_STATUSES) }).strict() }).strict();
export const contentMediaReviewSchema = z.object({ decision: z.enum(CONTENT_MEDIA_REVIEW_DECISIONS), note: z.string().trim().max(CONTENT_LIMITS.canonicalCopyCharacters).nullable() }).strict();

export const calendarContentHistoryEntrySchema = z.object({
  versionNumber: z.number().int().positive(),
  platform: z.enum(SOCIAL_PLATFORMS),
  createdAt: z.iso.datetime(),
});

export const calendarContentVersionResponseSchema = z.object({
  data: z.object({
    current: calendarContentVersionSchema.nullable(),
    history: z.array(calendarContentHistoryEntrySchema),
  }),
});

export const calendarCopyDraftRequestSchema = z.object({ brandId: z.uuid(), locale: z.enum(LOCALES), platform: z.enum(SOCIAL_PLATFORMS) }).strict();
export const calendarCopyDraftResponseSchema = z.object({
  data: z.object({
    canonicalCopy: z.string().trim().min(1).max(CONTENT_LIMITS.canonicalCopyCharacters),
    variantCopy: z.string().trim().min(1).max(CONTENT_LIMITS.variantCopyCharacters),
  }).strict(),
}).strict();

export const calendarItemSchema = z.object({
  id: z.uuid(),
  brandId: z.uuid(),
  brandName: z.string(),
  campaignId: z.uuid().nullable(),
  campaignTitle: z.string().nullable(),
  platform: z.enum(SOCIAL_PLATFORMS),
  title: z.string(),
  status: z.enum(CONTENT_STATUSES),
  plannedAt: z.iso.datetime(),
  timeZone: z.string(),
  createdAt: z.iso.datetime(),
});

export const calendarResponseSchema = z.object({
  data: z.array(calendarItemSchema),
  truncated: z.boolean(),
  canManage: z.boolean(),
});

export type CalendarItemCreateInput = z.infer<typeof calendarItemCreateSchema>;
export type CalendarCampaignCreateInput = z.infer<typeof calendarCampaignCreateSchema>;
export type CalendarItemUpdateInput = z.infer<typeof calendarItemUpdateSchema>;
export type CalendarContentVersionSaveInput = z.infer<typeof calendarContentVersionSaveSchema>;
export type CalendarItem = z.infer<typeof calendarItemSchema>;
