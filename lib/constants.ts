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
  teamMemberNotFound: "TEAM_MEMBER_NOT_FOUND",
  teamOperationNotAllowed: "TEAM_OPERATION_NOT_ALLOWED",
  serviceUnavailable: "SERVICE_UNAVAILABLE",
  internalError: "INTERNAL_ERROR",
} as const;

export const TEAM_AUDIT_ACTIONS = {
  memberRoleChanged: "member_role_changed",
  memberRemoved: "member_removed",
} as const;
export const TEAM_AUDIT_ACTION_VALUES = [TEAM_AUDIT_ACTIONS.memberRoleChanged, TEAM_AUDIT_ACTIONS.memberRemoved] as const;
export const TEAM_MEMBER_LIMIT = 100;
export const TEAM_API_PATHS = {
  collection: "/api/team",
} as const;
export const TEAM_FORM_ID_PREFIXES = {
  role: "team-role-",
} as const;

export const BETTER_AUTH_ENV = {
  secret: "BETTER_AUTH_SECRET",
  url: "BETTER_AUTH_URL",
  trustedOrigins: "BETTER_AUTH_TRUSTED_ORIGINS",
} as const;

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
