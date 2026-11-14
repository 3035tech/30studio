export const PRODUCT = {
  name: "30studio",
  groupName: "Grupo 3035",
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
  serviceUnavailable: "SERVICE_UNAVAILABLE",
  internalError: "INTERNAL_ERROR",
} as const;

export const BETTER_AUTH_ENV = {
  secret: "BETTER_AUTH_SECRET",
  url: "BETTER_AUTH_URL",
  trustedOrigins: "BETTER_AUTH_TRUSTED_ORIGINS",
} as const;

export const TENANT_ROLES = ["owner", "admin", "editor", "approver", "analyst"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const TENANT_ROLE_PERMISSIONS = {
  owner: ["organization:manage", "members:manage", "brands:read", "brands:manage", "content:read", "content:manage", "content:approve", "analytics:read"],
  admin: ["members:manage", "brands:read", "brands:manage", "content:read", "content:manage", "content:approve", "analytics:read"],
  editor: ["brands:read", "content:manage", "analytics:read"],
  approver: ["brands:read", "content:read", "content:approve", "analytics:read"],
  analyst: ["brands:read", "content:read", "analytics:read"],
} as const;

export type TenantPermission = (typeof TENANT_ROLE_PERMISSIONS)[TenantRole][number];
