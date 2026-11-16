import { z } from "zod";
import { CONTENT_REVIEW, CONTENT_REVIEW_CATEGORIES, CONTENT_REVIEW_LOCALES, CONTENT_REVIEW_SEVERITIES } from "@/lib/constants";

export const contentReviewRequestSchema = z.object({ locale: z.enum(CONTENT_REVIEW_LOCALES) }).strict();
export const contentReviewFindingSchema = z.object({
  category: z.enum(CONTENT_REVIEW_CATEGORIES),
  severity: z.enum(CONTENT_REVIEW_SEVERITIES),
  excerpt: z.string().trim().max(CONTENT_REVIEW.maximumFindingTextCharacters),
  explanation: z.string().trim().min(1).max(CONTENT_REVIEW.maximumFindingTextCharacters),
  suggestion: z.string().trim().max(CONTENT_REVIEW.maximumFindingTextCharacters),
}).strict();
export const contentReviewFindingsSchema = z.object({ findings: z.array(contentReviewFindingSchema).max(CONTENT_REVIEW.maximumFindings) }).strict();
export const contentReviewResponseSchema = z.object({
  data: z.object({
    contentVersionId: z.uuid(),
    versionNumber: z.number().int().positive(),
    model: z.string().min(1),
    findings: z.array(contentReviewFindingSchema).max(CONTENT_REVIEW.maximumFindings),
  }).strict(),
}).strict();
