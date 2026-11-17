import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { COMPETITOR_SOURCE_ERROR_CODES, COMPETITOR_WORKER } from "@/lib/constants";
import type { CompetitorFeedItem } from "@/lib/db/repositories/competitors";

export class CompetitorFeedError extends Error {
  constructor(readonly code: typeof COMPETITOR_SOURCE_ERROR_CODES[keyof typeof COMPETITOR_SOURCE_ERROR_CODES]) {
    super(code);
  }
}

type FeedResult = { kind: "not_modified"; etag: string | null; lastModified: string | null } | {
  kind: "updated"; items: CompetitorFeedItem[]; etag: string | null; lastModified: string | null;
};

function isPublicIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === undefined || b === undefined || c === undefined) return false;
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || (b === 0 && c <= 2) || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113)
  );
}

function isPublicIp(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isPublicIpv4(normalized.slice(7));
  if (!/^[23][0-9a-f]{3}:/.test(normalized)) return false;
  return !(
    normalized.startsWith("2001:0:") || normalized.startsWith("2001:2:")
    || normalized.startsWith("2001:10:") || normalized.startsWith("2001:20:")
    || normalized.startsWith("2001:db8:") || normalized.startsWith("2002:")
    || normalized.startsWith("3fff:")
  );
}

export async function readBoundedResponse(url: URL, headers: IncomingHttpHeaders, options: { accept?: string; maximumBytes?: number } = {}): Promise<{ statusCode: number; headers: IncomingHttpHeaders; body: string }> {
  let addresses;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.requestFailed);
  }
  if (addresses.length === 0 || addresses.some((entry) => !isPublicIp(entry.address))) {
    throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.blockedAddress);
  }
  const publicAddresses = addresses;
  const address = publicAddresses[0];
  if (!address) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.blockedAddress);

  return new Promise((resolve, reject) => {
    const request = httpsRequest({
      protocol: "https:", hostname: url.hostname, port: 443,
      path: `${url.pathname}${url.search}`, method: "GET", servername: url.hostname,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, publicAddresses);
        else callback(null, address.address, address.family);
      },
      headers: { "User-Agent": "30studio-competitor-research/1.0", Accept: options.accept ?? "application/rss+xml, application/atom+xml, application/xml, text/xml", ...headers },
      timeout: COMPETITOR_WORKER.requestTimeoutMilliseconds,
    }, (response) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.byteLength;
        if (totalBytes > (options.maximumBytes ?? COMPETITOR_WORKER.maximumFeedBytes)) {
          response.destroy(new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.responseTooLarge));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.requestFailed)));
    request.on("error", (error: unknown) => reject(error instanceof CompetitorFeedError ? error : new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.requestFailed)));
    request.end();
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(asText).join(" ");
  if (!value || typeof value !== "object") return "";
  if (!isRecord(value)) return "";
  return asText(value["#text"] ?? value.__cdata ?? value["@_href"] ?? value["@_url"] ?? "");
}

function plainText(value: unknown, maximumCharacters: number) {
  return asText(value).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim().slice(0, maximumCharacters);
}

function feedEntries(xml: string, feedUrl: string): CompetitorFeedItem[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.invalidFeed);
  }
  let parsed: unknown;
  try {
    parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: true, trimValues: true }).parse(xml);
  } catch {
    throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.invalidFeed);
  }
  if (!isRecord(parsed)) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.invalidFeed);
  const rss = isRecord(parsed.rss) ? parsed.rss : null;
  const channel = rss && isRecord(rss.channel) ? rss.channel : null;
  const atom = isRecord(parsed.feed) ? parsed.feed : null;
  if (!channel && !atom) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.invalidFeed);
  const rawEntries = channel?.item ?? atom?.entry;
  const entries = rawEntries === undefined ? [] : Array.isArray(rawEntries) ? rawEntries : [rawEntries];
  const items: CompetitorFeedItem[] = [];
  for (const rawEntry of entries.slice(0, COMPETITOR_WORKER.maximumEntriesPerFetch)) {
    if (!isRecord(rawEntry)) continue;
    const entry = rawEntry;
    const title = plainText(entry.title, COMPETITOR_WORKER.maximumTitleCharacters);
    if (!title) continue;
    const rawLink = entry.link;
    const linkValue = Array.isArray(rawLink) ? rawLink.find((link) => !isRecord(link) || link["@_rel"] !== "self") ?? rawLink[0] : rawLink;
    let sourceUrl = feedUrl;
    const candidateLink = asText(linkValue);
    if (candidateLink) {
      try {
        const link = new URL(candidateLink, feedUrl);
        if ((link.protocol === "https:" || link.protocol === "http:") && !link.username && !link.password) {
          link.hash = "";
          sourceUrl = link.toString();
        }
      } catch { /* Keep the configured feed URL as the citation when an item link is malformed. */ }
    }
    const summary = plainText(entry.description ?? entry.summary ?? entry["content:encoded"] ?? entry.content, COMPETITOR_WORKER.maximumSummaryCharacters) || null;
    const rawDate = entry.pubDate ?? entry.published ?? entry.updated ?? entry["dc:date"];
    const dateText = asText(rawDate);
    const parsedDate = dateText ? new Date(dateText) : null;
    const contentPublishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    const rawId = asText(entry.guid ?? entry.id) || `${sourceUrl}\n${title}\n${contentPublishedAt?.toISOString() ?? ""}`;
    items.push({
      externalId: createHash("sha256").update(rawId).digest("hex"), title, summary,
      sourceUrl, contentPublishedAt,
    });
  }
  return items;
}

export async function collectCompetitorFeed(input: { feedUrl: string; etag: string | null; lastModified: string | null }): Promise<FeedResult> {
  let url: URL;
  try { url = new URL(input.feedUrl); }
  catch { throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.invalidUrl); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || isIP(url.hostname)) {
    throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.invalidUrl);
  }
  const requestHeaders: IncomingHttpHeaders = {};
  if (input.etag && input.etag.length <= 512) requestHeaders["if-none-match"] = input.etag;
  if (input.lastModified && input.lastModified.length <= 512) requestHeaders["if-modified-since"] = input.lastModified;
  const response = await readBoundedResponse(url, requestHeaders);
  if (response.statusCode === 304) return { kind: "not_modified", etag: input.etag, lastModified: input.lastModified };
  if (response.statusCode < 200 || response.statusCode >= 300) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.httpFailure);
  const contentType = String(response.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
  if (!contentType || !["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"].includes(contentType)) {
    throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.unsupportedContentType);
  }
  return {
    kind: "updated",
    items: feedEntries(response.body, input.feedUrl),
    etag: typeof response.headers.etag === "string" ? response.headers.etag.slice(0, 512) : null,
    lastModified: typeof response.headers["last-modified"] === "string" ? response.headers["last-modified"].slice(0, 512) : null,
  };
}
