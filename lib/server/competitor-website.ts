import "server-only";
import { createHash } from "node:crypto";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { COMPETITOR_SOURCE_ERROR_CODES, COMPETITOR_WORKER } from "@/lib/constants";
import type { CompetitorFeedItem } from "@/lib/db/repositories/competitors";
import { readBoundedResponse, CompetitorFeedError } from "@/lib/server/competitor-feed";

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: true, trimValues: true });
const maximumRobotsBytes = 100_000;
const crawlerAgent = "30studio-competitor-research";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(asText).find(Boolean) ?? "";
  if (isRecord(value)) return asText(value["#text"] ?? value["@_href"] ?? "");
  return "";
}

function safeSameOriginUrl(value: string, origin: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password || url.port || url.search || url.hash) return null;
    return url;
  } catch { return null; }
}

function robotsPatternMatches(path: string, pattern: string) {
  if (!pattern) return false;
  const terminal = pattern.endsWith("$");
  const source = pattern.replace(/[$+?.()|[\]{}\\^]/gu, "\\$&").replace(/\*/gu, ".*").replace(/\\\$$/u, "");
  return new RegExp(`^${source}${terminal ? "$" : ""}`, "u").test(path);
}

function parseRobots(body: string) {
  const sitemapUrls: string[] = [];
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let agents: string[] = [];
  let rules: Array<{ allow: boolean; path: string }> = [];
  for (const rawLine of body.split(/\r?\n/u)) {
    const line = rawLine.split("#", 1)[0]?.trim() ?? "";
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name === "sitemap" && value) sitemapUrls.push(value);
    if (name === "user-agent" && value) {
      if (rules.length) { groups.push({ agents, rules }); agents = []; rules = []; }
      agents.push(value.toLowerCase());
    }
    if ((name === "allow" || name === "disallow") && agents.length) rules.push({ allow: name === "allow", path: value });
  }
  if (agents.length) groups.push({ agents, rules });
  const specificGroups = groups.filter((group) => group.agents.some((agent) => agent !== "*" && crawlerAgent.includes(agent)));
  const applicableGroups = specificGroups.length ? specificGroups : groups.filter((group) => group.agents.includes("*"));
  const applicableRules = applicableGroups.flatMap((group) => group.rules);
  return {
    sitemapUrls,
    allowsPath(path: string) {
      const matches = applicableRules.filter((rule) => robotsPatternMatches(path, rule.path));
      matches.sort((left, right) => right.path.length - left.path.length || Number(right.allow) - Number(left.allow));
      return matches[0]?.allow ?? true;
    },
  };
}

function parseSitemap(xml: string, origin: string): { sitemapUrls: string[]; pages: Array<{ url: URL; lastModified: Date | null }> } {
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml) || XMLValidator.validate(xml) !== true) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.siteSitemapUnavailable);
  let parsed: unknown;
  try { parsed = xmlParser.parse(xml); } catch { throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.siteSitemapUnavailable); }
  if (!isRecord(parsed)) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.siteSitemapUnavailable);
  const index = isRecord(parsed.sitemapindex) ? parsed.sitemapindex : null;
  const urlSet = isRecord(parsed.urlset) ? parsed.urlset : null;
  const rawSitemaps = index?.sitemap;
  const rawPages = urlSet?.url;
  const asArray = (value: unknown) => value === undefined ? [] : Array.isArray(value) ? value : [value];
  const sitemapUrls = asArray(rawSitemaps).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const url = safeSameOriginUrl(asText(entry.loc), origin);
    return url ? [url.toString()] : [];
  });
  const pages = asArray(rawPages).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const url = safeSameOriginUrl(asText(entry.loc), origin);
    if (!url || /\.(?:avif|css|csv|gif|ico|jpe?g|js|json|mp[34]|pdf|png|svg|webp|xml|zip)$/iu.test(url.pathname)) return [];
    const rawDate = asText(entry.lastmod);
    const date = rawDate ? new Date(rawDate) : null;
    return [{ url, lastModified: date && !Number.isNaN(date.getTime()) ? date : null }];
  });
  return { sitemapUrls, pages };
}

