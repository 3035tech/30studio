import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDAR, CONTENT_STATUS, COPY_GENERATION, SOCIAL_PLATFORMS } from "@/lib/constants";
import { calendarCampaignCreateSchema, calendarContentVersionSaveSchema, calendarCopyDraftResponseSchema, calendarItemCreateSchema, calendarItemUpdateSchema, calendarQuerySchema, contentMediaGenerationRequestSchema, contentMediaReviewSchema } from "@/lib/validation/calendar";
import { getCampaignRequestFingerprint } from "@/lib/server/campaign-idempotency";

test("calendar ideas validate tenant-owned fields and normalize their title", () => {
  const result = calendarItemCreateSchema.safeParse({
    brandId: "11111111-1111-4111-8111-111111111111",
    platform: SOCIAL_PLATFORMS[0],
    title: "  Product launch  ",
    plannedAt: "2026-11-14T12:00:00.000Z",
    timeZone: "America/Sao_Paulo",
  });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.title, "Product launch");
});

test("calendar ideas reject invalid time zones and client-selected tenant scope", () => {
  const validIdea = {
    brandId: "11111111-1111-4111-8111-111111111111",
    platform: SOCIAL_PLATFORMS[0],
    title: "Product launch",
    plannedAt: "2026-11-14T12:00:00.000Z",
    timeZone: "Invalid/Timezone",
  };
  assert.equal(calendarItemCreateSchema.safeParse(validIdea).success, false);
  assert.equal(calendarItemCreateSchema.safeParse({ ...validIdea, timeZone: "UTC", organizationId: "another-tenant" }).success, false);
});

test("calendar idea updates accept only editable calendar fields", () => {
  const validUpdate = {
    brandId: "11111111-1111-4111-8111-111111111111",
    platform: SOCIAL_PLATFORMS[0],
    title: "Product launch",
    plannedAt: "2026-11-14T12:00:00.000Z",
    timeZone: "UTC",
  };
  const result = calendarItemUpdateSchema.safeParse(validUpdate);
  assert.equal(result.success, true);
  assert.equal(calendarItemUpdateSchema.safeParse({ ...validUpdate, status: "approved" }).success, false);
  assert.equal(calendarItemUpdateSchema.safeParse({ ...validUpdate, organizationId: "another-tenant" }).success, false);
});

test("calendar content versions require bounded canonical and channel copy", () => {
  const validVersion = {
    brandId: "11111111-1111-4111-8111-111111111111",
    platform: SOCIAL_PLATFORMS[0],
    title: "Product launch",
    plannedAt: "2026-11-14T12:00:00.000Z",
    timeZone: "UTC",
    canonicalCopy: "A source draft for the campaign.",
    variantCopy: "A LinkedIn version of the draft.",
    expectedVersionNumber: 0,
  };
  assert.equal(calendarContentVersionSaveSchema.safeParse(validVersion).success, true);
  assert.equal(calendarContentVersionSaveSchema.safeParse({ ...validVersion, expectedVersionNumber: -1 }).success, false);
  assert.equal(calendarContentVersionSaveSchema.safeParse({ ...validVersion, expectedVersionNumber: undefined }).success, false);
  assert.equal(calendarContentVersionSaveSchema.safeParse({ ...validVersion, variantCopy: " " }).success, false);
  assert.equal(calendarContentVersionSaveSchema.safeParse({ ...validVersion, status: "approved" }).success, false);
});

test("generated channel copy requires three distinct bounded options", () => {
  const validResponse = {
    data: {
      canonicalCopy: "A concise source draft.",
      variantCopy: "A selected channel draft.",
      variantOptions: ["Benefit-focused draft.", "Question-led draft?", "Direct draft."],
    },
  };
  assert.equal(calendarCopyDraftResponseSchema.safeParse(validResponse).success, true);
  assert.equal(calendarCopyDraftResponseSchema.safeParse({ ...validResponse, data: { ...validResponse.data, variantOptions: ["One.", "Two."] } }).success, false);
  assert.equal(calendarCopyDraftResponseSchema.safeParse({ ...validResponse, data: { ...validResponse.data, variantOptions: ["Same.", "Same.", "Different."] } }).success, false);
  assert.equal(calendarCopyDraftResponseSchema.safeParse({ ...validResponse, data: { ...validResponse.data, variantOptions: ["x".repeat(COPY_GENERATION.maximumVariantOptionCharacters + 1), "Two.", "Three."] } }).success, false);
});

