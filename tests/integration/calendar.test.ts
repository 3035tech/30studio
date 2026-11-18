import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { CONTENT_APPROVAL_STATUS, CONTENT_MEDIA_CAROUSEL, CONTENT_MEDIA_STATUS, CONTENT_MEDIA_TEMPLATE, CONTENT_MEDIA_WORKER, CONTENT_STATUS, SOCIAL_PLATFORMS, SOCIAL_PUBLICATION_JOB_STATUS, SOCIAL_PUBLICATION_LEASE_TIMEOUT_MILLISECONDS } from "@/lib/constants";
import { createBrand } from "@/lib/db/repositories/brands";
import { approveBrandKitVersion, createBrandKitVersion } from "@/lib/db/repositories/brand-kits";
import { claimNextContentMediaJob, completeContentMediaJob, createCalendarCampaign, createCalendarContentVersion, createCalendarIdea, enqueueContentCarouselGeneration, enqueueContentMediaGeneration, failContentMediaJob, getCalendarContentReviewContext, getCalendarContentVersions, listCalendarItems, listContentMediaForVersion, reviewContentMedia, updateCalendarIdea } from "@/lib/db/repositories/calendar";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { decideContentApproval, getContentApprovalState, submitContentForApproval } from "@/lib/db/repositories/content-approvals";
import { saveContentApprovalPolicy } from "@/lib/db/repositories/content-approval-policies";
import { claimNextDueSocialPublicationJob, recoverExpiredSocialPublicationLeases } from "@/lib/db/repositories/social-publication-worker";
import { contentMediaAssets, organization, socialProfileCredentials, socialProfiles, socialPublicationAttempts, socialPublicationJobs, user } from "@/lib/db/schema";

const ids = {
  user: `calendar-test-user-${crypto.randomUUID()}`,
  reviewer: `calendar-test-reviewer-${crypto.randomUUID()}`,
  secondReviewer: `calendar-test-reviewer-two-${crypto.randomUUID()}`,
  organizationA: `calendar-test-org-a-${crypto.randomUUID()}`,
  organizationB: `calendar-test-org-b-${crypto.randomUUID()}`,
} as const;
let usersCreated = false;
let organizationsCreated = false;

after(async () => {
  const database = getDatabase();
  try {
    if (organizationsCreated) await database.delete(organization).where(inArray(organization.id, [ids.organizationA, ids.organizationB]));
    if (usersCreated) await database.delete(user).where(inArray(user.id, [ids.user, ids.reviewer, ids.secondReviewer]));
  } finally {
    await closeDatabase();
  }
});

