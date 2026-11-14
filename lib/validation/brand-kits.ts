import { z } from "zod";
import { BRAND_KIT_LIMITS, BRAND_KIT_VERSION_STATUSES } from "@/lib/constants";

const boundedTextSchema = z.string().trim().max(BRAND_KIT_LIMITS.textCharacters);
const listItemSchema = z.string().trim().min(1).max(BRAND_KIT_LIMITS.itemCharacters);
const stringListSchema = z.array(listItemSchema).max(BRAND_KIT_LIMITS.itemsPerField);
const sourceUrlSchema = z.url({ protocol: /^https$/ }).max(BRAND_KIT_LIMITS.sources).refine((value) => {
  const parsed = new URL(value);
  return !parsed.username && !parsed.password;
});

export const brandKitFactSchema = z.object({
  statement: z.string().trim().min(1).max(BRAND_KIT_LIMITS.itemCharacters),
  sourceUrl: sourceUrlSchema,
}).strict();

export const brandKitContentSchema = z.object({
  audience: boundedTextSchema,
  toneOfVoice: boundedTextSchema,
  colors: z.array(z.string().regex(/^#[\da-fA-F]{6}$/)).max(BRAND_KIT_LIMITS.colors),
  fontFamilies: stringListSchema,
  keyMessages: stringListSchema,
  products: stringListSchema,
  verifiedFacts: z.array(brandKitFactSchema).max(BRAND_KIT_LIMITS.facts),
  restrictedClaims: stringListSchema,
  callsToAction: stringListSchema,
}).strict();

export const brandKitVersionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(BRAND_KIT_VERSION_STATUSES),
  content: brandKitContentSchema,
  createdAt: z.string().datetime(),
  createdByName: z.string(),
  approvedAt: z.string().datetime().nullable(),
  approvedByName: z.string().nullable(),
});

export const brandKitVersionsResponseSchema = z.object({
  data: z.array(brandKitVersionSchema),
  canManage: z.boolean(),
});

export const brandKitVersionCreateSchema = brandKitContentSchema;

export type BrandKitContent = z.infer<typeof brandKitContentSchema>;
export type BrandKitFact = z.infer<typeof brandKitFactSchema>;
export type BrandKitVersion = z.infer<typeof brandKitVersionSchema>;
