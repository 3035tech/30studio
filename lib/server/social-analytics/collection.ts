import "server-only";
import { SOCIAL_ANALYTICS_LIMITS } from "@/lib/constants";
import { listMetaAnalyticsCandidates, markSocialAnalyticsReauthenticationRequired, saveMetaAnalyticsSnapshot } from "@/lib/db/repositories/social-analytics";
import { getValidSocialAccessToken } from "@/lib/server/social-access-token";
import { collectMetaPostMetrics } from "@/lib/server/social-analytics/meta";
import type { analyticsRefreshRequestSchema } from "@/lib/validation/analytics";
import type { z } from "zod";

type Input = z.infer<typeof analyticsRefreshRequestSchema>;

export async function refreshMetaEngagement(organizationId: string, input: Input) {
  const candidates = await listMetaAnalyticsCandidates(organizationId, {
    start: new Date(input.start), end: new Date(input.end), brandId: input.brandId, platform: input.platform,
    maximum: SOCIAL_ANALYTICS_LIMITS.refreshCandidateCount,
    cooldownSince: new Date(Date.now() - SOCIAL_ANALYTICS_LIMITS.refreshCooldownMilliseconds),
  });
  const counts = { attempted: candidates.length, success: 0, permissionDenied: 0, authenticationRequired: 0, unavailable: 0 };
  const tokenPromises = new Map<string, Promise<{ token: string | null; failed: boolean }>>();
  let nextIndex = 0;

  async function collectNext() {
    while (nextIndex < candidates.length) {
      const candidate = candidates[nextIndex++];
      if (!candidate.externalPostId || (candidate.platform !== "facebook" && candidate.platform !== "instagram")) continue;
      const requiredScope = candidate.platform === "facebook" ? "pages_read_engagement" : "instagram_business_basic";
      let result;
      if (!candidate.scopes.includes(requiredScope)) {
        result = { status: "permission_denied" as const, likes: null, comments: null, shares: null };
      } else {
        let tokenPromise = tokenPromises.get(candidate.socialProfileId);
        if (!tokenPromise) {
          tokenPromise = getValidSocialAccessToken(organizationId, candidate.socialProfileId)
            .then((token) => ({ token, failed: false }))
            .catch(() => ({ token: null, failed: true }));
          tokenPromises.set(candidate.socialProfileId, tokenPromise);
        }
        const tokenResult = await tokenPromise;
        result = tokenResult.failed
          ? { status: "unavailable" as const, likes: null, comments: null, shares: null }
          : tokenResult.token
            ? await collectMetaPostMetrics(candidate.platform, candidate.externalPostId, tokenResult.token)
            : { status: "authentication_required" as const, likes: null, comments: null, shares: null };
      }
      await saveMetaAnalyticsSnapshot({
        organizationId, brandId: candidate.brandId, socialProfileId: candidate.socialProfileId,
        jobId: candidate.jobId, platform: candidate.platform, metrics: result, collectedAt: new Date(),
      });
      if (result.status === "authentication_required") {
        await markSocialAnalyticsReauthenticationRequired(organizationId, candidate.brandId, candidate.socialProfileId);
      }
      if (result.status === "success") counts.success += 1;
      else if (result.status === "permission_denied") counts.permissionDenied += 1;
      else if (result.status === "authentication_required") counts.authenticationRequired += 1;
      else counts.unavailable += 1;
    }
  }

  await Promise.all(Array.from({ length: Math.min(SOCIAL_ANALYTICS_LIMITS.refreshConcurrency, candidates.length) }, () => collectNext()));
  return counts;
}
