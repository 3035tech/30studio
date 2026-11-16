import "server-only";
import { SOCIAL_CONNECTION } from "@/lib/constants";
import type { SocialPublisherAdapter } from "@/lib/server/social-publisher/types";
import { readBoundedSocialProviderResponse } from "@/lib/server/social-provider-response";

const threadsApiVersion = "v1.0";
const maximumTextCharacters = 500;

function assertThreadsConfigured() {
  if (!process.env.META_CLIENT_ID || !process.env.META_CLIENT_SECRET) throw new Error("Meta app credentials are not configured.");
}

async function publishThreadsText(accessToken: string, externalAccountId: string, copy: string) {
  if ([...copy].length > maximumTextCharacters) return { kind: "rejected" as const, status: 422 };

  const endpoint = new URL(`/${threadsApiVersion}/${encodeURIComponent(externalAccountId)}/threads`, "https://graph.threads.net");
  const body = new URLSearchParams({ text: copy, media_type: "TEXT", auto_publish_text: "true" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
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

export const threadsPublisher: SocialPublisherAdapter = {
  platform: "threads",
  requiredScopes: ["threads_basic", "threads_content_publish"],
  mediaSupport: "none",
  maximumTextCharacters,
  assertConfigured: assertThreadsConfigured,
  publishText: (accessToken, input) => publishThreadsText(accessToken, input.externalAccountId, input.copy),
};
