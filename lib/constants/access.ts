import { DEFAULT_LOCALE, type Locale } from './core';

export const AUTH_LIMITS = {
  emailCharacters: 254,
  passwordCharacters: 8,
  nameCharacters: 100,
  slugCharacters: 48,
} as const;

export const DATABASE_LIMITS = {
  poolConnections: 8,
  connectionTimeoutMilliseconds: 5_000,
  idleTimeoutMilliseconds: 30_000,
} as const;

export const AUTH_STORAGE = {
  redisUrlEnvironmentName: "REDIS_URL",
  redisKeyPrefix: "30studio:auth:",
  redisConnectTimeoutMilliseconds: 5_000,
  redisMaxRetriesPerRequest: 1,
} as const;

export const BETTER_AUTH_ENV = {
  secret: "BETTER_AUTH_SECRET",
  url: "BETTER_AUTH_URL",
  trustedOrigins: "BETTER_AUTH_TRUSTED_ORIGINS",
} as const;

export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  accepted: 202,
  unprocessable: 422,
  internalError: 500,
  unavailable: 503,
} as const;

export const API_ERROR_CODES = {
  authUnavailable: "AUTH_UNAVAILABLE",
  unauthenticated: "UNAUTHENTICATED",
  forbidden: "FORBIDDEN",
  organizationRequired: "ORGANIZATION_REQUIRED",
  organizationNotFound: "ORGANIZATION_NOT_FOUND",
  invalidRequest: "INVALID_REQUEST",
  brandExists: "BRAND_EXISTS",
  brandNotFound: "BRAND_NOT_FOUND",
  profileExists: "PROFILE_EXISTS",
  socialConnectorUnavailable: "SOCIAL_CONNECTOR_UNAVAILABLE",
  socialConnectionConflict: "SOCIAL_CONNECTION_CONFLICT",
  socialConnectionNotFound: "SOCIAL_CONNECTION_NOT_FOUND",
  competitorSourceNotFound: "COMPETITOR_SOURCE_NOT_FOUND",
  competitorSourceExists: "COMPETITOR_SOURCE_EXISTS",
  competitorSourceLimitReached: "COMPETITOR_SOURCE_LIMIT_REACHED",
  competitorYouTubeConnectionRequired: "COMPETITOR_YOUTUBE_CONNECTION_REQUIRED",
  competitorInstagramConnectionRequired: "COMPETITOR_INSTAGRAM_CONNECTION_REQUIRED",
  competitorFacebookConnectionRequired: "COMPETITOR_FACEBOOK_CONNECTION_REQUIRED",
  competitorXConnectionRequired: "COMPETITOR_X_CONNECTION_REQUIRED",
  competitorXApiDisabled: "COMPETITOR_X_API_DISABLED",
  competitorProfileNotFound: "COMPETITOR_PROFILE_NOT_FOUND",
  competitorProfileLookupUnavailable: "COMPETITOR_PROFILE_LOOKUP_UNAVAILABLE",
  socialOAuthInvalid: "SOCIAL_OAUTH_INVALID",
  brandAssetNotFound: "BRAND_ASSET_NOT_FOUND",
  brandAssetInvalid: "BRAND_ASSET_INVALID",
  brandAssetStateConflict: "BRAND_ASSET_STATE_CONFLICT",
  calendarItemNotFound: "CALENDAR_ITEM_NOT_FOUND",
  contentMediaNotFound: "CONTENT_MEDIA_NOT_FOUND",
  contentMediaConflict: "CONTENT_MEDIA_CONFLICT",
  campaignIdempotencyConflict: "CAMPAIGN_IDEMPOTENCY_CONFLICT",
  campaignNotFound: "CAMPAIGN_NOT_FOUND",
  campaignScheduleOutsidePeriod: "CAMPAIGN_SCHEDULE_OUTSIDE_PERIOD",
  campaignPublicationLimitReached: "CAMPAIGN_PUBLICATION_LIMIT_REACHED",
  campaignPeriodConflict: "CAMPAIGN_PERIOD_CONFLICT",
  contentVersionConflict: "CONTENT_VERSION_CONFLICT",
  contentApprovalConflict: "CONTENT_APPROVAL_CONFLICT",
  contentApprovalContentRequired: "CONTENT_APPROVAL_CONTENT_REQUIRED",
  contentApprovalMediaPending: "CONTENT_APPROVAL_MEDIA_PENDING",
  contentApprovalSelfReview: "CONTENT_APPROVAL_SELF_REVIEW",
  contentApprovalStale: "CONTENT_APPROVAL_STALE",
  contentApprovalPublisherConnectionRequired: "CONTENT_APPROVAL_PUBLISHER_CONNECTION_REQUIRED",
  contentApprovalPublisherMediaUnsupported: "CONTENT_APPROVAL_PUBLISHER_MEDIA_UNSUPPORTED",
  contentApprovalPublisherTextLimit: "CONTENT_APPROVAL_PUBLISHER_TEXT_LIMIT",
  socialPublicationReconciliationConflict: "SOCIAL_PUBLICATION_RECONCILIATION_CONFLICT",
  socialPublicationRetryLimitReached: "SOCIAL_PUBLICATION_RETRY_LIMIT_REACHED",
  contentMediaLimitReached: "CONTENT_MEDIA_LIMIT_REACHED",
  contentMediaGenerationFailed: "CONTENT_MEDIA_GENERATION_FAILED",
  contentMediaGenerationUnavailable: "CONTENT_MEDIA_GENERATION_UNAVAILABLE",
  aiServiceUnavailable: "AI_SERVICE_UNAVAILABLE",
  teamMemberNotFound: "TEAM_MEMBER_NOT_FOUND",
  workspaceNotificationNotFound: "WORKSPACE_NOTIFICATION_NOT_FOUND",
  teamOperationNotAllowed: "TEAM_OPERATION_NOT_ALLOWED",
  invitationNotFound: "INVITATION_NOT_FOUND",
  invitationDeliveryUnavailable: "INVITATION_DELIVERY_UNAVAILABLE",
  invitationAlreadyExists: "INVITATION_ALREADY_EXISTS",
  serviceUnavailable: "SERVICE_UNAVAILABLE",
  internalError: "INTERNAL_ERROR",
} as const;