test("campaign planning accepts independent channel schedules and rejects duplicate networks", () => {
  const validCampaign = {
    brandId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    title: "Enrollment campaign",
    brief: "Invite local families to try the new classes.",
    publications: [
      { platform: SOCIAL_PLATFORMS[0], plannedAt: "2026-11-15T12:00:00.000Z", timeZone: "UTC" },
      { platform: SOCIAL_PLATFORMS[1], plannedAt: "2026-11-17T15:30:00.000Z", timeZone: "America/Sao_Paulo" },
    ],
  };
  assert.equal(calendarCampaignCreateSchema.safeParse(validCampaign).success, true);
  assert.equal(calendarCampaignCreateSchema.safeParse({ ...validCampaign, idempotencyKey: "invalid" }).success, false);
  assert.equal(calendarCampaignCreateSchema.safeParse({ ...validCampaign, publications: [] }).success, false);
  assert.equal(calendarCampaignCreateSchema.safeParse({ ...validCampaign, publications: [validCampaign.publications[0], validCampaign.publications[0]] }).success, false);
  assert.equal(calendarCampaignCreateSchema.safeParse({ ...validCampaign, organizationId: "another-tenant" }).success, false);
});

test("campaign idempotency fingerprint normalizes publication ordering", () => {
  const request = {
    brandId: "11111111-1111-4111-8111-111111111111",
    title: "Enrollment campaign",
    brief: "Invite local families to try the new classes.",
    publications: [
      { platform: SOCIAL_PLATFORMS[0], plannedAt: "2026-11-15T12:00:00.000Z", timeZone: "UTC" },
      { platform: SOCIAL_PLATFORMS[1], plannedAt: "2026-11-17T15:30:00.000Z", timeZone: "America/Sao_Paulo" },
    ],
  };
  assert.equal(
    getCampaignRequestFingerprint(request),
    getCampaignRequestFingerprint({ ...request, publications: [...request.publications].reverse() }),
  );
  assert.notEqual(getCampaignRequestFingerprint(request), getCampaignRequestFingerprint({ ...request, title: "Changed campaign" }));
});

test("content image generation requires an exact version and idempotency key", () => {
  const validRequest = {
    contentVersionId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    mode: "ai_image",
  };
  assert.equal(contentMediaGenerationRequestSchema.safeParse(validRequest).success, true);
  assert.equal(contentMediaGenerationRequestSchema.safeParse({ ...validRequest, contentVersionId: "not-a-uuid" }).success, false);
  assert.equal(contentMediaGenerationRequestSchema.safeParse({ ...validRequest, organizationId: "client-chosen-tenant" }).success, false);
});

test("content image review accepts only final human decisions", () => {
  assert.equal(contentMediaReviewSchema.safeParse({ decision: "approved", note: "Looks good." }).success, true);
  assert.equal(contentMediaReviewSchema.safeParse({ decision: "rejected", note: null }).success, true);
  assert.equal(contentMediaReviewSchema.safeParse({ decision: "queued", note: null }).success, false);
  assert.equal(contentMediaReviewSchema.safeParse({ decision: "approved", note: "x".repeat(5_001) }).success, false);
});

test("calendar query accepts one grid and rejects oversized or empty ranges", () => {
  const start = "2026-11-01T00:00:00.000Z";
  const validEnd = new Date(Date.parse(start) + CALENDAR.maximumRequestRangeDays * CALENDAR.millisecondsPerDay).toISOString();
  const validQuery = { start, end: validEnd, status: CONTENT_STATUS.idea };
  assert.equal(calendarQuerySchema.safeParse(validQuery).success, true);
  assert.equal(calendarQuerySchema.safeParse({ ...validQuery, end: start }).success, false);
  assert.equal(calendarQuerySchema.safeParse({
    start,
    end: new Date(Date.parse(start) + (CALENDAR.maximumRequestRangeDays + 1) * CALENDAR.millisecondsPerDay).toISOString(),
  }).success, false);
});
