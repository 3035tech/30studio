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

export const calendarItemUpdateSchema = calendarItemCreateSchema;

export const calendarItemSchema = z.object({
  id: z.uuid(),
  brandId: z.uuid(),
  brandName: z.string(),
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
export type CalendarItemUpdateInput = z.infer<typeof calendarItemUpdateSchema>;
export type CalendarItem = z.infer<typeof calendarItemSchema>;
