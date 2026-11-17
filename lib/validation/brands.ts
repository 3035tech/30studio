import { z } from "zod";
import { BRAND_ASSET_STATUSES, BRAND_KIT_VERSION_STATUSES, BRAND_LIMITS, BRAND_SEGMENTS, SOCIAL_PLATFORMS, SOCIAL_PROFILE_STATUSES } from "@/lib/constants";

export const brandCreateSchema = z.object({
  name: z.string().trim().min(1).max(BRAND_LIMITS.nameCharacters),
  description: z.string().trim().max(BRAND_LIMITS.descriptionCharacters).optional(),
  industry: z.enum(BRAND_SEGMENTS).optional(),
  websiteUrl: z.url({ protocol: /^https$/ }).max(BRAND_LIMITS.websiteUrlCharacters).refine((value) => {
    const parsed = new URL(value);
    return !parsed.username && !parsed.password;
  }).optional().or(z.literal("")),
}).strict();

export type BrandCreateInput = z.infer<typeof brandCreateSchema>;

export const brandUpdateSchema = brandCreateSchema.extend({
  industry: z.string().trim().max(BRAND_LIMITS.industryCharacters).optional(),
}).partial().refine(
  (value) => Object.keys(value).length > 0,
);

export type BrandUpdateInput = z.infer<typeof brandUpdateSchema>;

export const brandListItemSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  industry: z.string().nullable(),
  websiteUrl: z.string().url().nullable(),
  logoAssetId: z.string().uuid().nullable(),
  logoAssetStatus: z.enum(BRAND_ASSET_STATUSES).nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  brandKitStatus: z.enum(BRAND_KIT_VERSION_STATUSES).nullable(),
  socialProfiles: z.array(z.object({
    id: z.string().uuid(),
    organizationId: z.string().min(1),
    brandId: z.string().uuid(),
    platform: z.enum(SOCIAL_PLATFORMS),
    displayName: z.string(),
    handle: z.string().nullable(),
    status: z.enum(SOCIAL_PROFILE_STATUSES),
  })),
});

export const brandListResponseSchema = z.object({ data: z.array(brandListItemSchema), canManage: z.boolean() });
export type BrandListItem = z.infer<typeof brandListItemSchema>;
