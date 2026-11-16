import { z } from "zod";
import { CONTENT_LIMITS, CONTENT_MEDIA_TEMPLATE } from "@/lib/constants";
import { brandKitContentSchema } from "@/lib/validation/brand-kits";

export const textCardPayloadSchema = z.object({
  title: z.string().trim().min(1).max(CONTENT_MEDIA_TEMPLATE.maximumTitleCharacters),
  copy: z.string().trim().min(1).max(CONTENT_LIMITS.variantCopyCharacters),
  brandKit: brandKitContentSchema.nullable(),
  pageNumber: z.number().int().positive().optional(),
  pageCount: z.number().int().positive().optional(),
  exportWidth: z.number().int().min(1).max(3_000).optional(),
  exportHeight: z.number().int().min(1).max(3_000).optional(),
}).strict();
