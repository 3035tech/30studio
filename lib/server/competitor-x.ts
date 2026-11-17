import "server-only";
import { createHash } from "node:crypto";
import { COMPETITOR_WORKER, SOCIAL_CONNECTION } from "@/lib/constants";
import type { CompetitorFeedItem } from "@/lib/db/repositories/competitors";
import { readBoundedSocialProviderResponse } from "@/lib/server/social-provider-response";

type XUser = { id: string; username: string; name: string };
type XCompetitorResult = { profile: XUser; items: CompetitorFeedItem[] };
export class XCompetitorError extends Error {
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

async function getJson(url: URL, accessToken: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(SOCIAL_CONNECTION.providerRequestTimeoutMilliseconds),
    });
  } catch { throw new XCompetitorError("provider_unavailable"); }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401) throw new XCompetitorError("connection_required");
    if (response.status === 403) throw new XCompetitorError("permission_required");
    if (response.status === 404) throw new XCompetitorError("profile_not_found");
    throw new XCompetitorError("provider_unavailable");
  }
  let payload: unknown;
  try { payload = JSON.parse(await readBoundedSocialProviderResponse(response)); }
  catch { throw new XCompetitorError("provider_unavailable"); }
  if (!isRecord(payload)) throw new XCompetitorError("provider_unavailable");
  return payload;
}

function parseIdentifier(identifier: string) {
  const value = identifier.trim().replace(/^@/u, "");
  if (/^\d{1,64}$/u.test(value)) return { id: value, username: null as string | null };
  if (/^https:\/\//iu.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { throw new XCompetitorError("invalid_identifier"); }
    if (url.protocol !== "https:" || !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname)
      || url.username || url.password || url.port || url.search || url.hash) throw new XCompetitorError("invalid_identifier");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) throw new XCompetitorError("invalid_identifier");
    return { id: null, username: parts[0] ?? "" };
  }
  if (!/^[a-zA-Z0-9_]{1,15}$/u.test(value)) throw new XCompetitorError("invalid_identifier");
  return { id: null, username: value };
}

function parseProfile(value: unknown): XUser | null {
  if (!isRecord(value)) return null;
  const id = safeText(value.id, 64);
  const username = safeText(value.username, 15);
  const name = safeText(value.name, 120);
  if (!/^\d{1,64}$/u.test(id) || !/^[a-zA-Z0-9_]{1,15}$/u.test(username) || !name) return null;
  return { id, username, name };
}

function parsePosts(value: unknown, username: string): CompetitorFeedItem[] {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data.slice(0, COMPETITOR_WORKER.maximumEntriesPerFetch).flatMap((entry): CompetitorFeedItem[] => {
    if (!isRecord(entry)) return [];
    const id = safeText(entry.id, 64);
    const text = safeText(entry.text, COMPETITOR_WORKER.maximumSummaryCharacters);
    if (!/^\d{1,64}$/u.test(id) || !text) return [];
    const rawTimestamp = safeText(entry.created_at, 40);
    const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : null;
    const contentPublishedAt = parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime()) ? parsedTimestamp : null;
    const title = (text.split(/[.!?\n]/u)[0]?.trim() || "X post").slice(0, COMPETITOR_WORKER.maximumTitleCharacters);
    return [{
      externalId: createHash("sha256").update(id).digest("hex"), title, summary: text,
      sourceUrl: `https://x.com/${encodeURIComponent(username)}/status/${id}`, contentPublishedAt,
    }];
  });
}

function usernameFromProfileUrl(profileUrl: string) {
  let url: URL;
  try { url = new URL(profileUrl); } catch { throw new XCompetitorError("invalid_identifier"); }
  if (url.protocol !== "https:" || !["x.com", "www.x.com"].includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash) {
    throw new XCompetitorError("invalid_identifier");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const username = parts.length === 1 ? parts[0] : "";
  if (!username || !/^[a-zA-Z0-9_]{1,15}$/u.test(username)) throw new XCompetitorError("invalid_identifier");
  return username;
}

export async function collectXCompetitorPosts(accessToken: string, userId: string, profileUrl: string): Promise<CompetitorFeedItem[]> {
  if (!/^\d{1,64}$/u.test(userId)) throw new XCompetitorError("invalid_identifier");
  const username = usernameFromProfileUrl(profileUrl);
  const postsUrl = new URL(`/2/users/${encodeURIComponent(userId)}/tweets`, "https://api.x.com");
  postsUrl.searchParams.set("max_results", String(COMPETITOR_WORKER.maximumEntriesPerFetch));
  postsUrl.searchParams.set("tweet.fields", "id,text,created_at");
  postsUrl.searchParams.set("exclude", "replies,retweets");
  const posts = await getJson(postsUrl, accessToken);
  return parsePosts(posts, username);
}

export async function lookupXCompetitor(accessToken: string, identifier: string, includePosts = false): Promise<XCompetitorResult> {
  const parsedIdentifier = parseIdentifier(identifier);
  const lookupPath = parsedIdentifier.id
    ? `/2/users/${encodeURIComponent(parsedIdentifier.id)}`
    : `/2/users/by/username/${encodeURIComponent(parsedIdentifier.username ?? "")}`;
  const lookupUrl = new URL(lookupPath, "https://api.x.com");
  lookupUrl.searchParams.set("user.fields", "id,name,username");
  const response = await getJson(lookupUrl, accessToken);
  const profile = parseProfile(response.data);
  if (!profile) throw new XCompetitorError("profile_not_found");
  if (!includePosts) return { profile, items: [] };
  const profileUrl = `https://x.com/${encodeURIComponent(profile.username)}/`;
  return { profile, items: await collectXCompetitorPosts(accessToken, profile.id, profileUrl) };
}
