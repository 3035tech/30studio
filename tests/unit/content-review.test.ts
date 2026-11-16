import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTENT_REVIEW } from "@/lib/constants";
import { contentReviewFindingsSchema, contentReviewRequestSchema, contentReviewResponseSchema } from "@/lib/validation/content-review";

test("content review accepts only the supported locale and exact request shape", () => {
  assert.equal(contentReviewRequestSchema.safeParse({ locale: "pt" }).success, true);
  assert.equal(contentReviewRequestSchema.safeParse({ locale: "fr" }).success, false);
  assert.equal(contentReviewRequestSchema.safeParse({ locale: "en", content: "client supplied copy" }).success, false);
});

test("content review findings are bounded and use known categories and severity levels", () => {
  const finding = { category: "unsupported_claim", severity: "medium", excerpt: "Guaranteed results", explanation: "This claim is not present in the approved facts.", suggestion: "Remove the guarantee." };
  assert.equal(contentReviewFindingsSchema.safeParse({ findings: [finding] }).success, true);
  assert.equal(contentReviewFindingsSchema.safeParse({ findings: [{ ...finding, category: "invented" }] }).success, false);
  assert.equal(contentReviewFindingsSchema.safeParse({ findings: Array.from({ length: CONTENT_REVIEW.maximumFindings + 1 }, () => finding) }).success, false);
});

test("content review response is bound to a version and cannot contain malformed findings", () => {
  const validResponse = { data: { contentVersionId: crypto.randomUUID(), versionNumber: 2, model: "configured-model", findings: [] } };
  assert.equal(contentReviewResponseSchema.safeParse(validResponse).success, true);
  assert.equal(contentReviewResponseSchema.safeParse({ data: { ...validResponse.data, contentVersionId: "not-a-uuid" } }).success, false);
});
