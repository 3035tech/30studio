import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { CONTENT_MEDIA_STATUS, CONTENT_STATUS, SOCIAL_PLATFORMS } from "@/lib/constants";
import { createBrand } from "@/lib/db/repositories/brands";
import { approveBrandKitVersion, createBrandKitVersion } from "@/lib/db/repositories/brand-kits";
import { claimNextContentMediaJob, completeContentMediaJob, createCalendarCampaign, createCalendarContentVersion, createCalendarIdea, enqueueContentMediaGeneration, getCalendarContentVersions, listCalendarItems, listContentMediaForVersion, reviewContentMedia } from "@/lib/db/repositories/calendar";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { organization, user } from "@/lib/db/schema";

const ids = {
  user: `calendar-test-user-${crypto.randomUUID()}`,
  organizationA: `calendar-test-org-a-${crypto.randomUUID()}`,
  organizationB: `calendar-test-org-b-${crypto.randomUUID()}`,
} as const;
let userCreated = false;
let organizationsCreated = false;

after(async () => {
  const database = getDatabase();
  try {
    if (organizationsCreated) await database.delete(organization).where(inArray(organization.id, [ids.organizationA, ids.organizationB]));
    if (userCreated) await database.delete(user).where(eq(user.id, ids.user));
  } finally {
    await closeDatabase();
  }
});

