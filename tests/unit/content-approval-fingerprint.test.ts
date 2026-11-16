import assert from "node:assert/strict";
import { test } from "node:test";
import { getContentApprovalFingerprint, type ContentApprovalFingerprintInput } from "@/lib/server/content-approval-fingerprint";

const baseInput: ContentApprovalFingerprintInput = {
  contentItemId: "item-id",
  brandId: "brand-id",
  title: "Launch announcement",
  platform: "linkedin",
  plannedAt: new Date("2026-12-01T15:00:00.000Z"),
  timeZone: "America/Sao_Paulo",
  contentVersionId: "version-id",
  versionNumber: 1,
  canonicalCopy: "Verified source copy.",
  variantCopy: "LinkedIn copy.",
  brandKitVersionNumber: 3,
  capabilitySnapshot: {
    schemaVersion: 1,
    capabilityVersion: 1,
    platform: "linkedin",
    publication: "text",
    maximumTextCharacters: 3_000,
    image: null,
  },
  media: [
    { id: "asset-b", sha256: "hash-b", contentType: "image/webp", sizeBytes: 1200 },
    { id: "asset-a", sha256: "hash-a", contentType: "image/webp", sizeBytes: 1000 },
  ],
};

test("approval fingerprint is stable regardless of media query order", () => {
  const reversed = { ...baseInput, media: [...baseInput.media].reverse() };
  assert.equal(getContentApprovalFingerprint(baseInput), getContentApprovalFingerprint(reversed));
});

test("approval fingerprint changes when approved content inputs change", () => {
  const fingerprint = getContentApprovalFingerprint(baseInput);
  const changedCopy = getContentApprovalFingerprint({ ...baseInput, variantCopy: "Changed LinkedIn copy." });
  const changedSchedule = getContentApprovalFingerprint({ ...baseInput, plannedAt: new Date("2026-12-02T15:00:00.000Z") });
  const changedMedia = getContentApprovalFingerprint({ ...baseInput, media: [{ ...baseInput.media[0]!, sha256: "changed-hash" }, baseInput.media[1]!] });
  const changedCapabilities = getContentApprovalFingerprint({ ...baseInput, capabilitySnapshot: {
    schemaVersion: 1,
    capabilityVersion: 1,
    platform: "linkedin",
    publication: "text",
    maximumTextCharacters: 2_500,
    image: null,
  } });
  assert.notEqual(changedCopy, fingerprint);
  assert.notEqual(changedSchedule, fingerprint);
  assert.notEqual(changedMedia, fingerprint);
  assert.notEqual(changedCapabilities, fingerprint);
  assert.equal(
    getContentApprovalFingerprint({ ...baseInput, capabilitySnapshot: null }),
    getContentApprovalFingerprint({ ...baseInput, capabilitySnapshot: undefined }),
  );
});
