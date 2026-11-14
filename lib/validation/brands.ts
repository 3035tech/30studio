import { z } from "zod";
import { BRAND_LIMITS, SOCIAL_PLATFORMS, SOCIAL_PROFILE_STATUSES } from "@/lib/constants";

export const brandCreateSchema = z.object({
  name: z.string().trim().min(1).max(BRAND_LIMITS.nameCharacters),
  description: z.string().trim().max(BRAND_LIMITS.descriptionCharacters).optional(),
  industry: z.string().trim().max(BRAND_LIMITS.industryCharacters).optional(),
}).strict();

export type BrandCreateInput = z.infer<typeof brandCreateSchema>;

export const brandUpdateSchema = brandCreateSchema.partial().refine(
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
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

export const brandListResponseSchema = z.object({ data: z.array(brandListItemSchema) });
export type BrandListItem = z.infer<typeof brandListItemSchema>;
