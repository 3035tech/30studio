import "server-only";
import { and, count, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { CONTENT_APPROVAL_STATUS, SOCIAL_PLATFORMS, SOCIAL_PUBLICATION_JOB_STATUS, SOCIAL_PUBLICATION_JOB_STATUSES, type SocialPlatform } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brands, contentApprovalRequests, contentItems, socialProfiles, socialPublicationJobs } from "@/lib/db/schema";

export async function getPublicationAnalytics(organizationId: string, input: { start: Date; end: Date; brandId?: string; platform?: SocialPlatform }) {
  const database = getDatabase();
  const conditions = [
    eq(socialPublicationJobs.organizationId, organizationId),
    gte(socialPublicationJobs.scheduledAt, input.start),
    lte(socialPublicationJobs.scheduledAt, input.end),
  ];
  if (input.brandId) conditions.push(eq(socialPublicationJobs.brandId, input.brandId));
  if (input.platform) conditions.push(eq(socialProfiles.platform, input.platform));

  const attentionConditions = [
    eq(socialPublicationJobs.organizationId, organizationId),
    inArray(socialPublicationJobs.status, [SOCIAL_PUBLICATION_JOB_STATUS.failed, SOCIAL_PUBLICATION_JOB_STATUS.indeterminate]),
  ];
  const periodDuration = input.end.getTime() - input.start.getTime();
  const previousStart = new Date(input.start.getTime() - periodDuration);
  const comparisonConditions = [
    eq(socialPublicationJobs.organizationId, organizationId),
    gte(socialPublicationJobs.scheduledAt, previousStart),
    lt(socialPublicationJobs.scheduledAt, input.start),
  ];
  const approvalConditions = [
    eq(contentApprovalRequests.organizationId, organizationId),
    eq(contentApprovalRequests.status, CONTENT_APPROVAL_STATUS.pending),
  ];
  const connectionConditions = [eq(socialProfiles.organizationId, organizationId), eq(socialProfiles.status, "reauth_required")];
  if (input.brandId) {
    attentionConditions.push(eq(socialPublicationJobs.brandId, input.brandId));
    comparisonConditions.push(eq(socialPublicationJobs.brandId, input.brandId));
    approvalConditions.push(eq(contentApprovalRequests.brandId, input.brandId));
    connectionConditions.push(eq(socialProfiles.brandId, input.brandId));
  }
  if (input.platform) {
    attentionConditions.push(eq(socialProfiles.platform, input.platform));
    comparisonConditions.push(eq(socialProfiles.platform, input.platform));
    approvalConditions.push(eq(socialProfiles.platform, input.platform));
    connectionConditions.push(eq(socialProfiles.platform, input.platform));
  }

  const rowsQuery = database.select({
    platform: socialProfiles.platform,
    status: socialPublicationJobs.status,
    total: count(),
  }).from(socialPublicationJobs)
    .innerJoin(socialProfiles, and(
      eq(socialProfiles.organizationId, socialPublicationJobs.organizationId),
      eq(socialProfiles.id, socialPublicationJobs.socialProfileId),
      eq(socialProfiles.brandId, socialPublicationJobs.brandId),
    ))
    .where(and(...conditions))
    .groupBy(socialProfiles.platform, socialPublicationJobs.status);
  const attentionJobsQuery = database.select({ status: socialPublicationJobs.status, total: count() }).from(socialPublicationJobs)
    .innerJoin(socialProfiles, and(
      eq(socialProfiles.organizationId, socialPublicationJobs.organizationId), eq(socialProfiles.id, socialPublicationJobs.socialProfileId),
      eq(socialProfiles.brandId, socialPublicationJobs.brandId),
    ))
    .where(and(...attentionConditions)).groupBy(socialPublicationJobs.status);
  const previousPeriodQuery = database.select({ status: socialPublicationJobs.status, total: count() }).from(socialPublicationJobs)
    .innerJoin(socialProfiles, and(
      eq(socialProfiles.organizationId, socialPublicationJobs.organizationId), eq(socialProfiles.id, socialPublicationJobs.socialProfileId),
      eq(socialProfiles.brandId, socialPublicationJobs.brandId),
    ))
    .where(and(...comparisonConditions)).groupBy(socialPublicationJobs.status);
  const pendingApprovalsQuery = database.select({ total: count() }).from(contentApprovalRequests).innerJoin(socialProfiles, and(
    eq(socialProfiles.organizationId, contentApprovalRequests.organizationId), eq(socialProfiles.brandId, contentApprovalRequests.brandId),
    eq(socialProfiles.id, contentApprovalRequests.socialProfileId),
  )).where(and(...approvalConditions));
  const connectionsNeedReauthQuery = database.select({ total: count() }).from(socialProfiles).where(and(...connectionConditions));
  const [rows, attentionJobs, previousPeriodRows, [pendingApprovals], [connectionsNeedReauth]] = await Promise.all([
    rowsQuery, attentionJobsQuery, previousPeriodQuery, pendingApprovalsQuery, connectionsNeedReauthQuery,
  ]);
  const [publicationIssues, approvalIssues, connectionIssues] = await Promise.all([
    database.select({ id: socialPublicationJobs.id, itemId: socialPublicationJobs.contentItemId, title: contentItems.title, brandId: socialPublicationJobs.brandId, brandName: brands.name, platform: socialProfiles.platform, plannedAt: socialPublicationJobs.scheduledAt, status: socialPublicationJobs.status })
      .from(socialPublicationJobs).innerJoin(socialProfiles, and(
        eq(socialProfiles.organizationId, socialPublicationJobs.organizationId), eq(socialProfiles.id, socialPublicationJobs.socialProfileId), eq(socialProfiles.brandId, socialPublicationJobs.brandId),
      )).innerJoin(contentItems, and(
        eq(contentItems.organizationId, socialPublicationJobs.organizationId), eq(contentItems.id, socialPublicationJobs.contentItemId), eq(contentItems.brandId, socialPublicationJobs.brandId),
      )).innerJoin(brands, and(eq(brands.organizationId, socialPublicationJobs.organizationId), eq(brands.id, socialPublicationJobs.brandId)))
      .where(and(...attentionConditions)).orderBy(desc(socialPublicationJobs.updatedAt)).limit(10),
    database.select({ id: contentApprovalRequests.id, itemId: contentApprovalRequests.contentItemId, title: contentItems.title, brandId: contentApprovalRequests.brandId, brandName: brands.name, platform: socialProfiles.platform, plannedAt: contentItems.plannedAt })
      .from(contentApprovalRequests).innerJoin(contentItems, and(
        eq(contentItems.organizationId, contentApprovalRequests.organizationId), eq(contentItems.id, contentApprovalRequests.contentItemId), eq(contentItems.brandId, contentApprovalRequests.brandId),
      )).innerJoin(socialProfiles, and(
        eq(socialProfiles.organizationId, contentApprovalRequests.organizationId), eq(socialProfiles.brandId, contentApprovalRequests.brandId), eq(socialProfiles.id, contentApprovalRequests.socialProfileId),
      )).innerJoin(brands, and(eq(brands.organizationId, contentApprovalRequests.organizationId), eq(brands.id, contentApprovalRequests.brandId)))
      .where(and(...approvalConditions)).orderBy(desc(contentApprovalRequests.createdAt)).limit(10),
    database.select({ id: socialProfiles.id, brandId: socialProfiles.brandId, brandName: brands.name, platform: socialProfiles.platform, displayName: socialProfiles.displayName })
      .from(socialProfiles).innerJoin(brands, and(eq(brands.organizationId, socialProfiles.organizationId), eq(brands.id, socialProfiles.brandId)))
      .where(and(...connectionConditions)).orderBy(socialProfiles.displayName).limit(10),
  ]);

  const totals = Object.fromEntries(SOCIAL_PUBLICATION_JOB_STATUSES.map((status) => [status, 0])) as Record<typeof SOCIAL_PUBLICATION_JOB_STATUSES[number], number>;
  const grouped = new Map(SOCIAL_PLATFORMS.map((platform) => [platform, { ...totals }]));
  for (const row of rows) {
    const value = Number(row.total);
    totals[row.status] += value;
    const platformTotals = grouped.get(row.platform);
    if (platformTotals) platformTotals[row.status] += value;
  }
  const attention = {
    failedPublications: 0,
    indeterminatePublications: 0,
    pendingApprovals: Number(pendingApprovals?.total ?? 0),
    connectionsNeedReauth: Number(connectionsNeedReauth?.total ?? 0),
  };
  for (const row of attentionJobs) {
    if (row.status === SOCIAL_PUBLICATION_JOB_STATUS.failed) attention.failedPublications = Number(row.total);
    if (row.status === SOCIAL_PUBLICATION_JOB_STATUS.indeterminate) attention.indeterminatePublications = Number(row.total);
  }
  const previousPublished = Number(previousPeriodRows.find((row) => row.status === SOCIAL_PUBLICATION_JOB_STATUS.published)?.total ?? 0);
  return {
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    totals,
    comparison: { previousPublished, publishedChange: totals.published - previousPublished },
    attention,
    issues: {
      publications: publicationIssues.map((issue) => ({ ...issue, plannedAt: issue.plannedAt.toISOString() })),
      approvals: approvalIssues.map((issue) => ({ ...issue, plannedAt: issue.plannedAt.toISOString() })),
      connections: connectionIssues,
    },
    platforms: [...grouped].map(([platform, platformTotals]) => ({ platform, totals: platformTotals })),
  };
}