test("calendar ideas are persisted by tenant and listed only within the requested brand and period", async () => {
  const database = getDatabase();
  const now = new Date();
  await database.insert(user).values([
    { id: ids.user, name: "Calendar integration test", email: `${ids.user}@example.invalid`, emailVerified: true, createdAt: now, updatedAt: now },
    { id: ids.reviewer, name: "Calendar reviewer test", email: `${ids.reviewer}@example.invalid`, emailVerified: true, createdAt: now, updatedAt: now },
    { id: ids.secondReviewer, name: "Second calendar reviewer test", email: `${ids.secondReviewer}@example.invalid`, emailVerified: true, createdAt: now, updatedAt: now },
  ]);
  usersCreated = true;
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
  const socialProfileId = crypto.randomUUID();
  await database.insert(socialProfiles).values({
    id: socialProfileId,
    organizationId: ids.organizationA,
    brandId: brandA.id,
    platform: "linkedin",
    displayName: "LinkedIn approval test profile",
    externalAccountId: "approval-test-profile",
    connectedBy: ids.user,
    connectedAt: now,
    status: "connected",
  });
  await database.insert(socialProfileCredentials).values({
    organizationId: ids.organizationA,
    socialProfileId,
    accessTokenCiphertext: "integration-test-ciphertext",
    encryptionKeyVersion: 1,
    scopes: ["w_member_social"],
    updatedAt: now,
  });

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
    expectedVersionNumber: 0,
  });
  assert.ok(firstVersion);
  assert.equal(firstVersion.kind, "created");
  if (firstVersion.kind !== "created") return;
  assert.equal(firstVersion.versionNumber, 1);
  const savedVersion = await getCalendarContentVersions(ids.organizationA, item.id);
  assert.equal(savedVersion?.current?.capabilitySnapshot?.platform, SOCIAL_PLATFORMS[0]);
  assert.equal(savedVersion?.current?.capabilitySnapshot?.capabilityVersion, 1);
  const contentReviewContext = await getCalendarContentReviewContext(ids.organizationA, item.id);
  assert.equal(contentReviewContext?.version.id, firstVersion.id);
  assert.equal(contentReviewContext?.brandKit?.version, 1);
  assert.equal(await getCalendarContentReviewContext(ids.organizationB, item.id), null);
  assert.equal((await listCalendarItems(ids.organizationA, { ...query, status: CONTENT_STATUS.draft })).data.length, 1);

  const campaignInput = {
    brandId: brandA.id,
    idempotencyKey: crypto.randomUUID(),
    title: "Enrollment campaign",
    brief: "Invite families to try the new classes.",
    startDate: "2026-11-20",
    endDate: "2026-11-30",
    publications: [
      { platform: SOCIAL_PLATFORMS[0], plannedAt: "2026-11-20T15:00:00.000Z", timeZone: "America/Sao_Paulo" },
      { platform: SOCIAL_PLATFORMS[1], plannedAt: "2026-11-22T18:30:00.000Z", timeZone: "America/Sao_Paulo" },
    ],
  };
  const campaign = await createCalendarCampaign(ids.organizationA, ids.user, campaignInput);
  assert.ok(campaign);
  assert.equal(campaign.kind, "created");
  assert.equal(campaign.publications.length, 2);
  const campaignItems = (await listCalendarItems(ids.organizationA, query)).data.filter((calendarItem) => calendarItem.campaignId === campaign.campaignId);
  assert.equal(campaignItems.length, 2);
  assert.deepEqual(campaignItems.map((calendarItem) => calendarItem.plannedAt.toISOString()), ["2026-11-20T15:00:00.000Z", "2026-11-22T18:30:00.000Z"]);
  assert.equal(campaignItems.every((calendarItem) => calendarItem.campaignTitle === "Enrollment campaign"), true);
  const outsidePeriodUpdate = await updateCalendarIdea(ids.organizationA, campaignItems[0]!.id, {
    brandId: brandA.id,
    platform: campaignItems[0]!.platform,
    title: "Enrollment campaign",
    plannedAt: "2026-12-01T15:00:00.000Z",
    timeZone: "America/Sao_Paulo",
  });
  assert.equal(outsidePeriodUpdate && "kind" in outsidePeriodUpdate ? outsidePeriodUpdate.kind : null, "period_conflict");
  const outsidePeriodVersion = await createCalendarContentVersion(ids.organizationA, ids.user, campaignItems[0]!.id, {
    brandId: brandA.id,
    platform: campaignItems[0]!.platform,
    title: "Enrollment campaign",
    plannedAt: "2026-12-01T15:00:00.000Z",
    timeZone: "America/Sao_Paulo",
    expectedVersionNumber: 0,
    canonicalCopy: "Enrollment starts soon.",
    variantCopy: "Enrollment starts soon.",
  });
  assert.equal(outsidePeriodVersion?.kind, "period_conflict");
  const campaignReplay = await createCalendarCampaign(ids.organizationA, ids.user, campaignInput);
  assert.equal(campaignReplay?.kind, "replayed");
  assert.equal(campaignReplay?.campaignId, campaign.campaignId);
  assert.equal(campaignReplay?.publications.length, 2);
  const conflictingCampaignReplay = await createCalendarCampaign(ids.organizationA, ids.user, { ...campaignInput, title: "Changed after timeout" });
  assert.equal(conflictingCampaignReplay?.kind, "conflict");
  assert.equal(await createCalendarCampaign(ids.organizationA, ids.user, {
    brandId: brandB.id,
    idempotencyKey: crypto.randomUUID(),
    title: "Cross-tenant campaign",
    brief: "Must not be stored.",
    startDate: "2026-11-18",
    endDate: "2026-11-30",
    publications: [{ platform: SOCIAL_PLATFORMS[0], plannedAt: plannedAt.toISOString(), timeZone: "America/Sao_Paulo" }],
  }), null);

  const concurrentVersions = await Promise.all([createCalendarContentVersion(ids.organizationA, ids.user, item.id, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Launch announcement",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "The updated verified source message.",
    variantCopy: "The updated LinkedIn-specific draft.",
    expectedVersionNumber: 1,
  }), createCalendarContentVersion(ids.organizationA, ids.user, item.id, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Launch announcement",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "A competing concurrent revision.",
    variantCopy: "A competing channel draft.",
    expectedVersionNumber: 1,
  })]);
  const secondVersion = concurrentVersions.find((version) => version?.kind === "created");
  assert.equal(concurrentVersions.filter((version) => version?.kind === "conflict").length, 1);
  assert.equal(secondVersion?.versionNumber, 2);
  assert.ok(secondVersion);
  if (secondVersion.kind !== "created") return;

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
  assert.equal((await enqueueContentMediaGeneration({ ...imageJobInput, prompt: "Changed prompt with the same key" })).kind, "conflict");
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
  const textCardPayload = { title: "Launch announcement", copy: "An approved static text card.", brandKit: null };
  const queuedTextCard = await enqueueContentMediaGeneration({ ...imageJobInput, idempotencyKey: crypto.randomUUID(), modelId: CONTENT_MEDIA_TEMPLATE.textCardModelId, prompt: JSON.stringify(textCardPayload) });
  assert.equal(queuedTextCard.kind, "created");
  if (queuedTextCard.kind !== "created") return;
  const claimedTextCard = await claimNextContentMediaJob(new Date(Date.now() + 10_000), ids.organizationA);
  assert.equal(claimedTextCard?.id, queuedTextCard.assetId);
  assert.equal(claimedTextCard?.modelId, CONTENT_MEDIA_TEMPLATE.textCardModelId);
  assert.deepEqual(JSON.parse(claimedTextCard?.prompt ?? "{}"), textCardPayload);
  assert.ok(claimedTextCard?.claimedAt);
  if (!claimedTextCard?.claimedAt) return;
  const firstTextCardClaimAt = claimedTextCard.claimedAt;
  const expiredLeaseAt = new Date(Date.now() - CONTENT_MEDIA_WORKER.leaseMilliseconds - 1_000);
  await database.update(contentMediaAssets).set({ claimedAt: expiredLeaseAt }).where(and(
    eq(contentMediaAssets.organizationId, ids.organizationA),
    eq(contentMediaAssets.brandId, brandA.id),
    eq(contentMediaAssets.id, claimedTextCard.id),
    eq(contentMediaAssets.status, CONTENT_MEDIA_STATUS.processing),
  ));
  const reclaimedTextCard = await claimNextContentMediaJob(new Date(), ids.organizationA);
  assert.equal(reclaimedTextCard?.id, claimedTextCard.id);
  assert.equal(reclaimedTextCard?.attempts, 2);
  assert.ok(reclaimedTextCard?.claimedAt);
  if (!reclaimedTextCard?.claimedAt) return;
  assert.equal(await completeContentMediaJob({
    organizationId: ids.organizationA,
    id: reclaimedTextCard.id,
    claimedAt: firstTextCardClaimAt,
    contentType: "image/webp",
    sizeBytes: 1_024,
    width: 1_024,
    height: 1_024,
    sha256: "c".repeat(64),
  }), null);
  const failedAt = new Date();
  await failContentMediaJob({ organizationId: ids.organizationA, id: reclaimedTextCard.id, claimedAt: reclaimedTextCard.claimedAt, attempts: reclaimedTextCard.attempts }, failedAt);
  const [retryingTextCard] = await database.select({ status: contentMediaAssets.status, attempts: contentMediaAssets.attempts, availableAt: contentMediaAssets.availableAt, failureCode: contentMediaAssets.failureCode }).from(contentMediaAssets).where(and(
    eq(contentMediaAssets.organizationId, ids.organizationA),
    eq(contentMediaAssets.brandId, brandA.id),
    eq(contentMediaAssets.id, reclaimedTextCard.id),
  ));
  assert.equal(retryingTextCard?.status, CONTENT_MEDIA_STATUS.queued);
  assert.equal(retryingTextCard?.attempts, 2);
  assert.equal(retryingTextCard?.failureCode, CONTENT_MEDIA_STATUS.failed);
  assert.ok(retryingTextCard?.availableAt && retryingTextCard.availableAt > failedAt);

  const carouselItem = await createCalendarIdea(ids.organizationA, ids.user, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Carousel integration test",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
  });
  assert.ok(carouselItem);
  const carouselVersion = await createCalendarContentVersion(ids.organizationA, ids.user, carouselItem.id, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Carousel integration test",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "One verified carousel statement with enough words to make three pages.",
    variantCopy: "One verified carousel statement with enough words to make three pages.",
    expectedVersionNumber: 0,
  });
  assert.ok(carouselVersion);
  if (carouselVersion.kind !== "created") return;
  const carouselInput = {
    organizationId: ids.organizationA,
    itemId: carouselItem.id,
    contentVersionId: carouselVersion.id,
    idempotencyKey: crypto.randomUUID(),
    userId: ids.user,
    modelId: CONTENT_MEDIA_TEMPLATE.textCardModelId,
    prompts: Array.from({ length: CONTENT_MEDIA_CAROUSEL.pageCount }, (_, index) => JSON.stringify({ ...textCardPayload, copy: `Carousel page ${index + 1} content`, pageNumber: index + 1, pageCount: CONTENT_MEDIA_CAROUSEL.pageCount })),
  };
  const carousel = await enqueueContentCarouselGeneration(carouselInput);
  assert.equal(carousel.kind, "created");
  const replayedCarousel = await enqueueContentCarouselGeneration(carouselInput);
  assert.equal(replayedCarousel.kind, "existing");
  assert.equal((await enqueueContentCarouselGeneration({ ...carouselInput, prompts: ["changed", ...carouselInput.prompts.slice(1)] })).kind, "conflict");
  if (carousel.kind !== "created") return;
  const concurrentPageClaims = await Promise.all([
    claimNextContentMediaJob(new Date(Date.now() + 10_000), ids.organizationA),
    claimNextContentMediaJob(new Date(Date.now() + 10_000), ids.organizationA),
  ]);
  assert.equal(concurrentPageClaims.filter((job) => job !== null).length, 2);
  assert.equal(new Set(concurrentPageClaims.map((job) => job?.id)).size, 2);
  for (const pageJob of concurrentPageClaims) {
    assert.equal(pageJob?.carouselId, carouselInput.idempotencyKey);
    assert.ok(pageJob?.claimedAt);
    if (!pageJob?.claimedAt) return;
    await completeContentMediaJob({
      organizationId: ids.organizationA,
      id: pageJob.id,
      claimedAt: pageJob.claimedAt,
      contentType: "image/webp",
      sizeBytes: 1_024,
      width: 1_080,
      height: 1_080,
      sha256: "b".repeat(64),
    });
  }
  const lastPageJob = await claimNextContentMediaJob(new Date(Date.now() + 10_000), ids.organizationA);
  assert.equal(lastPageJob?.carouselId, carouselInput.idempotencyKey);
  assert.ok(lastPageJob?.claimedAt);
  if (!lastPageJob?.claimedAt) return;
  await completeContentMediaJob({
    organizationId: ids.organizationA,
    id: lastPageJob.id,
    claimedAt: lastPageJob.claimedAt,
    contentType: "image/webp",
    sizeBytes: 1_024,
    width: 1_080,
    height: 1_080,
    sha256: "b".repeat(64),
  });
  const pendingCarousel = await listContentMediaForVersion(ids.organizationA, carouselItem.id, carouselVersion.id);
  assert.equal(pendingCarousel.filter((media) => media.carouselId === carouselInput.idempotencyKey).length, CONTENT_MEDIA_CAROUSEL.pageCount);
  assert.deepEqual(pendingCarousel.filter((media) => media.carouselId === carouselInput.idempotencyKey).map((media) => media.pageNumber), [1, 2, 3]);
  assert.ok(await reviewContentMedia(ids.organizationA, carouselItem.id, carousel.assetId, ids.reviewer, CONTENT_MEDIA_STATUS.approved, "Reviewed the full carousel."));
  const reviewedCarousel = await listContentMediaForVersion(ids.organizationA, carouselItem.id, carouselVersion.id);
  assert.equal(reviewedCarousel.filter((media) => media.carouselId === carouselInput.idempotencyKey && media.status === CONTENT_MEDIA_STATUS.approved).length, CONTENT_MEDIA_CAROUSEL.pageCount);

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
    expectedVersionNumber: 0,
  }), null);

  const approvalItem = await createCalendarIdea(ids.organizationA, ids.user, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Approval workflow test",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
  });
  assert.ok(approvalItem);
  const approvalVersion = await createCalendarContentVersion(ids.organizationA, ids.user, approvalItem.id, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Approval workflow test",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "Source copy for review.",
    variantCopy: "Channel copy for review.",
    expectedVersionNumber: 0,
  });
  assert.ok(approvalVersion);
  if (approvalVersion.kind !== "created") return;
  const submission = await submitContentForApproval(ids.organizationA, ids.user, approvalItem.id);
  assert.equal(submission.kind, "created");
  assert.equal((await submitContentForApproval(ids.organizationA, ids.user, approvalItem.id)).kind, "existing");
  assert.equal((await decideContentApproval(ids.organizationA, ids.user, approvalItem.id, CONTENT_APPROVAL_STATUS.approved, null)).kind, "self_review");
  const requestedChanges = await decideContentApproval(ids.organizationA, ids.reviewer, approvalItem.id, CONTENT_APPROVAL_STATUS.changesRequested, "Please make the CTA more specific.");
  assert.equal(requestedChanges.kind, "decided");
  assert.equal((await listCalendarItems(ids.organizationA, { ...query, status: CONTENT_STATUS.draft })).data.some((calendarItem) => calendarItem.id === approvalItem.id), true);

  const revisedApprovalVersion = await createCalendarContentVersion(ids.organizationA, ids.user, approvalItem.id, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Approval workflow test",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "Updated source copy for review.",
    variantCopy: "Updated channel copy with a specific CTA.",
    expectedVersionNumber: 1,
  });
  assert.ok(revisedApprovalVersion);
  if (revisedApprovalVersion.kind !== "created") return;
  const afterRevision = await getContentApprovalState(ids.organizationA, approvalItem.id);
  assert.equal(afterRevision?.history[0]?.matchesCurrent, false);
  assert.equal(afterRevision?.history[0]?.status, CONTENT_APPROVAL_STATUS.changesRequested);

  assert.equal(await saveContentApprovalPolicy(ids.organizationA, ids.user, brandA.id, 2), true);
  assert.equal((await submitContentForApproval(ids.organizationA, ids.user, approvalItem.id)).kind, "created");
  const firstApproval = await decideContentApproval(ids.organizationA, ids.reviewer, approvalItem.id, CONTENT_APPROVAL_STATUS.approved, null);
  assert.equal(firstApproval.kind, "partial");
  if (firstApproval.kind === "partial") assert.deepEqual({ approved: firstApproval.approvedCount, required: firstApproval.requiredApprovals }, { approved: 1, required: 2 });
  assert.equal((await decideContentApproval(ids.organizationA, ids.reviewer, approvalItem.id, CONTENT_APPROVAL_STATUS.approved, null)).kind, "already_decided");
  assert.equal(await saveContentApprovalPolicy(ids.organizationA, ids.user, brandA.id, 1), true);
  assert.equal((await getContentApprovalState(ids.organizationA, approvalItem.id))?.history[0]?.requiredApprovals, 2);
  assert.equal((await decideContentApproval(ids.organizationA, ids.secondReviewer, approvalItem.id, CONTENT_APPROVAL_STATUS.approved, null)).kind, "decided");
  const approvedState = await getContentApprovalState(ids.organizationA, approvalItem.id);
  assert.equal(approvedState?.itemStatus, CONTENT_STATUS.scheduled);
  assert.equal(approvedState?.history[0]?.matchesCurrent, true);
  assert.equal(approvedState?.history[0]?.status, CONTENT_APPROVAL_STATUS.approved);
  assert.equal(approvedState?.history[0]?.decisions.length, 2);
  assert.equal(await getContentApprovalState(ids.organizationB, approvalItem.id), null);

  const [queuedPublication] = await database.select({ id: socialPublicationJobs.id }).from(socialPublicationJobs).where(and(
    eq(socialPublicationJobs.organizationId, ids.organizationA),
    eq(socialPublicationJobs.contentItemId, approvalItem.id),
    eq(socialPublicationJobs.status, SOCIAL_PUBLICATION_JOB_STATUS.queued),
  ));
  assert.ok(queuedPublication);
  const claimTime = new Date();
  await database.update(socialPublicationJobs).set({ nextAttemptAt: new Date(claimTime.getTime() - 1_000) }).where(eq(socialPublicationJobs.id, queuedPublication.id));
  const concurrentClaims = await Promise.all([
    claimNextDueSocialPublicationJob(claimTime),
    claimNextDueSocialPublicationJob(claimTime),
  ]);
  const claimedPublication = concurrentClaims.find((job) => job !== null);
  assert.equal(concurrentClaims.filter((job) => job !== null).length, 1);
  assert.ok(claimedPublication);
  assert.equal(claimedPublication.id, queuedPublication.id);
  assert.equal(claimedPublication.attemptCount, 1);

  const recoveryTime = new Date();
  const expiredAt = new Date(recoveryTime.getTime() - SOCIAL_PUBLICATION_LEASE_TIMEOUT_MILLISECONDS - 1_000);
  await database.update(socialPublicationJobs).set({ lockedAt: expiredAt }).where(eq(socialPublicationJobs.id, claimedPublication.id));
  assert.equal(await recoverExpiredSocialPublicationLeases(recoveryTime), 1);
  assert.equal(await recoverExpiredSocialPublicationLeases(recoveryTime), 0);
  const [recoveredPublication] = await database.select().from(socialPublicationJobs).where(eq(socialPublicationJobs.id, queuedPublication.id));
  assert.equal(recoveredPublication?.status, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate);
  assert.equal(recoveredPublication?.lastErrorCode, "worker_lease_expired");
  const leaseAttempts = await database.select().from(socialPublicationAttempts).where(and(
    eq(socialPublicationAttempts.organizationId, ids.organizationA),
    eq(socialPublicationAttempts.jobId, queuedPublication.id),
  ));
  assert.equal(leaseAttempts.length, 1);
  assert.equal(leaseAttempts[0]?.outcome, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate);
});
