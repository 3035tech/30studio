import "server-only";
import { createHash } from "node:crypto";
import { COMPETITOR_WORKER, SOCIAL_CONNECTION } from "@/lib/constants";
import type { CompetitorFeedItem } from "@/lib/db/repositories/competitors";
import { readBoundedSocialProviderResponse } from "@/lib/server/social-provider-response";

type FacebookPage = { id: string; name: string; username: string | null; profileUrl: string };
type FacebookCompetitorResult = { profile: FacebookPage; items: CompetitorFeedItem[] };
export class FacebookCompetitorError extends Error {
  constructor(readonly code: "connection_required" | "permission_required" | "profile_not_found" | "invalid_identifier" | "provider_unavailable") {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function getVersion() {
  const version = process.env.META_GRAPH_API_VERSION;
  if (!version || !/^v\d+\.\d+$/u.test(version)) throw new Error("Meta Graph API version is not configured.");
  return version;
}

function parsePageIdentifier(identifier: string) {
  const value = identifier.trim();
  if (/^\d{3,32}$/u.test(value)) return value;
  if (/^https:\/\//iu.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { throw new FacebookCompetitorError("invalid_identifier"); }
    if (url.protocol !== "https:" || !["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname)
      || url.username || url.password || url.port || url.search || url.hash) throw new FacebookCompetitorError("invalid_identifier");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 3 && parts[0] === "pages" && /^\d{3,32}$/u.test(parts[2] ?? "")) return parts[2] as string;
    if (parts.length === 1 && /^[a-zA-Z0-9._-]{3,100}$/u.test(parts[0] ?? "")) return parts[0] as string;
    throw new FacebookCompetitorError("invalid_identifier");
  }
  if (/^[a-zA-Z0-9._-]{3,100}$/u.test(value)) return value;
  throw new FacebookCompetitorError("invalid_identifier");
}

async function getJson(url: URL, accessToken: string) {
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
    if (providerCode === 190) throw new FacebookCompetitorError("connection_required");
    if (response.status === 403 || providerCode === 10 || providerCode === 200) throw new FacebookCompetitorError("permission_required");
    if (providerCode === 100) throw new FacebookCompetitorError("profile_not_found");
    throw new FacebookCompetitorError("provider_unavailable");
  }
  let payload: unknown;
  try { payload = JSON.parse(await readBoundedSocialProviderResponse(response)); }
  catch { throw new FacebookCompetitorError("provider_unavailable"); }
  if (!isRecord(payload)) throw new FacebookCompetitorError("provider_unavailable");
  return payload;
}

function parseProfile(value: unknown): FacebookPage | null {
  if (!isRecord(value)) return null;
  const id = boundedText(value.id, 32);
  const name = boundedText(value.name, 120);
  if (!/^\d{3,32}$/u.test(id) || !name) return null;
  const username = boundedText(value.username, 100) || null;
  const candidateUrl = boundedText(value.link, 300);
  let profileUrl = `https://www.facebook.com/${id}`;
  if (candidateUrl) {
    try {
      const link = new URL(candidateUrl);
      if (link.protocol === "https:" && ["facebook.com", "www.facebook.com", "m.facebook.com"].includes(link.hostname) && !link.username && !link.password && !link.port) {
        link.hash = "";
        profileUrl = link.toString();
      }
    } catch { /* Keep a canonical Facebook Page URL. */ }
  }
  return { id, name, username, profileUrl };
}

function parsePosts(value: unknown): CompetitorFeedItem[] {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data.slice(0, COMPETITOR_WORKER.maximumEntriesPerFetch).flatMap((entry): CompetitorFeedItem[] => {
    if (!isRecord(entry)) return [];
    const id = boundedText(entry.id, 128);
    const permalink = boundedText(entry.permalink_url, 500);
    let sourceUrl: string;
    try {
      const url = new URL(permalink);
      if (url.protocol !== "https:" || !["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname) || url.username || url.password || url.port) return [];
      url.hash = "";
      sourceUrl = url.toString();
    } catch { return []; }
    if (!id) return [];
    const summary = boundedText(entry.message, COMPETITOR_WORKER.maximumSummaryCharacters) || null;
    const title = (summary?.split(/[.!?\n]/u)[0]?.trim() || "Facebook Page post").slice(0, COMPETITOR_WORKER.maximumTitleCharacters);
    const rawTimestamp = boundedText(entry.created_time, 40);
    const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : null;
    const contentPublishedAt = parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime()) ? parsedTimestamp : null;
    return [{ externalId: createHash("sha256").update(id).digest("hex"), title, summary, sourceUrl, contentPublishedAt }];
  });
}

export async function lookupFacebookCompetitor(accessToken: string, identifier: string, includePosts = false): Promise<FacebookCompetitorResult> {
  const pageIdentifier = parsePageIdentifier(identifier);
  const version = getVersion();
  const profileUrl = new URL(`/${version}/${encodeURIComponent(pageIdentifier)}`, "https://graph.facebook.com");
  profileUrl.searchParams.set("fields", "id,name,username,link");
  const profileResponse = await getJson(profileUrl, accessToken);
  const profile = parseProfile(profileResponse);
  if (!profile) throw new FacebookCompetitorError("profile_not_found");
  if (!includePosts) return { profile, items: [] };

  const postsUrl = new URL(`/${version}/${profile.id}/published_posts`, "https://graph.facebook.com");
  postsUrl.searchParams.set("fields", "id,message,permalink_url,created_time");
  postsUrl.searchParams.set("limit", String(COMPETITOR_WORKER.maximumEntriesPerFetch));
  const postsResponse = await getJson(postsUrl, accessToken);
  return { profile, items: parsePosts(postsResponse) };
}
