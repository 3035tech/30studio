import "server-only";
import { createHash } from "node:crypto";
import { COMPETITOR_WORKER, SOCIAL_CONNECTION } from "@/lib/constants";
import type { CompetitorFeedItem } from "@/lib/db/repositories/competitors";
import { readBoundedSocialProviderResponse } from "@/lib/server/social-provider-response";

type InstagramProfile = { id: string; username: string; name: string | null; profileUrl: string };
type InstagramCompetitorResult = { profile: InstagramProfile; items: CompetitorFeedItem[] };
export class InstagramCompetitorError extends Error {
  constructor(readonly code: "connection_required" | "permission_required" | "profile_not_found" | "invalid_identifier" | "provider_unavailable") {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function apiVersion() {
  const version = process.env.META_GRAPH_API_VERSION;
  if (!version || !/^v\d+\.\d+$/u.test(version)) throw new Error("Meta Graph API version is not configured.");
  return version;
}

async function getJson(url: URL, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds),
  });
  if (!response.ok) {
    let providerCode: number | null = null;
    try {
      const payload: unknown = JSON.parse(await readBoundedSocialProviderResponse(response));
      if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.code === "number") providerCode = payload.error.code;
    } catch { await response.body?.cancel(); }
    if (response.status === 403 || providerCode === 10 || providerCode === 200) throw new InstagramCompetitorError("permission_required");
    if (providerCode === 100) throw new InstagramCompetitorError("profile_not_found");
    throw new InstagramCompetitorError("provider_unavailable");
  }
  let payload: unknown;
  try { payload = JSON.parse(await readBoundedSocialProviderResponse(response)); }
  catch { throw new Error("Meta competitor API returned an invalid response."); }
  if (!isRecord(payload)) throw new Error("Meta competitor API returned an invalid response.");
  return payload;
}

function instagramAccountId(value: unknown) {
  if (!isRecord(value) || !isRecord(value.instagram_business_account)) return null;
  const id = value.instagram_business_account.id;
  return typeof id === "string" && /^\d{1,32}$/u.test(id) ? id : null;
}

function parseProfile(value: unknown): InstagramProfile | null {
  if (!isRecord(value) || !/^\d{1,32}$/u.test(String(value.id ?? ""))) return null;
  const username = safeText(value.username, 100);
  if (!/^[a-zA-Z0-9._]{1,100}$/u.test(username)) return null;
  return {
    id: String(value.id), username, name: safeText(value.name, 120) || null,
    profileUrl: `https://www.instagram.com/${encodeURIComponent(username)}/`,
  };
}

function parseMedia(value: unknown): CompetitorFeedItem[] {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data.slice(0, COMPETITOR_WORKER.maximumEntriesPerFetch).flatMap((entry): CompetitorFeedItem[] => {
    if (!isRecord(entry)) return [];
    const id = safeText(entry.id, 128);
    const permalink = safeText(entry.permalink, 300);
    if (!id || !/^https:\/\/www\.instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+\/?(?:\?.*)?$/u.test(permalink)) return [];
    const caption = safeText(entry.caption, COMPETITOR_WORKER.maximumSummaryCharacters);
    const mediaType = safeText(entry.media_type, 30).toLowerCase();
    const title = (caption.split(/[.!?\n]/u)[0]?.trim() || `${mediaType || "Instagram"} post`).slice(0, COMPETITOR_WORKER.maximumTitleCharacters);
    const rawTimestamp = safeText(entry.timestamp, 40);
    const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : null;
    const contentPublishedAt = parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime()) ? parsedTimestamp : null;
    return [{
      externalId: createHash("sha256").update(id).digest("hex"), title,
      summary: caption || null, sourceUrl: permalink, contentPublishedAt,
    }];
  });
}

export async function lookupInstagramCompetitor(accessToken: string, facebookPageId: string, username: string, includeMedia = true): Promise<InstagramCompetitorResult> {
  if (!/^\d{1,32}$/u.test(facebookPageId)) throw new InstagramCompetitorError("connection_required");
  const normalizedUsername = username.replace(/^@/u, "").trim();
  if (!/^[a-zA-Z0-9._]{1,100}$/u.test(normalizedUsername)) throw new InstagramCompetitorError("invalid_identifier");
  const version = apiVersion();
  const ownPageUrl = new URL(`/${version}/${encodeURIComponent(facebookPageId)}`, "https://graph.facebook.com");
  ownPageUrl.searchParams.set("fields", "instagram_business_account");
  const ownPage = await getJson(ownPageUrl, accessToken);
  const ownInstagramId = instagramAccountId(ownPage);
  if (!ownInstagramId) throw new InstagramCompetitorError("connection_required");

  const discoveryUrl = new URL(`/${version}/${ownInstagramId}`, "https://graph.facebook.com");
  const profileFields = includeMedia ? "id,username,name,media{id,caption,media_type,permalink,timestamp}" : "id,username,name";
  discoveryUrl.searchParams.set("fields", `business_discovery.username(${normalizedUsername}){${profileFields}}`);
  const discovery = await getJson(discoveryUrl, accessToken);
  const businessDiscovery = isRecord(discovery.business_discovery) ? discovery.business_discovery : null;
  const profile = parseProfile(businessDiscovery);
  if (!profile) throw new InstagramCompetitorError("profile_not_found");
  return { profile, items: parseMedia(businessDiscovery?.media) };
}
