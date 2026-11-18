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

export const BRAND_COLORS = ["violet", "blue", "green", "orange", "ink"] as const;

export type BrandColor = (typeof BRAND_COLORS)[number];

export const BRAND_LIMITS = {
  nameCharacters: 80,
  descriptionCharacters: 180,
  industryCharacters: 80,
  websiteUrlCharacters: 2_048,
  markCharacters: 2,
} as const;

export const BRAND_SEGMENTS = [
  "personal",
  "technology",
  "marketing",
  "education",
  "finance",
  "health",
  "retail",
  "food",
  "fashion",
  "entertainment",
  "professional_services",
  "industry",
  "nonprofit",
  "other",
] as const;

export type BrandSegment = (typeof BRAND_SEGMENTS)[number];

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

export const LOCAL_DEVELOPMENT = {
  seedUserEmail: "demo@30studio.local",
  seedUserPassword: "30studio-local-only",
  seedUserName: "30studio Demo",
  seedOrganizationName: "30studio Local",
  seedOrganizationSlug: "30studio-local",
  credentialProviderId: "credential",
  allowedDatabaseHosts: ["localhost", "127.0.0.1", "::1", "postgres"] as const,
  allowedDatabaseNames: ["30studio", "30studio_test"] as const,
  ownerRole: "owner",
  enabledEnvironmentValue: "true",
  enabledEnvironmentName: "STUDIO_LOCAL_DEVELOPMENT",
  objectStorageBucket: "30studio-media",
  objectStorageEndpoint: "http://localstack:4566",
  objectStorageHostname: "localstack",
  objectStoragePort: "4566",
  region: "us-east-1",
  runtimeEnvironment: "development",
} as const;

export const BRAND_ASSET_ENDPOINT_SECURITY = {
  allowedProtocols: ["http:", "https:"] as const,
  loopbackHostnames: ["localhost", "127.0.0.1", "::1", "[::1]"] as const,
  rootPath: "/",
} as const;

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
  sourceUrlCharacters: 2_048,
  historyVersions: 100,
  initialVersion: 0,
  versionIncrement: 1,
} as const;

export const BRAND_KIT_API_PATHS = {
  brands: "/api/brands",
  segment: "brand-kit",
  approveAction: "approve",
} as const;

export const BRAND_KIT_UI_IDS = {
  editorPrefix: "brand-kit-editor-",
  titleSuffix: "-title",
  historySuffix: "-history",
} as const;

export function getBrandAssetsApiPath(brandId: string) {
  return `${BRAND_ASSET_API_PATHS.brands}/${encodeURIComponent(brandId)}/${BRAND_ASSET_API_PATHS.segment}`;
}

export function getBrandAssetActionApiPath(brandId: string, assetId: string, action: typeof BRAND_ASSET_ACTIONS[keyof typeof BRAND_ASSET_ACTIONS]) {
  return `${getBrandAssetsApiPath(brandId)}/${encodeURIComponent(assetId)}/${action}`;
}

export function getBrandKitApiPath(brandId: string) {
  return `${BRAND_KIT_API_PATHS.brands}/${encodeURIComponent(brandId)}/${BRAND_KIT_API_PATHS.segment}`;
}
