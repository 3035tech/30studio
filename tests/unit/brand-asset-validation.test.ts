import assert from "node:assert/strict";
import test from "node:test";
import { BRAND_ASSET_KINDS, BRAND_ASSET_LIMITS } from "@/lib/constants";
import { brandAssetReviewSchema, brandAssetUploadSchema } from "@/lib/validation/brand-assets";

const validUpload = {
  fileName: "logo.png",
  contentType: BRAND_ASSET_LIMITS.allowedMimeTypes[1],
  sizeBytes: 1_024,
  sha256: "a".repeat(64),
  kind: BRAND_ASSET_KINDS[0],
  sourceUrl: "https://example.com/brand/logo",
  license: "Owned by the brand",
  rightsExpiresAt: null,
  altText: "Brand logo",
};

test("brand asset upload accepts a scoped image and provenance", () => {
  assert.deepEqual(brandAssetUploadSchema.parse(validUpload), validUpload);
});

test("brand asset upload rejects unsupported types, oversize files, and unsafe sources", () => {
  assert.equal(brandAssetUploadSchema.safeParse({ ...validUpload, contentType: "image/svg+xml" }).success, false);
  assert.equal(brandAssetUploadSchema.safeParse({ ...validUpload, sizeBytes: BRAND_ASSET_LIMITS.maximumBytes + 1 }).success, false);
  assert.equal(brandAssetUploadSchema.safeParse({ ...validUpload, sourceUrl: "https://user:password@example.com/logo" }).success, false);
  assert.equal(brandAssetUploadSchema.safeParse({ ...validUpload, sourceUrl: "http://example.com/logo" }).success, false);
  assert.equal(brandAssetUploadSchema.safeParse({ ...validUpload, sha256: "not-a-checksum" }).success, false);
  assert.equal(brandAssetUploadSchema.safeParse({ ...validUpload, rightsExpiresAt: "2026-02-30" }).success, false);
});

test("brand asset review accepts only a decision and bounded note", () => {
  assert.equal(brandAssetReviewSchema.safeParse({ decision: "approved", note: null }).success, true);
  assert.equal(brandAssetReviewSchema.safeParse({ decision: "pending_review", note: null }).success, false);
  assert.equal(brandAssetReviewSchema.safeParse({ decision: "rejected", note: "because", organizationId: "other-tenant" }).success, false);
});