function isElementNode(node: DefaultTreeAdapterMap["node"]): node is DefaultTreeAdapterMap["element"] {
  return "tagName" in node && "attrs" in node;
}

function isParentNode(node: DefaultTreeAdapterMap["node"]): node is DefaultTreeAdapterMap["parentNode"] {
  return "childNodes" in node;
}

function isTextNode(node: DefaultTreeAdapterMap["node"]): node is DefaultTreeAdapterMap["textNode"] {
  return node.nodeName === "#text" && "value" in node;
}

function isTemplateNode(node: DefaultTreeAdapterMap["node"]): node is DefaultTreeAdapterMap["template"] {
  return "tagName" in node && node.tagName === "template" && "content" in node;
}

function walk(node: DefaultTreeAdapterMap["node"], visit: (element: DefaultTreeAdapterMap["element"]) => void) {
  if (isElementNode(node)) visit(node);
  if (isTemplateNode(node)) {
    for (const child of node.content.childNodes) walk(child, visit);
  }
  if (isParentNode(node)) {
    for (const child of node.childNodes) walk(child, visit);
  }
}

function nodeText(node: DefaultTreeAdapterMap["node"]): string {
  if (isTextNode(node)) return node.value;
  if (isElementNode(node) && ["script", "style", "noscript", "svg"].includes(node.tagName)) return "";
  if (!isParentNode(node)) return "";
  return node.childNodes.map(nodeText).join(" ").replace(/\s+/gu, " ").trim();
}

function pageMetadata(html: string, pageUrl: URL) {
  const document = parse(html);
  let title = "";
  let heading = "";
  let description = "";
  let canonicalUrl = "";
  walk(document, (element) => {
    const attr = (name: string) => element.attrs.find((item) => item.name === name)?.value ?? "";
    if (element.tagName === "title" && !title) title = nodeText(element);
    if (element.tagName === "h1" && !heading) heading = nodeText(element);
    if (element.tagName === "meta") {
      const property = (attr("property") || attr("name")).toLowerCase();
      if (["og:title", "twitter:title"].includes(property) && !title) title = attr("content").trim();
      if (["description", "og:description", "twitter:description"].includes(property) && !description) description = attr("content").trim();
    }
    if (element.tagName === "link" && attr("rel").toLowerCase().split(/\s+/u).includes("canonical") && !canonicalUrl) {
      try { canonicalUrl = safeSameOriginUrl(new URL(attr("href"), pageUrl).toString(), pageUrl.origin)?.toString() ?? ""; } catch { /* Ignore malformed canonical links. */ }
    }
  });
  const sourceUrl = canonicalUrl || pageUrl.toString();
  let decodedPath = pageUrl.hostname;
  try { decodedPath = decodeURIComponent(pageUrl.pathname.split("/").filter(Boolean).at(-1) ?? pageUrl.hostname); } catch { /* Use the encoded path as a safe fallback. */ }
  const pathTitle = decodedPath
    .replace(/[-_]+/gu, " ").replace(/\.[a-z0-9]{1,8}$/iu, "").trim();
  return { title: (title || heading || pathTitle || pageUrl.hostname).slice(0, COMPETITOR_WORKER.maximumTitleCharacters), summary: description.slice(0, COMPETITOR_WORKER.maximumSummaryCharacters) || null, sourceUrl };
}

function sitemapPageItems(xml: string, origin: string) {
  const parsed = parseSitemap(xml, origin);
  return parsed;
}

