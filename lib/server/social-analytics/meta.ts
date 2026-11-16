import "server-only";
import { SOCIAL_CONNECTION } from "@/lib/constants";
import { readBoundedSocialProviderResponse } from "@/lib/server/social-provider-response";
import type { SocialPlatform } from "@/lib/constants";

export type MetaPostMetrics = { status: "success" | "permission_denied" | "authentication_required" | "unavailable"; likes: number | null; comments: number | null; shares: number | null };

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function metricCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

async function readMetaJson(url: URL, accessToken: string): Promise<{ payload: Record<string, unknown> | null; status: MetaPostMetrics["status"] | null }> {
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds), cache: "no-store" });
    let payload: Record<string, unknown> | null = null;
    if (response.ok) {
      const raw = await readBoundedSocialProviderResponse(response);
      try { payload = object(JSON.parse(raw)); } catch { return { payload: null, status: "unavailable" }; }
      return { payload, status: null };
    }
    const statusCode = response.status;
    const raw = await readBoundedSocialProviderResponse(response).catch(() => "");
    const providerError = object(object(JSON.parse(raw || "null"))?.error);
    const code = providerError?.code;
    if (statusCode === 401 || code === 190) return { payload: null, status: "authentication_required" };
    if (statusCode === 403 || code === 200) return { payload: null, status: "permission_denied" };
    return { payload: null, status: "unavailable" };
  } catch {
    return { payload: null, status: "unavailable" };
  }
}

export async function collectMetaPostMetrics(platform: Extract<SocialPlatform, "facebook" | "instagram">, externalPostId: string, accessToken: string): Promise<MetaPostMetrics> {
  const version = process.env.META_GRAPH_API_VERSION;
  if (!version || !/^v\d+\.\d+$/u.test(version) || externalPostId.length > 256) {
    return { status: "unavailable", likes: null, comments: null, shares: null };
  }
  const path = encodeURIComponent(externalPostId);
  const base = platform === "instagram" ? "https://graph.instagram.com" : "https://graph.facebook.com";
  const url = new URL(`/${version}/${path}`, base);
  if (platform === "instagram") {
    url.searchParams.set("fields", "id,like_count,comments_count");
  } else {
    url.searchParams.set("fields", "id,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares");
  }
  const result = await readMetaJson(url, accessToken);
  if (result.status || !result.payload) return { status: result.status ?? "unavailable", likes: null, comments: null, shares: null };
  const likes = platform === "instagram"
    ? metricCount(result.payload.like_count)
    : metricCount(object(object(result.payload.reactions)?.summary)?.total_count);
  const comments = platform === "instagram"
    ? metricCount(result.payload.comments_count)
    : metricCount(object(object(result.payload.comments)?.summary)?.total_count);
  const shares = platform === "facebook" ? metricCount(object(result.payload.shares)?.count) : null;
  if (likes === null && comments === null && shares === null) return { status: "unavailable", likes: null, comments: null, shares: null };
  return { status: "success", likes, comments, shares };
}
