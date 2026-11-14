import { z } from "zod";
import { BRAND_ASSET_EXTENSIONS_BY_MIME, BRAND_ASSET_KINDS, BRAND_ASSET_LIMITS, BRAND_ASSET_REVIEW_DECISIONS, BRAND_ASSET_STATUSES } from "@/lib/constants";

const sourceUrlSchema = z.url({ protocol: /^https$/ }).max(BRAND_ASSET_LIMITS.maximumSourceUrlCharacters).refine((value) => {
  const parsed = new URL(value);
  return !parsed.username && !parsed.password;
});

export const brandAssetUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(BRAND_ASSET_LIMITS.maximumFileNameCharacters),
  contentType: z.enum(BRAND_ASSET_LIMITS.allowedMimeTypes),
  sizeBytes: z.number().int().positive().max(BRAND_ASSET_LIMITS.maximumBytes),
  sha256: z.string().regex(/^[\da-f]{64}$/),
  kind: z.enum(BRAND_ASSET_KINDS),
  sourceUrl: sourceUrlSchema.nullable(),
  license: z.string().trim().max(BRAND_ASSET_LIMITS.maximumLicenseCharacters).nullable(),
  rightsExpiresAt: z.iso.date().nullable(),
  altText: z.string().trim().max(BRAND_ASSET_LIMITS.maximumAltTextCharacters).nullable(),
}).strict().refine(({ fileName, contentType }) => {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLocaleLowerCase("en");
  return BRAND_ASSET_EXTENSIONS_BY_MIME[contentType].some((allowedExtension) => allowedExtension === extension);
});

export const brandAssetReviewSchema = z.object({
  decision: z.enum(BRAND_ASSET_REVIEW_DECISIONS),
  note: z.string().trim().max(BRAND_ASSET_LIMITS.maximumAltTextCharacters).nullable(),
}).strict();

export const brandAssetSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(BRAND_ASSET_KINDS),
  status: z.enum(BRAND_ASSET_STATUSES),
  fileName: z.string(),
  contentType: z.enum(BRAND_ASSET_LIMITS.allowedMimeTypes),
  sizeBytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  sha256: z.string().regex(/^[\da-f]{64}$/),
  sourceUrl: sourceUrlSchema.nullable(),
  license: z.string().nullable(),
  rightsExpiresAt: z.iso.date().nullable(),
  altText: z.string().nullable(),
  createdAt: z.string().datetime(),
  createdByName: z.string(),
  reviewedAt: z.string().datetime().nullable(),
  reviewedByName: z.string().nullable(),
});

export const brandAssetsResponseSchema = z.object({ data: z.array(brandAssetSchema), canManage: z.boolean() });
export const brandAssetUploadSessionResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    status: z.enum(BRAND_ASSET_STATUSES),
    upload: z.object({ url: z.url({ protocol: /^https?$/ }), fields: z.record(z.string(), z.string()) }),
  }),
});
export const brandAssetDownloadResponseSchema = z.object({ data: z.object({ url: z.url({ protocol: /^https?$/ }) }) });
export type BrandAssetUpload = z.infer<typeof brandAssetUploadSchema>;
export type BrandAsset = z.infer<typeof brandAssetSchema>;
