import "server-only";
import { SOCIAL_CONNECTION } from "@/lib/constants";
import { readBoundedSocialProviderResponse } from "@/lib/server/social-provider-response";
import type { SocialPublisherAdapter } from "@/lib/server/social-publisher/types";

function assertFacebookConfigured() {
  if (!process.env.META_CLIENT_ID || !process.env.META_CLIENT_SECRET) throw new Error("Meta app credentials are not configured.");
  const version = process.env.META_GRAPH_API_VERSION;
  if (!version || !/^v\d+\.\d+$/u.test(version)) throw new Error("Meta Graph API version is not configured.");
  return version;
}

async function publishFacebookPagePost(accessToken: string, pageId: string, copy: string) {
  const version = assertFacebookConfigured();
  const endpoint = new URL(`/${version}/${encodeURIComponent(pageId)}/feed`, "https://graph.facebook.com");
  const body = new URLSearchParams({ message: copy });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds);
  try {
    const response = await fetch(endpoint, {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status >= 500) return { kind: "indeterminate" as const };
      return { kind: "rejected" as const, status: response.status };
    }
    const responseText = await readBoundedSocialProviderResponse(response);
    let payload: unknown;
    try { payload = JSON.parse(responseText); } catch { return { kind: "indeterminate" as const }; }
    if (!payload || typeof payload !== "object" || !("id" in payload) || typeof payload.id !== "string" || payload.id.length === 0 || payload.id.length > 256) {
      return { kind: "indeterminate" as const };
    }
    return { kind: "published" as const, externalPostId: payload.id };
  } catch {
    return { kind: "indeterminate" as const };
  } finally {
    clearTimeout(timeout);
  }
}

export const facebookPublisher: SocialPublisherAdapter = {
  platform: "facebook",
  requiredScopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  mediaSupport: "none",
  assertConfigured: () => { assertFacebookConfigured(); },
  publishText: (accessToken, input) => publishFacebookPagePost(accessToken, input.externalAccountId, input.copy),
};