test("calendar ideas are persisted by tenant and listed only within the requested brand and period", async () => {
  const database = getDatabase();
  const now = new Date();
  await database.insert(user).values({
    id: ids.user,
    name: "Calendar integration test",
    email: `${ids.user}@example.invalid`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  userCreated = true;
  await database.insert(organization).values([
    { id: ids.organizationA, name: "Calendar tenant A", slug: ids.organizationA, createdAt: now },
    { id: ids.organizationB, name: "Calendar tenant B", slug: ids.organizationB, createdAt: now },
  ]);
  organizationsCreated = true;

  const brandA = await createBrand({ name: "Calendar brand A" }, ids.organizationA, ids.user);
  const brandB = await createBrand({ name: "Calendar brand B" }, ids.organizationB, ids.user);
  assert.ok(brandA);
  assert.ok(brandB);
  const brandKit = await createBrandKitVersion(ids.organizationA, brandA.id, ids.user, {
    audience: "School owners",
    toneOfVoice: "Clear and helpful",
    colors: [],
    fontFamilies: [],
    keyMessages: [],
    products: [],
    verifiedFacts: [],
    restrictedClaims: [],
    callsToAction: [],
  });
  assert.ok(brandKit);
  assert.ok(await approveBrandKitVersion(ids.organizationA, brandA.id, brandKit.id, ids.user));

  const plannedAt = new Date("2026-11-20T15:30:00.000Z");
  const item = await createCalendarIdea(ids.organizationA, ids.user, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Launch announcement",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
  });
  assert.ok(item);

  const query = { start: new Date("2026-11-01T00:00:00.000Z"), end: new Date("2026-12-01T00:00:00.000Z") };
  const tenantAItems = await listCalendarItems(ids.organizationA, query);
  assert.equal(tenantAItems.data.length, 1);
  assert.equal(tenantAItems.data[0]?.brandName, brandA.name);
  assert.equal(tenantAItems.data[0]?.status, CONTENT_STATUS.idea);
  assert.equal(tenantAItems.data[0]?.plannedAt.toISOString(), plannedAt.toISOString());
  assert.equal((await listCalendarItems(ids.organizationB, query)).data.length, 0);
  assert.equal((await createCalendarIdea(ids.organizationA, ids.user, {
    brandId: brandB.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Cross-tenant attempt",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
  })), null);
  assert.equal((await listCalendarItems(ids.organizationA, { ...query, brandId: brandB.id })).data.length, 0);

  const firstVersion = await createCalendarContentVersion(ids.organizationA, ids.user, item.id, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Launch announcement",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "The verified source message.",
    variantCopy: "A LinkedIn-specific draft.",
  });
  assert.ok(firstVersion);
  assert.equal(firstVersion.versionNumber, 1);
  assert.equal((await listCalendarItems(ids.organizationA, { ...query, status: CONTENT_STATUS.draft })).data.length, 1);

  const campaign = await createCalendarCampaign(ids.organizationA, ids.user, {
    brandId: brandA.id,
    title: "Enrollment campaign",
    brief: "Invite families to try the new classes.",
    publications: [
      { platform: SOCIAL_PLATFORMS[0], plannedAt: "2026-11-20T15:00:00.000Z", timeZone: "America/Sao_Paulo" },
      { platform: SOCIAL_PLATFORMS[1], plannedAt: "2026-11-22T18:30:00.000Z", timeZone: "America/Sao_Paulo" },
    ],
  });
  assert.ok(campaign);
  assert.equal(campaign.publications.length, 2);
  const campaignItems = (await listCalendarItems(ids.organizationA, query)).data.filter((calendarItem) => calendarItem.campaignId === campaign.campaignId);
  assert.equal(campaignItems.length, 2);
  assert.deepEqual(campaignItems.map((calendarItem) => calendarItem.plannedAt.toISOString()), ["2026-11-20T15:00:00.000Z", "2026-11-22T18:30:00.000Z"]);
  assert.equal(campaignItems.every((calendarItem) => calendarItem.campaignTitle === "Enrollment campaign"), true);
  assert.equal(await createCalendarCampaign(ids.organizationA, ids.user, {
    brandId: brandB.id,
    title: "Cross-tenant campaign",
    brief: "Must not be stored.",
    publications: [{ platform: SOCIAL_PLATFORMS[0], plannedAt: plannedAt.toISOString(), timeZone: "America/Sao_Paulo" }],
  }), null);

  const secondVersion = await createCalendarContentVersion(ids.organizationA, ids.user, item.id, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Launch announcement",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "The updated verified source message.",
    variantCopy: "The updated LinkedIn-specific draft.",
  });
  assert.equal(secondVersion?.versionNumber, 2);
  assert.ok(secondVersion);

  const imageJobKey = crypto.randomUUID();
  const imageJobInput = {
    organizationId: ids.organizationA,
    itemId: item.id,
    contentVersionId: secondVersion.id,
    idempotencyKey: imageJobKey,
    userId: ids.user,
    modelId: "mock-image-model",
    prompt: "A private image generation test prompt.",
  };
  const queuedImage = await enqueueContentMediaGeneration(imageJobInput);
  assert.equal(queuedImage.kind, "created");
  if (queuedImage.kind !== "created") return;
  const repeatedImageRequest = await enqueueContentMediaGeneration(imageJobInput);
  assert.equal(repeatedImageRequest.kind, "existing");
  assert.equal(repeatedImageRequest.kind === "existing" ? repeatedImageRequest.assetId : "", queuedImage.assetId);
  assert.equal((await enqueueContentMediaGeneration({ ...imageJobInput, organizationId: ids.organizationB, idempotencyKey: crypto.randomUUID() })).kind, "not_found");

  const claimedImage = await claimNextContentMediaJob(new Date(Date.now() + 10_000), ids.organizationA);
  assert.equal(claimedImage?.id, queuedImage.assetId);
  assert.ok(claimedImage?.claimedAt);
  if (!claimedImage?.claimedAt) return;
  assert.ok(await completeContentMediaJob({
    organizationId: ids.organizationA,
    id: claimedImage.id,
    claimedAt: claimedImage.claimedAt,
    contentType: "image/webp",
    sizeBytes: 1_024,
    width: 1_024,
    height: 1_024,
    sha256: "a".repeat(64),
  }));
  assert.ok(await reviewContentMedia(ids.organizationA, item.id, claimedImage.id, ids.user, CONTENT_MEDIA_STATUS.approved, "Image looks good."));
  const reviewedMedia = await listContentMediaForVersion(ids.organizationA, item.id, secondVersion.id);
  assert.equal(reviewedMedia.length, 1);
  assert.equal(reviewedMedia[0]?.status, CONTENT_MEDIA_STATUS.approved);

  const history = await getCalendarContentVersions(ids.organizationA, item.id);
  assert.equal(history?.current?.versionNumber, 2);
  assert.equal(history?.current?.brandKitVersionNumber, 1);
  assert.equal(history?.current?.canonicalCopy, "The updated verified source message.");
  assert.deepEqual(history?.history.map((version) => version.versionNumber), [2, 1]);
  assert.equal(await getCalendarContentVersions(ids.organizationB, item.id), null);
  assert.equal(await createCalendarContentVersion(ids.organizationB, ids.user, item.id, {
    brandId: brandB.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Cross-tenant attempt",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "Must not be stored.",
    variantCopy: "Must not be stored.",
  }), null);
});
