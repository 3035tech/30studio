import { z } from "zod";
import { CALENDAR, CONTENT_LIMITS, CONTENT_STATUSES, DEFAULT_LOCALE, SOCIAL_PLATFORMS } from "@/lib/constants";

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
  title: z.string().trim().min(1).max(CONTENT_LIMITS.titleCharacters),
  brief: z.string().trim().min(1).max(CONTENT_LIMITS.campaignBriefCharacters),
  publications: z.array(campaignPublicationSchema).min(1).max(CONTENT_LIMITS.maximumCampaignPublications),
}).strict().refine((campaign) => new Set(campaign.publications.map((publication) => publication.platform)).size === campaign.publications.length);

export const calendarCampaignCreateResponseSchema = z.object({
  data: z.object({
    campaignId: z.uuid(),
    publications: z.array(z.object({ id: z.uuid(), platform: z.enum(SOCIAL_PLATFORMS) })),
  }),
});

export const calendarItemUpdateSchema = calendarItemCreateSchema;

export const calendarContentVersionSaveSchema = calendarItemCreateSchema.extend({
  canonicalCopy: z.string().trim().min(1).max(CONTENT_LIMITS.canonicalCopyCharacters),
  variantCopy: z.string().trim().min(1).max(CONTENT_LIMITS.variantCopyCharacters),
}).strict();

export const calendarContentVersionSchema = z.object({
  versionNumber: z.number().int().positive(),
  brandKitVersionNumber: z.number().int().positive().nullable(),
  canonicalCopy: z.string(),
  variantCopy: z.string(),
  platform: z.enum(SOCIAL_PLATFORMS),
  createdAt: z.iso.datetime(),
});

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