export async function collectCompetitorWebsite(input: { websiteUrl: string }): Promise<CompetitorFeedItem[]> {
  let site: URL;
  try { site = new URL(input.websiteUrl); } catch { throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.invalidUrl); }
  if (site.protocol !== "https:" || site.username || site.password || site.port || site.search || site.hash || (site.pathname !== "/" && site.pathname !== "")) {
    throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.invalidUrl);
  }
  const origin = site.origin;
  const robotsUrl = new URL("/robots.txt", site);
  const robotsResponse = await readBoundedResponse(robotsUrl, {}, { accept: "text/plain", maximumBytes: maximumRobotsBytes });
  if (robotsResponse.statusCode !== 404 && (robotsResponse.statusCode < 200 || robotsResponse.statusCode >= 300)) {
    throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.siteSitemapUnavailable);
  }
  const robotsContentType = String(robotsResponse.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
  if (robotsResponse.statusCode !== 404 && robotsContentType !== "text/plain") throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.siteSitemapUnavailable);
  const robots = parseRobots(robotsResponse.statusCode === 404 ? "" : robotsResponse.body);
  const sitemapUrls = robots.sitemapUrls.map((value) => safeSameOriginUrl(value, origin)?.toString()).filter((value): value is string => Boolean(value)).slice(0, COMPETITOR_WORKER.maximumWebsiteSitemapsPerFetch);
  if (!sitemapUrls.length) sitemapUrls.push(new URL("/sitemap.xml", site).toString());
  const pageCandidates: Array<{ url: URL; lastModified: Date | null }> = [];
  const sitemapQueue = [...sitemapUrls];
  let visitedSitemaps = 0;
  let blockedByRobots = false;
  while (sitemapQueue.length && visitedSitemaps < COMPETITOR_WORKER.maximumWebsiteSitemapsPerFetch) {
    const value = sitemapQueue.shift();
    if (!value) continue;
    const sitemapUrl = safeSameOriginUrl(value, origin);
    if (!sitemapUrl) continue;
    if (!robots.allowsPath(sitemapUrl.pathname)) { blockedByRobots = true; continue; }
    const response = await readBoundedResponse(sitemapUrl, {}, { accept: "application/xml, text/xml", maximumBytes: COMPETITOR_WORKER.maximumFeedBytes });
    visitedSitemaps += 1;
    if (response.statusCode < 200 || response.statusCode >= 300) continue;
    if (!/^(?:application|text)\/(?:xml|.*\+xml)$/iu.test(String(response.headers["content-type"] ?? "").split(";")[0]?.trim() ?? "")) continue;
    const parsed = sitemapPageItems(response.body, origin);
    sitemapQueue.push(...parsed.sitemapUrls.slice(0, COMPETITOR_WORKER.maximumWebsiteSitemapsPerFetch - visitedSitemaps));
    pageCandidates.push(...parsed.pages.slice(0, Math.max(0, COMPETITOR_WORKER.maximumWebsitePagesPerSitemap - pageCandidates.length)));
    if (pageCandidates.length >= COMPETITOR_WORKER.maximumWebsitePagesPerSitemap) break;
  }
  const uniquePages = new Map<string, { url: URL; lastModified: Date | null }>();
  for (const page of pageCandidates) {
    if (!robots.allowsPath(page.url.pathname)) { blockedByRobots = true; continue; }
    if (!uniquePages.has(page.url.toString())) uniquePages.set(page.url.toString(), page);
  }
  const pages = [...uniquePages.values()].sort((left, right) => (right.lastModified?.getTime() ?? 0) - (left.lastModified?.getTime() ?? 0)).slice(0, COMPETITOR_WORKER.maximumWebsitePagesPerFetch);
  if (!pages.length) throw new CompetitorFeedError(blockedByRobots ? COMPETITOR_SOURCE_ERROR_CODES.siteRobotsBlocked : COMPETITOR_SOURCE_ERROR_CODES.siteSitemapUnavailable);
  const items: CompetitorFeedItem[] = [];
  for (const page of pages) {
    const response = await readBoundedResponse(page.url, {}, { accept: "text/html, application/xhtml+xml", maximumBytes: COMPETITOR_WORKER.maximumFeedBytes });
    if (response.statusCode < 200 || response.statusCode >= 300) continue;
    const contentType = String(response.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
    if (contentType !== "text/html" && contentType !== "application/xhtml+xml") continue;
    const metadata = pageMetadata(response.body, page.url);
    const version = page.lastModified?.toISOString() ?? `${metadata.title}\n${metadata.summary ?? ""}`;
    items.push({
      externalId: createHash("sha256").update(`${metadata.sourceUrl}\n${version}`).digest("hex"),
      title: metadata.title, summary: metadata.summary, sourceUrl: metadata.sourceUrl, contentPublishedAt: page.lastModified,
    });
  }
  if (!items.length) throw new CompetitorFeedError(COMPETITOR_SOURCE_ERROR_CODES.siteContentUnsupported);
  return items;
}
