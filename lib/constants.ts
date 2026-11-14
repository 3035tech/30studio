export const PRODUCT = {
  name: "30studio",
  groupName: "Grupo 3035",
} as const;

export const WORKSPACE_SECTION_IDS = {
  overview: "workspace-overview",
  brands: "workspace-brands",
  createBrand: "workspace-create-brand",
  team: "workspace-team",
} as const;

export const BRAND_ASSETS = {
  logoOnLight: "/brand/logos/logo-default.png",
  logoOnDark: "/brand/logos/logo-light.png",
  icon16: "/brand/icons/icon-16.png",
  icon32: "/brand/icons/icon-32.png",
  icon192: "/brand/icons/icon-192.png",
  icon512: "/brand/icons/icon-512.png",
  appleTouchIcon: "/brand/icons/icon-180.png",
  favicon: "/brand/icons/favicon.ico",
  manifest: "/brand/site.webmanifest",
} as const;

export const LOCALES = ["pt", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt";
export const HTML_LANG: Record<Locale, string> = { pt: "pt-BR", en: "en" };

export const SOCIAL_PLATFORMS = [
  "linkedin",
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "youtube",
  "threads",
  "pinterest",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export const SOCIAL_PROFILE_STATUSES = ["not_connected", "pending", "connected", "reauth_required", "disabled"] as const;
export type SocialProfileStatus = (typeof SOCIAL_PROFILE_STATUSES)[number];

export const BRAND_COLORS = ["violet", "blue", "green", "orange", "ink"] as const;
export type BrandColor = (typeof BRAND_COLORS)[number];

export const BRAND_LIMITS = {
  nameCharacters: 80,
  descriptionCharacters: 180,
  industryCharacters: 80,
  markCharacters: 2,
} as const;

export const BRAND_KIT_VERSION_STATUSES = ["draft", "approved", "superseded"] as const;
export type BrandKitVersionStatus = (typeof BRAND_KIT_VERSION_STATUSES)[number];
export const BRAND_KIT_VERSION_STATUS = {
  draft: "draft",
  approved: "approved",
  superseded: "superseded",
} as const;
export const BRAND_ASSET_STATUSES = ["upload_pending", "pending_review", "approved", "rejected"] as const;
export type BrandAssetStatus = (typeof BRAND_ASSET_STATUSES)[number];
export const BRAND_ASSET_STATUS = {
  uploadPending: "upload_pending",
  pendingReview: "pending_review",
  approved: "approved",
  rejected: "rejected",
} as const;
export const BRAND_ASSET_KINDS = ["logo", "template_reference", "other"] as const;
export type BrandAssetKind = (typeof BRAND_ASSET_KINDS)[number];
export const BRAND_ASSET_REVIEW_DECISIONS = ["approved", "rejected"] as const;
export const BRAND_ASSET_REVIEW_DECISION = {
  approved: "approved",
  rejected: "rejected",
} as const;
export const BRAND_ASSET_LIMITS = {
  maximumBytes: 10 * 1024 * 1024,
  maximumImagePixels: 20_000_000,
  maximumFileNameCharacters: 180,
  maximumSourceUrlCharacters: 2_048,
  maximumLicenseCharacters: 500,
  maximumAltTextCharacters: 500,
  uploadExpirySeconds: 300,
  abandonedUploadRetentionSeconds: 86_400,
  cleanupBatchSize: 100,
  downloadExpirySeconds: 60,
  listItems: 100,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;
export const BRAND_ASSET_EXTENSIONS_BY_MIME = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
} as const;
export const BRAND_ASSET_FORMATS_BY_MIME = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export const BRAND_ASSET_API_PATHS = {
  brands: "/api/brands",
  segment: "assets",
  finalizeAction: "finalize",
  reviewAction: "review",
  downloadAction: "download",
} as const;
export const BRAND_ASSET_ACTIONS = {
  finalize: BRAND_ASSET_API_PATHS.finalizeAction,
  review: BRAND_ASSET_API_PATHS.reviewAction,
  download: BRAND_ASSET_API_PATHS.downloadAction,
} as const;
export const BRAND_ASSET_ENV = {
  bucket: "STUDIO_ASSET_BUCKET",
  region: "AWS_REGION",
  endpoint: "STUDIO_ASSET_ENDPOINT",
} as const;
export function getBrandAssetsApiPath(brandId: string) {
  return `${BRAND_ASSET_API_PATHS.brands}/${encodeURIComponent(brandId)}/${BRAND_ASSET_API_PATHS.segment}`;
}
export function getBrandAssetActionApiPath(brandId: string, assetId: string, action: typeof BRAND_ASSET_ACTIONS[keyof typeof BRAND_ASSET_ACTIONS]) {
  return `${getBrandAssetsApiPath(brandId)}/${encodeURIComponent(assetId)}/${action}`;
}
export const BRAND_ASSET_UI_IDS = {
  libraryPrefix: "brand-asset-library-",
  filePrefix: "brand-asset-file-",
  kindPrefix: "brand-asset-kind-",
  sourcePrefix: "brand-asset-source-",
  licensePrefix: "brand-asset-license-",
  rightsExpiryPrefix: "brand-asset-rights-expiry-",
  altTextPrefix: "brand-asset-alt-text-",
  reviewNotePrefix: "brand-asset-review-note-",
} as const;
export const BRAND_KIT_LIMITS = {
  textCharacters: 2_000,
  itemCharacters: 200,
  itemsPerField: 30,
  colors: 12,
  facts: 30,
  sources: 256,
  historyVersions: 100,
  initialVersion: 0,
  versionIncrement: 1,
} as const;

export const AUTH_LIMITS = {
  passwordCharacters: 8,
  nameCharacters: 100,
  slugCharacters: 48,
} as const;

export const DATABASE_LIMITS = {
  poolConnections: 8,
  connectionTimeoutMilliseconds: 5_000,
  idleTimeoutMilliseconds: 30_000,
} as const;

export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  unprocessable: 422,
  internalError: 500,
  unavailable: 503,
} as const;

export const API_ERROR_CODES = {
  authUnavailable: "AUTH_UNAVAILABLE",
  unauthenticated: "UNAUTHENTICATED",
  forbidden: "FORBIDDEN",
  organizationRequired: "ORGANIZATION_REQUIRED",
  invalidRequest: "INVALID_REQUEST",
  brandExists: "BRAND_EXISTS",
  brandNotFound: "BRAND_NOT_FOUND",
  profileExists: "PROFILE_EXISTS",
  brandAssetNotFound: "BRAND_ASSET_NOT_FOUND",
  brandAssetInvalid: "BRAND_ASSET_INVALID",
  brandAssetStateConflict: "BRAND_ASSET_STATE_CONFLICT",
  teamMemberNotFound: "TEAM_MEMBER_NOT_FOUND",
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
export const BRAND_KIT_API_PATHS = {
  brands: "/api/brands",
  segment: "brand-kit",
  approveAction: "approve",
} as const;
export function getBrandKitApiPath(brandId: string) {
  return `${BRAND_KIT_API_PATHS.brands}/${encodeURIComponent(brandId)}/${BRAND_KIT_API_PATHS.segment}`;
}
export const BRAND_KIT_UI_IDS = {
  editorPrefix: "brand-kit-editor-",
  titleSuffix: "-title",
  historySuffix: "-history",
} as const;
export const TEAM_FORM_ID_PREFIXES = {
  role: "team-role-",
  invite: "team-invite-",
} as const;

export const BETTER_AUTH_ENV = {
  secret: "BETTER_AUTH_SECRET",
  url: "BETTER_AUTH_URL",
  trustedOrigins: "BETTER_AUTH_TRUSTED_ORIGINS",
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
} as const;
export const AUTH_QUERY_PARAMETERS = {
  invitationId: "invitationId",
} as const;
export const EMAIL_ROUTES = {
  invitationAccept: `/${DEFAULT_LOCALE}/accept-invitation`,
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
  analyticsRead: "analytics:read",
} as const;
export type TenantPermission = (typeof TENANT_PERMISSIONS)[keyof typeof TENANT_PERMISSIONS];

export const TENANT_ROLE_PERMISSIONS = {
  [TENANT_ROLE.owner]: [TENANT_PERMISSIONS.organizationManage, TENANT_PERMISSIONS.membersManage, TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.brandsManage, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentManage, TENANT_PERMISSIONS.contentApprove, TENANT_PERMISSIONS.analyticsRead],
  [TENANT_ROLE.admin]: [TENANT_PERMISSIONS.membersManage, TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.brandsManage, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentManage, TENANT_PERMISSIONS.contentApprove, TENANT_PERMISSIONS.analyticsRead],
  [TENANT_ROLE.editor]: [TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.contentManage, TENANT_PERMISSIONS.analyticsRead],
  [TENANT_ROLE.approver]: [TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.contentApprove, TENANT_PERMISSIONS.analyticsRead],
  [TENANT_ROLE.analyst]: [TENANT_PERMISSIONS.brandsRead, TENANT_PERMISSIONS.contentRead, TENANT_PERMISSIONS.analyticsRead],
} as const;
