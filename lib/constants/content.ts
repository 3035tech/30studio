import { WORKSPACE_SECTION_IDS } from './core';
import type { SocialPlatform } from './social';

export const CONTENT_STATUSES = ["idea", "draft", "in_review", "approved", "scheduled", "published", "failed", "cancelled"] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_STATUS = {
  idea: "idea",
  draft: "draft",
  inReview: "in_review",
  approved: "approved",
  scheduled: "scheduled",
  published: "published",
  failed: "failed",
  cancelled: "cancelled",
} as const;

export const CONTENT_LIMITS = {
  titleCharacters: 180,
  campaignBriefCharacters: 5_000,
  maximumCampaignPublications: 30,
  maximumCampaignDurationDays: 365,
  canonicalCopyCharacters: 5_000,
  variantCopyCharacters: 5_000,
  maximumCalendarItems: 300,
  maximumVisibleCalendarItemsPerDay: 3,
  maximumContentVersionsInHistory: 10,
  maximumGeneratedImagesPerVersion: 3,
} as const;

export const CONTENT_MEDIA_STATUSES = ["queued", "processing", "pending_review", "approved", "rejected", "failed"] as const;

export type ContentMediaStatus = (typeof CONTENT_MEDIA_STATUSES)[number];

export const CONTENT_MEDIA_STATUS = {
  queued: "queued",
  processing: "processing",
  pendingReview: "pending_review",
  approved: "approved",
  rejected: "rejected",
  failed: "failed",
} as const;

export const CONTENT_MEDIA_USER_UPLOAD_MODEL_ID = "user-upload:v1";

export const CONTENT_APPROVAL_BLOCKING_MEDIA_STATUSES = [CONTENT_MEDIA_STATUS.queued, CONTENT_MEDIA_STATUS.processing, CONTENT_MEDIA_STATUS.pendingReview] as const;

export const CONTENT_MEDIA_REVIEW_DECISIONS = [CONTENT_MEDIA_STATUS.approved, CONTENT_MEDIA_STATUS.rejected] as const;

export const CONTENT_MEDIA_RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;

export const CONTENT_MEDIA_WORKER = {
  pollIntervalMilliseconds: 2_000,
  leaseMilliseconds: 180_000,
  maximumAttempts: CONTENT_MEDIA_RETRY_DELAYS_MS.length + 1,
  maximumImageBytes: 10 * 1024 * 1024,
  maximumImagePixels: 20_000_000,
  outputFormat: "webp",
  outputQuality: 82,
} as const;

export const CONTENT_MEDIA_GENERATION_MODES = ["ai_image", "text_card", "carousel"] as const;

export const CONTENT_MEDIA_GENERATION_MODE = { aiImage: "ai_image", textCard: "text_card", carousel: "carousel" } as const;

export const CONTENT_MEDIA_CAROUSEL = { pageCount: 3 } as const;

export const CONTENT_MEDIA_EXPORTS = {
  linkedin: { width: 1080, height: 1080 },
  instagram: { width: 1080, height: 1350 },
  facebook: { width: 1080, height: 1080 },
  tiktok: { width: 1080, height: 1080 },
  x: { width: 1600, height: 900 },
  youtube: { width: 1280, height: 720 },
  threads: { width: 1080, height: 1350 },
  pinterest: { width: 1000, height: 1500 },
} as const satisfies Record<SocialPlatform, { width: number; height: number }>;

export const CONTENT_MEDIA_TEMPLATE = {
  textCardModelId: "native:text-card:v1",
  width: 1080,
  height: 1080,
  maximumCarouselPageCharacters: 2_000,
  maximumTitleCharacters: 180,
  maximumCopyExcerptCharacters: 220,
  maximumTitleLines: 3,
  maximumCopyLines: 4,
  neutralBackground: "#F8FAFC",
  neutralForeground: "#0B1B3B",
  neutralAccent: "#64748B",
  fontFamilyPattern: /^[\p{L}\p{N}][\p{L}\p{N} ,.-]{0,79}$/u,
} as const;

export const CONTENT_EDITABLE_STATUSES = [CONTENT_STATUS.idea, CONTENT_STATUS.draft] as const;

export const CONTENT_REVIEWABLE_STATUSES = [...CONTENT_EDITABLE_STATUSES, CONTENT_STATUS.inReview, CONTENT_STATUS.approved] as const;

export const CONTENT_APPROVAL_STATUSES = ["pending", "approved", "rejected", "changes_requested", "stale"] as const;

export type ContentApprovalStatus = (typeof CONTENT_APPROVAL_STATUSES)[number];

export const CONTENT_APPROVAL_STATUS = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  changesRequested: "changes_requested",
  stale: "stale",
} as const;

export const CONTENT_APPROVAL_DECISIONS = [CONTENT_APPROVAL_STATUS.approved, CONTENT_APPROVAL_STATUS.rejected, CONTENT_APPROVAL_STATUS.changesRequested] as const;

export const CONTENT_APPROVAL_ACTION = {
  submit: "submit",
  approve: CONTENT_APPROVAL_STATUS.approved,
  reject: CONTENT_APPROVAL_STATUS.rejected,
  requestChanges: CONTENT_APPROVAL_STATUS.changesRequested,
} as const;

