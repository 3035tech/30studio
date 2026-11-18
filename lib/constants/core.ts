export const PRODUCT = {
  name: "30studio",
  groupName: "Grupo 3035",
} as const;

export const DATABASE_CONNECTION = {
  urlEnvironmentName: "DATABASE_URL",
  directHostEnvironmentName: "DATABASE_DIRECT_HOST",
  sslRootCertificateEnvironmentName: "DATABASE_SSL_ROOT_CERT",
  postgresPort: "5432",
  sslMode: "verify-full",
} as const;

export const WORKSPACE_UI_EVENTS = { createContent: "30studio:create-content", openCalendarItem: "30studio:open-calendar-item", openCalendarList: "30studio:open-calendar-list", openSocialConnections: "30studio:open-social-connections" } as const;

export const WORKSPACE_API_PATHS = { settings: "/api/workspace/settings" } as const;

export const WORKSPACE_LIMITS = { nameCharacters: 100 } as const;

export const WORKSPACE_NOTIFICATION_TYPES = {
  socialConnected: "social_connected",
  socialConnectionFailed: "social_connection_failed",
  approvalRequested: "approval_requested",
  approvalApproved: "approval_approved",
  approvalRejected: "approval_rejected",
  approvalChangesRequested: "approval_changes_requested",
  publicationSucceeded: "publication_succeeded",
  publicationFailed: "publication_failed",
  publicationIndeterminate: "publication_indeterminate",
} as const;

export const WORKSPACE_NOTIFICATION_TYPE_VALUES = ["social_connected", "social_connection_failed", "approval_requested", "approval_approved", "approval_rejected", "approval_changes_requested", "publication_succeeded", "publication_failed", "publication_indeterminate"] as const;

export const WORKSPACE_NOTIFICATION_LIMITS = { historyItems: 50 } as const;

export const WORKSPACE_SECTION_IDS = {
  overview: "workspace-overview",
  calendar: "workspace-calendar",
  approvals: "workspace-approvals",
  analytics: "workspace-analytics",
  competitors: "workspace-competitors",
  brands: "workspace-brands",
  connections: "workspace-connections",
  team: "workspace-team",
  profile: "workspace-profile",
} as const;

export const LOCALES = ["pt", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt";

export const HTML_LANG: Record<Locale, string> = { pt: "pt-BR", en: "en" };

