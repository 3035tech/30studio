import { z } from "zod";
import { APPROVAL_POLICY_LIMITS, CALENDAR, CONTENT_APPROVAL_ACTION, CONTENT_APPROVAL_ACTIONS, CONTENT_APPROVAL_DECISIONS, CONTENT_APPROVAL_LIMITS, CONTENT_APPROVAL_STATUSES, CONTENT_LIMITS, CONTENT_MEDIA_CAROUSEL, CONTENT_MEDIA_GENERATION_MODE, CONTENT_MEDIA_GENERATION_MODES, CONTENT_MEDIA_REVIEW_DECISIONS, CONTENT_MEDIA_STATUSES, CONTENT_MEDIA_TEMPLATE, CONTENT_STATUSES, COPY_GENERATION, DEFAULT_LOCALE, LOCALES, SOCIAL_CAPABILITY_CATALOG_VERSION, SOCIAL_CAPABILITY_SNAPSHOT_SCHEMA_VERSION, SOCIAL_PLATFORMS, SOCIAL_PUBLICATION_JOB_STATUSES, SOCIAL_PUBLISHING_CAPABILITIES } from "@/lib/constants";

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
  publicationStatus: z.enum(SOCIAL_PUBLICATION_JOB_STATUSES).optional(),
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

const socialCapabilitySnapshotSchema = z.object({
  schemaVersion: z.literal(SOCIAL_CAPABILITY_SNAPSHOT_SCHEMA_VERSION),
  capabilityVersion: z.literal(SOCIAL_CAPABILITY_CATALOG_VERSION),
  platform: z.enum(SOCIAL_PLATFORMS),
  publication: z.enum(SOCIAL_PUBLISHING_CAPABILITIES),
  maximumTextCharacters: z.number().int().positive().nullable(),
  image: z.object({
    acceptedSourceTypes: z.array(z.string().min(1)).min(1),
    maximumSourceBytes: z.number().int().positive(),
    maximumPublishedBytes: z.number().int().positive(),
    minimumAspectRatio: z.number().positive(),
    maximumAspectRatio: z.number().positive(),
    maximumWidth: z.number().int().positive(),
  }).strict().nullable(),
}).strict();

export const calendarContentVersionSchema = z.object({
  id: z.uuid(),
  carouselId: z.uuid().nullable(),
  pageNumber: z.number().int().positive().nullable(),
  pageCount: z.number().int().positive().nullable(),
  versionNumber: z.number().int().positive(),
  brandKitVersionNumber: z.number().int().positive().nullable(),
  capabilitySnapshot: socialCapabilitySnapshotSchema.nullable(),
  canonicalCopy: z.string(),
  variantCopy: z.string(),
  platform: z.enum(SOCIAL_PLATFORMS),
  createdAt: z.iso.datetime(),
});

export const contentMediaSchema = z.object({
  id: z.uuid(),
  carouselId: z.uuid().nullable(),
  pageNumber: z.number().int().positive().nullable(),
  pageCount: z.number().int().positive().nullable(),
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
export const contentMediaGenerationRequestSchema = z.object({
  contentVersionId: z.uuid(),
  idempotencyKey: z.uuid(),
  mode: z.enum(CONTENT_MEDIA_GENERATION_MODES),
  pageCopies: z.array(z.string().trim().min(1).max(CONTENT_MEDIA_TEMPLATE.maximumCarouselPageCharacters)).length(CONTENT_MEDIA_CAROUSEL.pageCount).optional(),
}).strict().refine((value) => value.mode === CONTENT_MEDIA_GENERATION_MODE.carousel || value.pageCopies === undefined);
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
    itemStatus: z.enum(CONTENT_STATUSES),
    approval: z.object({
      canRequest: z.boolean(),
      mediaPending: z.boolean(),
      publisherProfileRequired: z.boolean(),
      targetProfiles: z.array(z.object({ id: z.uuid(), displayName: z.string(), handle: z.string().nullable() }).strict()),
      history: z.array(z.object({
        id: z.uuid(),
        versionId: z.uuid(),
        versionNumber: z.number().int().positive(),
        status: z.enum(CONTENT_APPROVAL_STATUSES),
        requiredApprovals: z.number().int().min(APPROVAL_POLICY_LIMITS.minimumApprovals).max(APPROVAL_POLICY_LIMITS.maximumApprovals),
        submittedBy: z.string(),
        submittedByName: z.string(),
        createdAt: z.iso.datetime(),
        resolvedAt: z.iso.datetime().nullable(),
        matchesCurrent: z.boolean(),
        targetProfile: z.object({ id: z.uuid(), displayName: z.string(), handle: z.string().nullable() }).strict().nullable(),
        decisions: z.array(z.object({
          decision: z.enum(CONTENT_APPROVAL_DECISIONS),
          note: z.string().nullable(),
          reviewerName: z.string(),
          occurredAt: z.iso.datetime(),
        })),
      })),
    }),
  }),
  canManage: z.boolean(),
  canReview: z.boolean(),
});