export const CONTENT_APPROVAL_ACTIONS = [CONTENT_APPROVAL_ACTION.submit, CONTENT_APPROVAL_ACTION.approve, CONTENT_APPROVAL_ACTION.reject, CONTENT_APPROVAL_ACTION.requestChanges] as const;

export const CONTENT_APPROVAL_LIMITS = { maximumNoteCharacters: 2_000, maximumHistoryEntries: 10 } as const;

export const CONTENT_APPROVAL_POLICY = {
  defaultScopeKey: "organization",
  brandScopePrefix: "brand:",
  defaultRequiredApprovals: 1,
  maximumRequiredApprovals: 5,
} as const;

export const CONTENT_APPROVAL_POLICY_API_PATHS = { collection: "/api/approval-policies" } as const;

export const APPROVAL_POLICY_LIMITS = { minimumApprovals: 1, maximumApprovals: CONTENT_APPROVAL_POLICY.maximumRequiredApprovals } as const;

export const CALENDAR = {
  daysPerWeek: 7,
  weeksPerView: 6,
  maximumRequestRangeDays: 43,
  millisecondsPerDay: 86_400_000,
  previousMonthStep: -1,
  nextMonthStep: 1,
  maximumVisibleItemsPerDay: CONTENT_LIMITS.maximumVisibleCalendarItemsPerDay,
  defaultPlannedTime: "09:00",
  firstWeekday: { pt: 1, en: 0 },
} as const;

export const CALENDAR_API_PATHS = {
  collection: "/api/calendar",
  item: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}`,
  versions: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/versions`,
  generateCopy: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/copy-draft`,
  reviewCopy: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/review`,
  approval: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/approval`,
  reconcilePublication: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/publication-reconciliation`,
} as const;

export const COPY_GENERATION = {
  timeoutMilliseconds: 30_000,
  maximumOutputTokens: 1_100,
  variantOptionCount: 3,
  maximumVariantOptionCharacters: 1_200,
  imageTimeoutMilliseconds: 90_000,
} as const;

export const CONTENT_REVIEW = {
  timeoutMilliseconds: 30_000,
  maximumFindings: 8,
  maximumOutputTokens: 900,
  maximumFindingTextCharacters: 600,
} as const;

export const CONTENT_REVIEW_CATEGORIES = ["grammar", "unsupported_claim", "restricted_claim", "brand_voice", "channel_fit", "clarity"] as const;

export const CONTENT_REVIEW_SEVERITIES = ["high", "medium", "low"] as const;

export const CONTENT_REVIEW_LOCALES = ["pt", "en"] as const;

export const AI_PROVIDER_ENV = {
  apiKey: "OPENAI_API_KEY",
  model: "OPENAI_MODEL",
  imageModel: "OPENAI_IMAGE_MODEL",
} as const;

export const CONTENT_MEDIA_API_PATHS = {
  collection: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/media`,
  upload: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/media/upload`,
  createCarousel: (itemId: string) => `/api/calendar/${encodeURIComponent(itemId)}/media/carousel`,
  finalizeUpload: (itemId: string, mediaId: string) => `/api/calendar/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}/finalize`,
  review: (itemId: string, mediaId: string) => `/api/calendar/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}/review`,
} as const;

export const CAMPAIGN_API_PATHS = {
  collection: "/api/campaigns",
  detail: (campaignId: string) => `/api/campaigns/${encodeURIComponent(campaignId)}`,
  publications: (campaignId: string) => `/api/campaigns/${encodeURIComponent(campaignId)}/publications`,
} as const;

export const CAMPAIGN_FORM_FIELDS = {
  platforms: "platforms",
  publicationDatePrefix: "publication-date-",
  publicationTimePrefix: "publication-time-",
  publicationPlatform: (index: number) => `campaign-publication-${index}-platform`,
  publicationDate: (index: number) => `campaign-publication-${index}-date`,
  publicationTime: (index: number) => `campaign-publication-${index}-time`,
  publicationRemove: (index: number) => `campaign-publication-${index}-remove`,
  startDate: "calendar-campaign-start-date",
  endDate: "calendar-campaign-end-date",
  platformCheckboxId: (platform: SocialPlatform) => `calendar-platform-${platform}`,
} as const;

export const CALENDAR_VIEW_MODES = ["month", "list"] as const;

export type CalendarViewMode = (typeof CALENDAR_VIEW_MODES)[number];

export const CALENDAR_VIEW_MODE = { month: "month", list: "list" } as const;

export const CALENDAR_QUERY_PARAMETERS = {
  start: "start",
  end: "end",
  brandId: "brandId",
  platform: "platform",
  status: "status",
  publicationStatus: "publicationStatus",
} as const;

export const CALENDAR_UI_IDS = {
  section: WORKSPACE_SECTION_IDS.calendar,
  title: "editorial-calendar-title",
  filters: "editorial-calendar-filters",
  newCampaignForm: "editorial-calendar-new-campaign",
  createCampaignTitle: "calendar-create-campaign-title",
  createCampaignDescription: "calendar-create-campaign-description",
  campaignTitle: "calendar-campaign-title",
  campaignBrand: "calendar-campaign-brand",
  campaignBrief: "calendar-campaign-brief",
  editTitle: "calendar-edit-title",
  editDescription: "calendar-edit-description",
  canonicalCopy: "calendar-canonical-copy",
  variantCopy: "calendar-variant-copy",
} as const;

export const CALENDAR_FORM_FIELDS = { brandId: "brandId", platform: "platform" } as const;
