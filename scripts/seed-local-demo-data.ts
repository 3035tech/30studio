import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { CONTENT_APPROVAL_POLICY, CONTENT_STATUS, CONTENT_MEDIA_TEMPLATE, LOCAL_DEVELOPMENT, SOCIAL_PLATFORMS, TEAM_AUDIT_ACTIONS, TENANT_ROLE } from "@/lib/constants";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import {
  brandAssetReviews, brandAssets, brandKitVersions, brands,
  campaigns, competitorAlertSettings, competitorFetchRuns, competitorObservations, competitorSources,
  contentApprovalDecisions, contentApprovalPolicies, contentApprovalRequests, contentItems,
  contentMediaAssets, contentMediaReviews, contentVariants, contentVersions, dashboardPublicationGoals,
  invitation, member, organization, socialAnalyticsSnapshots, socialConnectionEvents,
  socialPublicationAttempts, socialPublicationJobs, socialPublicationReconciliations, socialProfiles,
  teamAuditEvents, user,
} from "@/lib/db/schema";
import { renderTextCard } from "@/lib/server/content-media-template";
import { storeVerifiedBrandAsset } from "@/lib/server/brand-asset-storage";
import type { BrandKitContent } from "@/lib/validation/brand-kits";

const SAMPLE_RECORDS = 100;
const SAMPLE_MEMBER_COUNT = SAMPLE_RECORDS - 1;
const SAMPLE_PREFIX = "sample-";
const DEMO_MEDIA_MODEL = CONTENT_MEDIA_TEMPLATE.textCardModelId;
const TENANT_ROLES = [TENANT_ROLE.admin, TENANT_ROLE.editor, TENANT_ROLE.approver, TENANT_ROLE.analyst] as const;
const PUBLICATION_STATES = ["published", "failed", "indeterminate"] as const;
const INVITATION_STATES = ["pending", "accepted", "rejected", "canceled"] as const;
const COMPETITOR_STATES = ["paused", "archived"] as const;