export const contentApprovalRequestSchema = z.object({
  action: z.enum(CONTENT_APPROVAL_ACTIONS),
  note: z.string().trim().max(CONTENT_APPROVAL_LIMITS.maximumNoteCharacters).nullable().optional(),
  socialProfileId: z.uuid().optional(),
}).strict().superRefine((value, context) => {
  if (value.action !== CONTENT_APPROVAL_ACTION.submit && value.socialProfileId !== undefined) {
    context.addIssue({ code: "custom", path: ["socialProfileId"], message: "A publication target can only be set when submitting for approval." });
  }
  if (value.action !== CONTENT_APPROVAL_ACTION.submit && (value.note ?? "").length === 0 && value.action !== CONTENT_APPROVAL_ACTION.approve) {
    context.addIssue({ code: "custom", path: ["note"], message: "Approval decision note is required." });
  }
});
export const contentApprovalActionResponseSchema = z.object({
  data: z.object({
    kind: z.enum(["created", "existing", "decided", "partial"]),
    requestId: z.uuid().optional(),
    decision: z.enum(CONTENT_APPROVAL_DECISIONS).optional(),
    approvedCount: z.number().int().nonnegative().optional(),
    requiredApprovals: z.number().int().positive().optional(),
    itemStatus: z.enum(CONTENT_STATUSES),
  }).strict(),
}).strict();
export const contentApprovalPolicySaveSchema = z.object({
  brandId: z.uuid().nullable(),
  requiredApprovals: z.number().int().min(APPROVAL_POLICY_LIMITS.minimumApprovals).max(APPROVAL_POLICY_LIMITS.maximumApprovals),
}).strict();
export const contentApprovalPolicyDeleteSchema = z.object({ brandId: z.uuid() }).strict();

export const calendarCopyDraftRequestSchema = z.object({ brandId: z.uuid(), locale: z.enum(LOCALES), platform: z.enum(SOCIAL_PLATFORMS) }).strict();
export const calendarCopyDraftResponseSchema = z.object({
  data: z.object({
    canonicalCopy: z.string().trim().min(1).max(CONTENT_LIMITS.canonicalCopyCharacters),
    variantCopy: z.string().trim().min(1).max(CONTENT_LIMITS.variantCopyCharacters),
    variantOptions: z.array(z.string().trim().min(1).max(COPY_GENERATION.maximumVariantOptionCharacters)).length(COPY_GENERATION.variantOptionCount).refine((options) => new Set(options).size === options.length),
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
  publicationStatus: z.enum(SOCIAL_PUBLICATION_JOB_STATUSES).nullable(),
  plannedAt: z.iso.datetime(),
  timeZone: z.string(),
  createdAt: z.iso.datetime(),
});

export const calendarResponseSchema = z.object({
  data: z.array(calendarItemSchema),
  truncated: z.boolean(),
  canManage: z.boolean(),
  canReview: z.boolean(),
});

export type CalendarItemCreateInput = z.infer<typeof calendarItemCreateSchema>;
export type CalendarCampaignCreateInput = z.infer<typeof calendarCampaignCreateSchema>;
export type CalendarItemUpdateInput = z.infer<typeof calendarItemUpdateSchema>;
export type CalendarContentVersionSaveInput = z.infer<typeof calendarContentVersionSaveSchema>;
export type CalendarItem = z.infer<typeof calendarItemSchema>;
