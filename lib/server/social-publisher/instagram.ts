import "server-only";
import { SOCIAL_CONNECTION, SOCIAL_PUBLICATION_LIMITS } from "@/lib/constants";
import { readBoundedSocialProviderResponse } from "@/lib/server/social-provider-response";
import type { SocialPublisherAdapter, SocialPublishResult } from "@/lib/server/social-publisher/types";

const instagramLimits = SOCIAL_PUBLICATION_LIMITS.instagram;

function assertInstagramConfigured() {
  if (!process.env.META_CLIENT_ID || !process.env.META_CLIENT_SECRET) throw new Error("Meta app credentials are not configured.");
  const version = process.env.META_GRAPH_API_VERSION;
  if (!version || !/^v\d+\.\d+$/u.test(version)) throw new Error("Meta Graph API version is not configured.");
  return version;
}

async function requestJson(url: URL, accessToken: string, body?: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds);
  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET", redirect: "error", signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { result: response.status >= 500 ? { kind: "indeterminate" as const } : { kind: "rejected" as const, status: response.status } };
    }
    const raw = await readBoundedSocialProviderResponse(response);
    try {
      const value: unknown = JSON.parse(raw);
      return { value: value && typeof value === "object" ? value as Record<string, unknown> : null };
    } catch { return { result: { kind: "indeterminate" as const } }; }
  } catch { return { result: { kind: "indeterminate" as const } }; }
  finally { clearTimeout(timeout); }
}

function graphUrl(version: string, path: string) {
  return new URL(`/${version}/${path}`, "https://graph.instagram.com");
}

function failBeforePublication(result: SocialPublishResult): SocialPublishResult {
  return result.kind === "indeterminate" ? { kind: "rejected", status: 503 } : result;
}

async function publishInstagramImage(accessToken: string, accountId: string, caption: string, imageUrl: string, beforeFinalPublish?: (providerReferenceId: string) => Promise<void>): Promise<SocialPublishResult> {
  const version = assertInstagramConfigured();
  if ([...caption].length > instagramLimits.captionCharacters) return { kind: "rejected", status: 422 };
  let publicImageUrl: URL;
  try { publicImageUrl = new URL(imageUrl); } catch { return { kind: "rejected", status: 422 }; }
  if (publicImageUrl.protocol !== "https:") return { kind: "rejected", status: 422 };

  const quotaUrl = graphUrl(version, `${encodeURIComponent(accountId)}/content_publishing_limit`);
  quotaUrl.searchParams.set("fields", "quota_usage,config");
  const quota = await requestJson(quotaUrl, accessToken);
  if (quota.result) return quota.result.kind === "indeterminate" ? { kind: "rejected", status: 503 } : quota.result;
  const quotaRows = quota.value?.data;
  const quotaRow = Array.isArray(quotaRows) && quotaRows.length === 1 && quotaRows[0] && typeof quotaRows[0] === "object" ? quotaRows[0] as Record<string, unknown> : null;
  const quotaUsage = quotaRow?.quota_usage;
  const quotaConfig = quotaRow?.config && typeof quotaRow.config === "object" ? quotaRow.config as Record<string, unknown> : null;
  const quotaTotal = quotaConfig?.quota_total;
  if (typeof quotaUsage !== "number" || !Number.isInteger(quotaUsage) || typeof quotaTotal !== "number" || !Number.isInteger(quotaTotal) || quotaTotal < 1) return { kind: "rejected", status: 503 };
  if (quotaUsage >= quotaTotal) return { kind: "rejected", status: 429 };

  const create = await requestJson(graphUrl(version, `${encodeURIComponent(accountId)}/media`), accessToken,
    { image_url: publicImageUrl.toString(), caption });
  if (create.result) return failBeforePublication(create.result);
  const containerId = create.value?.id;
  if (typeof containerId !== "string" || !containerId || containerId.length > 256) return { kind: "rejected", status: 503 };

  let ready = false;
  for (let attempt = 0; attempt < instagramLimits.containerReadinessChecks; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, instagramLimits.containerReadinessIntervalMilliseconds));
    const statusUrl = graphUrl(version, `${encodeURIComponent(containerId)}?fields=status_code`);
    const status = await requestJson(statusUrl, accessToken);
    if (status.result) return failBeforePublication(status.result);
    if (status.value?.status_code === "FINISHED") { ready = true; break; }
    if (status.value?.status_code === "ERROR" || status.value?.status_code === "EXPIRED") return { kind: "rejected", status: 422 };
  }
  if (!ready) return { kind: "rejected", status: 503 };
  if (beforeFinalPublish) {
    try { await beforeFinalPublish(containerId); }
    catch { return { kind: "rejected", status: 503 }; }
  }

  const publish = await requestJson(graphUrl(version, `${encodeURIComponent(accountId)}/media_publish`), accessToken,
    { creation_id: containerId });
  if (publish.result) return publish.result;
  const postId = publish.value?.id;
  return typeof postId === "string" && postId.length > 0 && postId.length <= 256
    ? { kind: "published", externalPostId: postId }
    : { kind: "indeterminate" };
}

export const instagramPublisher: SocialPublisherAdapter = {
  platform: "instagram",
  requiredScopes: ["instagram_business_basic", "instagram_business_content_publishing"],
  mediaSupport: "single_image",
  maximumTextCharacters: instagramLimits.captionCharacters,
  assertConfigured: () => { assertInstagramConfigured(); },
  publishText: (accessToken, input) => input.imageUrl
    ? publishInstagramImage(accessToken, input.externalAccountId, input.copy, input.imageUrl, input.beforeFinalPublish)
    : Promise.resolve({ kind: "rejected", status: 422 }),
  reconcilePublished: async (accessToken, input) => {
    const version = assertInstagramConfigured();
    const statusUrl = graphUrl(version, `${encodeURIComponent(input.providerReferenceId)}?fields=status_code`);
    const status = await requestJson(statusUrl, accessToken);
    if (status.result || status.value?.status_code !== "PUBLISHED") return { kind: "unknown" };
    return { kind: "published" };
  },
};