function stableUuid(key: string) {
  const bytes = createHash("sha256").update(`30studio-local-sample:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function digest(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function offsetDate(days: number, hours = 10) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hours, 0, 0, 0);
  return date;
}

function indexLabel(index: number) {
  return String(index + 1).padStart(3, "0");
}

function createBrandKit(index: number): BrandKitContent {
  const colors = ["#183B56", "#2F6690", "#3A7D44", "#C26A2E", "#775DA6"];
  return {
    audience: `Sample audience ${index + 1}: people comparing practical options in this category.`,
    toneOfVoice: "Clear, useful, confident, and grounded in verifiable details.",
    colors: [colors[index % colors.length]!],
    fontFamilies: ["Inter", "Sora"],
    keyMessages: ["Useful information before promotion.", "Make the next step easy to understand."],
    products: [`Sample offer ${index + 1}`],
    verifiedFacts: [{ statement: "This is synthetic local preview data.", sourceUrl: "https://example.com/sample-data" }],
    restrictedClaims: ["Do not present sample metrics as real results."],
    callsToAction: ["Learn more", "See the details"],
  };
}

function assertLocalDemoEnvironment() {
  if (process.env.NODE_ENV !== LOCAL_DEVELOPMENT.runtimeEnvironment
    || process.env[LOCAL_DEVELOPMENT.enabledEnvironmentName] !== LOCAL_DEVELOPMENT.enabledEnvironmentValue) {
    throw new Error("Sample data can only be generated in the explicitly enabled local development environment.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const database = new URL(databaseUrl);
  if (!(LOCAL_DEVELOPMENT.allowedDatabaseHosts as readonly string[]).includes(database.hostname)
    || !(LOCAL_DEVELOPMENT.allowedDatabaseNames as readonly string[]).includes(database.pathname.slice(1))) {
    throw new Error("Sample data can only be generated in the local 30studio development database.");
  }

  if (process.env.STUDIO_ASSET_ENDPOINT !== LOCAL_DEVELOPMENT.objectStorageEndpoint
    || process.env.STUDIO_ASSET_BUCKET !== LOCAL_DEVELOPMENT.objectStorageBucket
    || process.env.STUDIO_ASSET_REGION !== LOCAL_DEVELOPMENT.region
    || process.env.AWS_ACCESS_KEY_ID !== "test"
    || process.env.AWS_SECRET_ACCESS_KEY !== "test") {
    throw new Error("Sample artwork requires the isolated LocalStack bucket from the Docker development stack.");
  }
}

async function seedLocalDemoData() {
  assertLocalDemoEnvironment();
  const database = getDatabase();
  const [demoOrganization] = await database.select({ id: organization.id }).from(organization)
    .where(eq(organization.slug, LOCAL_DEVELOPMENT.seedOrganizationSlug)).limit(1);
  const [demoOwner] = await database.select({ id: user.id }).from(user)
    .where(eq(user.email, LOCAL_DEVELOPMENT.seedUserEmail)).limit(1);
  if (!demoOrganization || !demoOwner) throw new Error("Run the local demo-user seed before generating sample records.");
  const organizationId = demoOrganization.id;
  const ownerId = demoOwner.id;
  const [existingSampleBrand] = await database.select({ id: brands.id }).from(brands).where(and(
    eq(brands.organizationId, organizationId), eq(brands.slug, `${SAMPLE_PREFIX}brand-001`),
  )).limit(1);
  if (existingSampleBrand) {
    console.info("The local sample dataset is already present; existing records were left unchanged.");
    return;
  }

  const now = new Date();
  const members = Array.from({ length: SAMPLE_MEMBER_COUNT }, (_, index) => ({
    id: `sample-member-${index + 1}`,
    name: `Sample team member ${index + 1}`,
    email: `sample-member-${index + 1}@example.test`,
    role: TENANT_ROLES[index % TENANT_ROLES.length]!,
  }));
  const approverIds = [ownerId, ...members.filter((_, index) => TENANT_ROLES[index % TENANT_ROLES.length] === TENANT_ROLE.approver).map(({ id }) => id)];

  const brandRows = Array.from({ length: SAMPLE_RECORDS }, (_, index) => ({
    id: stableUuid(`brand:${index}`), organizationId, slug: `sample-brand-${indexLabel(index)}`,
    name: `Sample Brand ${indexLabel(index)}`,
    description: "Synthetic brand record for local interface review.", industry: ["Technology", "Education", "Finance", "Wellness", "Retail"][index % 5]!,
    isActive: index % 10 !== 9, createdBy: ownerId, createdAt: offsetDate(-index), updatedAt: now,
  }));
  const profileRows = brandRows.flatMap((brand, index) => [0, 1].map((slot) => {
    const profileIndex = index * 2 + slot;
    return {
      id: stableUuid(`profile:${profileIndex}`), organizationId, brandId: brand.id,
      platform: SOCIAL_PLATFORMS[profileIndex % SOCIAL_PLATFORMS.length]!,
      displayName: `Sample channel ${indexLabel(profileIndex)}`,
      handle: `sample_channel_${indexLabel(profileIndex)}`,
      externalAccountId: `local-demo-account-${indexLabel(profileIndex)}`,
      connectedBy: ownerId,
      connectedAt: profileIndex % 4 === 0 ? offsetDate(-30 + profileIndex % 20) : null,
      status: profileIndex % 4 === 0 ? "reauth_required" as const : "not_connected" as const,
      createdAt: offsetDate(-profileIndex), updatedAt: now,
    };
  }));
  const kitRows = brandRows.flatMap((brand, index) => ([
    { id: stableUuid(`brand-kit:${index}:1`), organizationId, brandId: brand.id, version: 1, status: "superseded" as const, content: createBrandKit(index), createdBy: ownerId, createdAt: offsetDate(-60 - index) },
    { id: stableUuid(`brand-kit:${index}:2`), organizationId, brandId: brand.id, version: 2, status: "approved" as const, content: createBrandKit(index), createdBy: ownerId, createdAt: offsetDate(-30 - index), approvedBy: ownerId, approvedAt: offsetDate(-29 - index) },
    { id: stableUuid(`brand-kit:${index}:3`), organizationId, brandId: brand.id, version: 3, status: "draft" as const, content: createBrandKit(index), createdBy: ownerId, createdAt: offsetDate(-index) },
  ]));
  const campaignRows = brandRows.map((brand, index) => ({
    id: stableUuid(`campaign:${index}`), organizationId, brandId: brand.id,
    title: `Sample campaign ${indexLabel(index)}`,
    brief: `Synthetic campaign brief ${indexLabel(index)} for local review of planning, approval, and publication interfaces.`,
    createdBy: ownerId, createdAt: offsetDate(-30 + index % 30), updatedAt: now,
  }));
  const itemRows = brandRows.flatMap((brand, index) => {
    const createdAt = offsetDate(-25 + index % 20);
    const scheduledAt = offsetDate((index % 61) - 30);
    return [
      { id: stableUuid(`content:${index}:review`), organizationId, brandId: brand.id, campaignId: campaignRows[index]!.id, platform: profileRows[index * 2]!.platform, title: `Sample publication ${indexLabel(index)} · review`, status: CONTENT_STATUS.inReview, plannedAt: offsetDate(7 + index % 45), timeZone: "America/Sao_Paulo", createdBy: ownerId, createdAt, updatedAt: now },
      { id: stableUuid(`content:${index}:published`), organizationId, brandId: brand.id, campaignId: campaignRows[index]!.id, platform: profileRows[index * 2 + 1]!.platform, title: `Sample publication ${indexLabel(index)} · history`, status: [CONTENT_STATUS.published, CONTENT_STATUS.failed, CONTENT_STATUS.scheduled][index % 3]!, plannedAt: scheduledAt, timeZone: "America/Sao_Paulo", createdBy: ownerId, createdAt, updatedAt: now },
    ];
  });
  const versionRows = itemRows.map((item, index) => ({
    id: stableUuid(`content-version:${index}`), organizationId, contentItemId: item.id, brandId: item.brandId,
    versionNumber: 1, canonicalCopy: `Sample copy ${index + 1}: a concise, useful post created only for local interface review.`,
    brandKitVersionNumber: 2, createdBy: ownerId, createdAt: item.createdAt,
  }));
  const variantRows = itemRows.map((item, index) => ({
    id: stableUuid(`content-variant:${index}`), organizationId, contentVersionId: versionRows[index]!.id,
    platform: item.platform, copy: `Sample channel-specific copy ${index + 1} for ${item.platform}.`, createdAt: item.createdAt,
  }));
  const policyRows = [
    { id: stableUuid("approval-policy:organization"), organizationId, scopeKey: CONTENT_APPROVAL_POLICY.defaultScopeKey, brandId: null, requiredApprovals: 1, updatedBy: ownerId, updatedAt: now },
    ...brandRows.map((brand, index) => ({ id: stableUuid(`approval-policy:${index}`), organizationId, scopeKey: `${CONTENT_APPROVAL_POLICY.brandScopePrefix}${brand.id}`, brandId: brand.id, requiredApprovals: 1 + index % 3, updatedBy: ownerId, updatedAt: offsetDate(-index) })),
  ];
  const approvalRows = itemRows.map((item, index) => {
    const review = index % 2 === 0;
    const profile = profileRows[index]!;
    const fingerprint = digest(`${item.id}:${versionRows[index]!.id}:sample-content`);
    return {
      id: stableUuid(`approval:${index}`), organizationId, contentItemId: item.id, brandId: item.brandId,
      contentVersionId: versionRows[index]!.id, socialProfileId: profile.id, fingerprint,
      submittedBy: ownerId, requiredApprovals: 1, status: review ? "pending" as const : "approved" as const,
      createdAt: item.createdAt, resolvedAt: review ? null : offsetDate(-5 + index % 4),
    };
  });
  const decisionRows = itemRows.flatMap((_, index) => {
    if (index % 2 === 0) return [];
    const approvalIndex = index;
    return [{
      id: stableUuid(`approval-decision:${index}`), organizationId, approvalRequestId: approvalRows[approvalIndex]!.id,
      reviewerId: approverIds[Math.floor(index / 2) % approverIds.length]!, decision: "approved" as const,
      note: "Sample approval for local interface review.", fingerprint: approvalRows[approvalIndex]!.fingerprint,
      occurredAt: approvalRows[approvalIndex]!.resolvedAt!,
    }];
  });
  const jobRows = brandRows.map((brand, index) => {
    const itemIndex = index * 2 + 1;
    const jobStatus = PUBLICATION_STATES[index % PUBLICATION_STATES.length]!;
    const scheduledAt = itemRows[itemIndex]!.plannedAt;
    return {
      id: stableUuid(`publication-job:${index}`), organizationId, brandId: brand.id,
      contentItemId: itemRows[itemIndex]!.id, approvalRequestId: approvalRows[itemIndex]!.id,
      socialProfileId: profileRows[itemIndex]!.id, fingerprint: approvalRows[itemIndex]!.fingerprint,
      idempotencyKey: `sample-publication-${indexLabel(index)}`,
      status: jobStatus, attemptCount: 1, scheduledAt, nextAttemptAt: scheduledAt,
      externalPostId: jobStatus === "published" ? `local-demo-post-${indexLabel(index)}` : null,
      providerReferenceId: jobStatus === "indeterminate" ? `local-demo-reference-${indexLabel(index)}` : null,
      reconciliationAttemptCount: jobStatus === "indeterminate" ? 2 : 0,
      nextReconciliationAt: offsetDate(3_650),
      lastErrorCode: jobStatus === "failed" ? "SAMPLE_PROVIDER_FAILURE" : null,
      createdAt: scheduledAt, updatedAt: now,
    };
  });
  const attemptRows = jobRows.map((job, index) => ({
    id: stableUuid(`publication-attempt:${index}`), organizationId, jobId: job.id, attemptNumber: 1,
    outcome: job.status === "published" ? "sample_success" : job.status === "failed" ? "sample_failure" : "sample_unknown",
    errorCode: job.status === "failed" ? "SAMPLE_PROVIDER_FAILURE" : null,
    externalPostId: job.externalPostId, occurredAt: job.createdAt,
  }));
  const reconciliationRows = jobRows.flatMap((job, index) => {
    if (job.status !== "failed") return [];
    return Array.from({ length: 4 }, (_, attempt) => ({
      id: stableUuid(`publication-reconciliation:${index}:${attempt}`), organizationId, jobId: job.id,
      actorUserId: null, source: "automatic" as const, outcome: "not_published" as const,
      evidence: `Sample automatic check ${attempt + 1}: no matching publication was found in the local demo record.`,
      externalPostId: null, occurredAt: offsetDate(-3 + attempt, 11 + attempt),
    }));
  });
  const snapshotRows = jobRows.map((job, index) => ({
    id: stableUuid(`analytics-snapshot:${index}`), organizationId, brandId: job.brandId,
    socialProfileId: job.socialProfileId, publicationJobId: job.id,
    collectionStatus: job.status === "published" ? "success" as const : job.status === "failed" ? "unavailable" as const : "authentication_required" as const,
    likes: job.status === "published" ? 7 + index * 3 : null,
    comments: job.status === "published" ? index % 8 : null,
    shares: job.status === "published" ? index % 5 : null,
    source: "local-sample-dataset", definitionVersion: "sample-v1", coverage: "post_lifetime",
    collectedAt: offsetDate(-1 + index % 14),
  }));

  const sourceRows = brandRows.map((brand, index) => ({
    id: stableUuid(`competitor-source:${index}`), organizationId, brandId: brand.id,
    name: `Sample competitor source ${indexLabel(index)}`,
    feedUrl: `https://example.com/sample-feed/${indexLabel(index)}.xml`,
    retrievalMethod: "rss_atom" as const, status: COMPETITOR_STATES[index % COMPETITOR_STATES.length]!,
    nextFetchAt: offsetDate(3_650), lastFetchedAt: offsetDate(-1 - index % 20),
    failureCount: index % 6 === 0 ? 3 : 0, lastErrorCode: index % 6 === 0 ? "SAMPLE_FEED_FAILURE" : null,
    createdBy: ownerId, createdAt: offsetDate(-30 - index), updatedAt: now,
  }));
  const fetchRunRows = sourceRows.map((source, index) => ({
    id: stableUuid(`competitor-fetch-run:${index}`), organizationId, brandId: source.brandId, sourceId: source.id,
    status: index % 6 === 0 ? "failed" as const : "succeeded" as const,
    startedAt: offsetDate(-1 - index % 20, 9), completedAt: offsetDate(-1 - index % 20, 9 + (index % 2)),
    newItemCount: index % 6 === 0 ? 0 : 1, errorCode: index % 6 === 0 ? "SAMPLE_FEED_FAILURE" : null,
  }));
  const observationRows = sourceRows.map((source, index) => ({
    id: stableUuid(`competitor-observation:${index}`), organizationId, brandId: source.brandId, sourceId: source.id,
    externalId: `sample-observation-${indexLabel(index)}`,
    title: `Sample industry update ${indexLabel(index)}`,
    summary: "Synthetic example used to preview competitor monitoring and editorial research screens.",
    sourceUrl: `https://example.com/sample-article/${indexLabel(index)}`,
    contentPublishedAt: offsetDate(-2 - index % 80), capturedAt: offsetDate(-1 - index % 20),
    retrievalMethod: "rss_atom" as const, dataQuality: "metadata_only" as const,
    analysisStatus: "ready" as const, analysisNextAttemptAt: offsetDate(3_650),
    analysisAttemptCount: 1, analysisModel: "local-sample-fixture",
    topic: ["product_news", "education", "customer_story", "promotion", "event", "industry_news", "opinion", "other"][index % 8] as typeof competitorObservations.$inferInsert.topic,
    observedPatternEn: "Sample pattern: the source explains a practical product use case.",
    observedPatternPt: "Padrão de exemplo: a fonte explica um caso de uso prático.",
    editorialOpportunityEn: "Sample idea: create an original checklist for evaluating this topic.",
    editorialOpportunityPt: "Ideia de exemplo: criar uma lista original para avaliar este tema.",
  }));
  const connectionEventRows = profileRows.map((profile, index) => ({
    id: stableUuid(`social-connection-event:${index}`), organizationId, brandId: profile.brandId,
    socialProfileId: profile.id, actorUserId: ownerId, platform: profile.platform,
    eventType: profile.status === "reauth_required" ? "reauth_required" as const : "disconnected" as const,
    occurredAt: offsetDate(-1 - index % 25),
  }));
  const teamAuditRows = Array.from({ length: SAMPLE_RECORDS }, (_, index) => ({
    id: stableUuid(`team-audit:${index}`), organizationId, actorUserId: ownerId,
    targetUserId: members[index % members.length]!.id,
    targetEmail: index % 4 === 0 ? `sample-invite-${indexLabel(index)}@example.test` : null,
    invitationId: `sample-invitation-${indexLabel(index)}`,
    action: [TEAM_AUDIT_ACTIONS.memberRoleChanged, TEAM_AUDIT_ACTIONS.invitationCreated, TEAM_AUDIT_ACTIONS.invitationAccepted, TEAM_AUDIT_ACTIONS.invitationCancelled][index % 4]!,
    previousRole: index % 4 === 0 ? TENANT_ROLE.editor : null,
    newRole: members[index % members.length]!.role,
    occurredAt: offsetDate(-1 - index % 90),
  }));
  const invitationRows = Array.from({ length: SAMPLE_RECORDS }, (_, index) => ({
    id: `sample-invitation-${indexLabel(index)}`, organizationId,
    email: `sample-invite-${indexLabel(index)}@example.test`, role: TENANT_ROLES[index % TENANT_ROLES.length]!,
    status: INVITATION_STATES[index % INVITATION_STATES.length]!,
    expiresAt: index % 4 === 0 ? offsetDate(7) : offsetDate(-7),
    createdAt: offsetDate(-30 + index % 29), inviterId: ownerId,
  }));
  const alertRows = brandRows.map((brand, index) => ({
    organizationId, brandId: brand.id, enabled: true, failureThreshold: 2 + index % 4,
    staleAfterHours: 24 + (index % 4) * 12, updatedBy: ownerId, updatedAt: now,
  }));
  const goalRows = brandRows.map((brand, index) => ({
    organizationId, brandId: brand.id, platform: profileRows[index * 2]!.platform,
    monthlyTarget: 4 + index % 27, updatedBy: ownerId, updatedAt: offsetDate(-index),
  }));

  const mediaRows = itemRows.map((item, index) => {
    const brandIndex = Math.floor(index / 2);
    const kit = createBrandKit(brandIndex);
    const copy = `Synthetic visual for sample publication ${indexLabel(brandIndex)}. Use this artwork only to preview the local interface.`;
    const payload = JSON.stringify({ title: item.title, copy, brandKit: kit });
    const id = stableUuid(`content-media:${index}`);
    const fileName = `${id}.webp`;
    const objectKey = `tenants/${encodeURIComponent(organizationId)}/brands/${item.brandId}/content/${item.id}/${versionRows[index]!.id}/${fileName}`;
    return {
      row: {
        id, organizationId, brandId: item.brandId, contentItemId: item.id, contentVersionId: versionRows[index]!.id,
        idempotencyKey: stableUuid(`content-media-idempotency:${index}`), objectKey, fileName,
        contentType: "image/webp", prompt: payload, modelId: DEMO_MEDIA_MODEL,
        status: index % 2 === 0 ? "rejected" as const : "approved" as const,
        attempts: 1, availableAt: item.createdAt, createdBy: ownerId, createdAt: item.createdAt,
        sizeBytes: 0, width: 1_080, height: 1_080, sha256: "", reviewedBy: ownerId, reviewedAt: offsetDate(-1),
      },
      review: {
        id: stableUuid(`content-media-review:${index}`), organizationId, brandId: item.brandId,
        mediaAssetId: id, reviewerId: ownerId, decision: index % 2 === 0 ? "rejected" as const : "approved" as const,
        note: "Synthetic review record for local interface preview.", occurredAt: offsetDate(-1),
      },
      title: item.title,
      copy,
      kit,
    };
  });
  const brandAssetRows = brandRows.map((brand, index) => {
    const id = stableUuid(`brand-asset:${index}`);
    const objectKey = `tenants/${encodeURIComponent(organizationId)}/brands/${brand.id}/sample-assets/${id}.png`;
    const uploadKey = `tenants/${encodeURIComponent(organizationId)}/brands/${brand.id}/sample-uploads/${id}.png`;
    return {
      row: {
        id, organizationId, brandId: brand.id,
        status: index % 5 === 0 ? "rejected" as const : "approved" as const,
        kind: index % 2 === 0 ? "template_reference" as const : "other" as const,
        fileName: `sample-artwork-${indexLabel(index)}.png`, contentType: "image/png",
        sizeBytes: 0, width: 1_080, height: 1_080, sha256: "", objectKey, uploadKey,
        license: "Synthetic local preview artwork", altText: `Sample artwork for ${brand.name}.`,
        createdBy: ownerId, createdAt: offsetDate(-index), reviewedBy: ownerId, reviewedAt: offsetDate(-1),
      },
      review: {
        id: stableUuid(`brand-asset-review:${index}`), organizationId, brandId: brand.id,
        assetId: id, reviewerId: ownerId,
        decision: index % 5 === 0 ? "rejected" as const : "approved" as const,
        note: "Synthetic review record for local interface preview.", occurredAt: offsetDate(-1),
      },
      brandName: brand.name,
      kit: createBrandKit(index),
    };
  });

  const uploadedObjects: string[] = [];
  try {
    for (const media of mediaRows) {
      const png = await renderTextCard({ title: media.title, copy: media.copy, brandKit: media.kit });
      const webp = await sharp(png).webp({ quality: 82 }).toBuffer();
      const sha256 = digest(webp);
      media.row.sizeBytes = webp.byteLength;
      media.row.sha256 = sha256;
      await storeVerifiedBrandAsset({ contentType: "image/webp", sha256 }, media.row.objectKey, webp);
      uploadedObjects.push(media.row.objectKey);
    }
    for (const asset of brandAssetRows) {
      const png = await renderTextCard({ title: asset.brandName, copy: "Synthetic artwork for local interface review.", brandKit: asset.kit });
      const sha256 = digest(png);
      asset.row.sizeBytes = png.byteLength;
      asset.row.sha256 = sha256;
      await storeVerifiedBrandAsset({ contentType: "image/png", sha256 }, asset.row.objectKey, png);
      uploadedObjects.push(asset.row.objectKey);
    }

    await database.transaction(async (transaction) => {
      await transaction.insert(user).values(members.map((entry, index) => ({
        id: entry.id, name: entry.name, email: entry.email, emailVerified: true,
        createdAt: offsetDate(-index), updatedAt: now,
      }))).onConflictDoNothing();
      await transaction.insert(member).values(members.map((entry, index) => ({
        id: `sample-membership-${indexLabel(index)}`, organizationId, userId: entry.id, role: entry.role, createdAt: offsetDate(-index),
      }))).onConflictDoNothing();
      await transaction.insert(invitation).values(invitationRows).onConflictDoNothing();
      await transaction.insert(brands).values(brandRows).onConflictDoNothing();
      await transaction.insert(socialProfiles).values(profileRows).onConflictDoNothing();
      await transaction.insert(socialConnectionEvents).values(connectionEventRows).onConflictDoNothing();
      await transaction.insert(teamAuditEvents).values(teamAuditRows).onConflictDoNothing();
      await transaction.insert(brandKitVersions).values(kitRows).onConflictDoNothing();
      await transaction.insert(campaigns).values(campaignRows).onConflictDoNothing();
      await transaction.insert(contentItems).values(itemRows).onConflictDoNothing();
      await transaction.insert(contentVersions).values(versionRows).onConflictDoNothing();
      await transaction.insert(contentVariants).values(variantRows).onConflictDoNothing();
      await transaction.insert(contentApprovalPolicies).values(policyRows).onConflictDoNothing();
      await transaction.insert(contentApprovalRequests).values(approvalRows).onConflictDoNothing();
      await transaction.insert(contentApprovalDecisions).values(decisionRows).onConflictDoNothing();
      await transaction.insert(socialPublicationJobs).values(jobRows).onConflictDoNothing();
      await transaction.insert(socialPublicationAttempts).values(attemptRows).onConflictDoNothing();
      if (reconciliationRows.length) await transaction.insert(socialPublicationReconciliations).values(reconciliationRows).onConflictDoNothing();
      await transaction.insert(socialAnalyticsSnapshots).values(snapshotRows).onConflictDoNothing();
      await transaction.insert(competitorSources).values(sourceRows).onConflictDoNothing();
      await transaction.insert(competitorFetchRuns).values(fetchRunRows).onConflictDoNothing();
      await transaction.insert(competitorObservations).values(observationRows).onConflictDoNothing();
      await transaction.insert(competitorAlertSettings).values(alertRows).onConflictDoNothing();
      await transaction.insert(dashboardPublicationGoals).values(goalRows).onConflictDoNothing();
      await transaction.insert(contentMediaAssets).values(mediaRows.map(({ row }) => row)).onConflictDoNothing();
      await transaction.insert(contentMediaReviews).values(mediaRows.map(({ review }) => review)).onConflictDoNothing();
      await transaction.insert(brandAssets).values(brandAssetRows.map(({ row }) => row)).onConflictDoNothing();
      await transaction.insert(brandAssetReviews).values(brandAssetRows.map(({ review }) => review)).onConflictDoNothing();
    });
  } catch (error) {
    console.error(`Local demo dataset setup stopped after ${uploadedObjects.length} isolated LocalStack artwork uploads.`);
    throw error;
  }

  console.info(JSON.stringify({
    organization: LOCAL_DEVELOPMENT.seedOrganizationSlug,
    members: SAMPLE_MEMBER_COUNT + 1,
    invitations: SAMPLE_RECORDS,
    brands: brandRows.length,
    socialProfiles: profileRows.length,
    campaigns: campaignRows.length,
    contentItems: itemRows.length,
    contentVersions: versionRows.length,
    contentVariants: variantRows.length,
    brandKitVersions: kitRows.length,
    approvalRequests: approvalRows.length,
    approvalDecisions: decisionRows.length,
    publicationJobs: jobRows.length,
    publicationAttempts: attemptRows.length,
    publicationReconciliations: reconciliationRows.length,
    analyticsSnapshots: snapshotRows.length,
    competitorSources: sourceRows.length,
    competitorFetchRuns: fetchRunRows.length,
    competitorObservations: observationRows.length,
    competitorAlertSettings: alertRows.length,
    publicationGoals: goalRows.length,
    socialConnectionEvents: connectionEventRows.length,
    teamAuditEvents: teamAuditRows.length,
    contentMediaAssets: mediaRows.length,
    contentMediaReviews: mediaRows.length,
    brandAssets: brandAssetRows.length,
    brandAssetReviews: brandAssetRows.length,
    approvalPolicies: policyRows.length,
    localArtworkObjects: uploadedObjects.length,
    excluded: ["sessions", "credential accounts", "OAuth states", "social credentials", "verification tokens", "live worker heartbeats"],
  }, null, 2));
}

void seedLocalDemoData()
  .catch((error: unknown) => {
    console.error("Could not create local sample data.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