export const TEAM_AUDIT_ACTIONS = {
  memberRoleChanged: "member_role_changed",
  memberRemoved: "member_removed",
  invitationCreated: "invitation_created",
  invitationResent: "invitation_resent",
  invitationCancelled: "invitation_cancelled",
  invitationAccepted: "invitation_accepted",
  invitationDeliveryFailed: "invitation_delivery_failed",
} as const;

export const TEAM_AUDIT_ACTION_VALUES = [
  TEAM_AUDIT_ACTIONS.memberRoleChanged,
  TEAM_AUDIT_ACTIONS.memberRemoved,
  TEAM_AUDIT_ACTIONS.invitationCreated,
  TEAM_AUDIT_ACTIONS.invitationResent,
  TEAM_AUDIT_ACTIONS.invitationCancelled,
  TEAM_AUDIT_ACTIONS.invitationAccepted,
  TEAM_AUDIT_ACTIONS.invitationDeliveryFailed,
] as const;

export const INVITATION_STATUSES = ["pending", "accepted", "rejected", "canceled"] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INVITATION_STATUS = {
  pending: "pending",
  accepted: "accepted",
  rejected: "rejected",
  canceled: "canceled",
} as const;

export const TEAM_MEMBER_LIMIT = 100;

export const TEAM_INVITATION_LIMIT = 100;

export const TEAM_AUDIT_LIMIT = 100;

export const DATA_TABLE_PAGE_SIZES = [10, 25, 50] as const;

export const DATA_TABLE_DEFAULT_PAGE_SIZE = 10;

export const DATA_TABLE_FIELD_PREFIXES = {
  filter: "data-table-filter-",
  pageSize: "data-table-page-size-",
} as const;

export const TEAM_API_PATHS = {
  collection: "/api/team",
  invitations: "/api/team/invitations",
  audit: "/api/team/audit",
} as const;

export const TEAM_FORM_ID_PREFIXES = {
  role: "team-role-",
  invite: "team-invite-",
} as const;

export const EMAIL_ENV = {
  host: "SMTP_HOST",
  port: "SMTP_PORT",
  secure: "SMTP_SECURE",
  requireTls: "SMTP_REQUIRE_TLS",
  user: "SMTP_USER",
  password: "SMTP_PASSWORD",
  from: "MAIL_FROM_EMAIL",
} as const;

export const EMAIL_DELIVERY_LIMITS = {
  connectionTimeoutMilliseconds: 10_000,
  greetingTimeoutMilliseconds: 10_000,
  socketTimeoutMilliseconds: 20_000,
  verificationExpirySeconds: 3_600,
  invitationExpirySeconds: 604_800,
  passwordResetExpirySeconds: 3_600,
} as const;

export const AUTH_QUERY_PARAMETERS = {
  invitationId: "invitationId",
} as const;

export const EMAIL_ROUTES = {
  invitationAccept: `/${DEFAULT_LOCALE}/accept-invitation`,
  passwordReset: (locale: Locale) => `/${locale}/reset-password`,
} as const;

export const INVITATION_PAGE_ROUTE = "/accept-invitation";

export const INVITATION_ID_MAX_CHARACTERS = 256;

export const TENANT_ROLE = {
  owner: "owner",
  admin: "admin",
  editor: "editor",
  approver: "approver",
  analyst: "analyst",
} as const;

export const TENANT_ROLES = Object.values(TENANT_ROLE);

export const TEAM_ROLES = TENANT_ROLES;

export type TenantRole = (typeof TENANT_ROLES)[number];

export const TENANT_PERMISSIONS = {
  organizationManage: "organization:manage",
  membersManage: "members:manage",
  brandsRead: "brands:read",
  brandsManage: "brands:manage",
  contentRead: "content:read",
  contentManage: "content:manage",
  contentApprove: "content:approve",
  contentApprovalPoliciesManage: "content:approval-policies:manage",
  analyticsRead: "analytics:read",
  competitorResearchRead: "competitor-research:read",
  competitorResearchManage: "competitor-research:manage",
} as const;

export type TenantPermission = (typeof TENANT_PERMISSIONS)[keyof typeof TENANT_PERMISSIONS];

export const TENANT_ROLE_PERMISSIONS = {
  [TENANT_ROLE.owner]: [TENANT_PERMISSIONS.organizationManage, TENANT_PERMISSIONS.membersManage, TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.brandsManage, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentManage, TENANT_PERMISSIONS.contentApprove, TENANT_PERMISSIONS.contentApprovalPoliciesManage, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead, TENANT_PERMISSIONS.competitorResearchManage],
  [TENANT_ROLE.admin]: [TENANT_PERMISSIONS.membersManage, TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.brandsManage, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentManage, TENANT_PERMISSIONS.contentApprove, TENANT_PERMISSIONS.contentApprovalPoliciesManage, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead, TENANT_PERMISSIONS.competitorResearchManage],
  [TENANT_ROLE.editor]: [TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentManage, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead, TENANT_PERMISSIONS.competitorResearchManage],
  [TENANT_ROLE.approver]: [TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentApprove, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead],
  [TENANT_ROLE.analyst]: [TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.analyticsRead, TENANT_PERMISSIONS.competitorResearchRead],
} as const;
