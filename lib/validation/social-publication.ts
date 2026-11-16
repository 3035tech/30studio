import { z } from "zod";
import { CONTENT_STATUSES, SOCIAL_PUBLICATION_JOB_STATUSES, SOCIAL_PUBLICATION_RECONCILIATION_LIMITS, SOCIAL_PUBLICATION_RECONCILIATION_OUTCOMES } from "@/lib/constants";

export const socialPublicationReconciliationRequestSchema = z.object({
  outcome: z.enum(SOCIAL_PUBLICATION_RECONCILIATION_OUTCOMES),
  evidence: z.string().trim().min(SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.minimumEvidenceCharacters).max(SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.maximumEvidenceCharacters),
  externalPostId: z.string().trim().min(1).max(SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.maximumExternalPostIdCharacters).optional(),
  confirmedNoPost: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.outcome === "published" && !value.externalPostId) {
    context.addIssue({ code: "custom", path: ["externalPostId"], message: "A provider post ID is required when confirming publication." });
  }
  if (value.outcome !== "published" && value.externalPostId !== undefined) {
    context.addIssue({ code: "custom", path: ["externalPostId"], message: "A provider post ID cannot be set when confirming no publication." });
  }
  if (value.outcome === "retry" && value.confirmedNoPost !== true) {
    context.addIssue({ code: "custom", path: ["confirmedNoPost"], message: "Explicit confirmation is required before retrying a publication." });
  }
  if (value.outcome !== "retry" && value.confirmedNoPost !== undefined) {
    context.addIssue({ code: "custom", path: ["confirmedNoPost"], message: "Retry confirmation is only accepted for a retry outcome." });
  }
});

export const socialPublicationReconciliationResponseSchema = z.object({
  data: z.object({
    outcome: z.enum(SOCIAL_PUBLICATION_RECONCILIATION_OUTCOMES),
    publicationStatus: z.enum(SOCIAL_PUBLICATION_JOB_STATUSES),
    itemStatus: z.enum(CONTENT_STATUSES),
  }).strict(),
}).strict();
