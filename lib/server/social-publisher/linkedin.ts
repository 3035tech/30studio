import "server-only";
import { SOCIAL_CONNECTION } from "@/lib/constants";
import type { SocialPublisherAdapter } from "@/lib/server/social-publisher/types";

function assertLinkedInConfigured() {
  const apiVersion = process.env.LINKEDIN_API_VERSION;
  if (!apiVersion || !/^\d{6}$/.test(apiVersion)) throw new Error("LinkedIn API version is not configured.");
  return apiVersion;
}

async function publishLinkedInTextPost(accessToken: string, externalAccountId: string, copy: string) {
  const apiVersion = assertLinkedInConfigured();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds);
  try {
    const response = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Linkedin-Version": apiVersion,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: `urn:li:person:${externalAccountId}`,
        commentary: copy,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status >= 500) return { kind: "indeterminate" as const };
      return { kind: "rejected" as const, status: response.status };
    }
    const externalPostId = response.headers.get("x-restli-id");
    await response.body?.cancel();
    return externalPostId ? { kind: "published" as const, externalPostId } : { kind: "indeterminate" as const };
  } catch {
    return { kind: "indeterminate" as const };
  } finally {
    clearTimeout(timeout);
  }
}

export const linkedinPublisher: SocialPublisherAdapter = {
  platform: "linkedin",
  requiredScopes: ["w_member_social"],
  mediaSupport: "none",
  assertConfigured: assertLinkedInConfigured,
  publishText: (accessToken, input) => publishLinkedInTextPost(accessToken, input.externalAccountId, input.copy),
};
