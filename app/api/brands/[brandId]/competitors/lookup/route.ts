import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, COMPETITOR_FEATURES, COMPETITOR_WORKER, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { getCompetitorLookupContext } from "@/lib/db/repositories/competitors";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { getValidSocialAccessToken } from "@/lib/server/social-access-token";
import { readBoundedSocialProviderResponse } from "@/lib/server/social-provider-response";
import { InstagramCompetitorError, lookupInstagramCompetitor } from "@/lib/server/competitor-instagram";
import { FacebookCompetitorError, lookupFacebookCompetitor } from "@/lib/server/competitor-facebook";
import { XCompetitorError, lookupXCompetitor } from "@/lib/server/competitor-x";
import { competitorBrandIdSchema, competitorProfileLookupRequestSchema, competitorProfileLookupResponseSchema } from "@/lib/validation/competitors";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ brandId: string }> };

const youtubeResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string().regex(/^UC[a-zA-Z0-9_-]{22}$/u),
    snippet: z.object({ title: z.string().trim().min(1).max(120), customUrl: z.string().max(100).optional() }).passthrough(),
  }).passthrough()).max(1),
}).passthrough();

type ChannelQuery = { parameter: "id" | "forHandle" | "forUsername"; value: string };

function parseChannelIdentifier(identifier: string): ChannelQuery {
  const value = identifier.trim();
  if (/^UC[a-zA-Z0-9_-]{22}$/u.test(value)) return { parameter: "id", value };
  if (/^https?:\/\//iu.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable); }
    if (url.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname) || url.username || url.password || url.port) {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 1 && parts[0].startsWith("@")) return { parameter: "forHandle", value: parts[0] };
    if (parts.length === 2 && parts[0] === "channel" && /^UC[a-zA-Z0-9_-]{22}$/u.test(parts[1])) return { parameter: "id", value: parts[1] };
    if (parts.length === 2 && parts[0] === "user" && /^[a-zA-Z0-9._-]{1,100}$/u.test(parts[1])) return { parameter: "forUsername", value: parts[1] };
    throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
  }
  if (/^@?[a-zA-Z0-9._-]{3,100}$/u.test(value)) {
    return { parameter: "forHandle", value: value.startsWith("@") ? value : `@${value}` };
  }
  throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.competitorResearchManage);
    assertSameOriginJsonRequest(request);
    const { brandId } = await params;
    if (!competitorBrandIdSchema.safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = competitorProfileLookupRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const lookupContext = await getCompetitorLookupContext(tenant.organizationId, brandId, parsed.data.platform === "youtube" ? "youtube" : parsed.data.platform === "x" ? "x" : "facebook");
    if (!lookupContext.brandExists) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    const connectedProfile = lookupContext.profile;
    if (parsed.data.platform === "instagram") {
      const requiredScopes = ["pages_show_list", "pages_read_engagement", "instagram_basic"];
      if (!connectedProfile?.externalAccountId || !requiredScopes.every((scope) => connectedProfile.scopes.includes(scope))) {
        throw new ApiError(API_ERROR_CODES.competitorInstagramConnectionRequired, HTTP_STATUS.conflict);
      }
      const accessToken = await getValidSocialAccessToken(tenant.organizationId, connectedProfile.id);
      if (!accessToken) throw new ApiError(API_ERROR_CODES.competitorInstagramConnectionRequired, HTTP_STATUS.conflict);
      let result: Awaited<ReturnType<typeof lookupInstagramCompetitor>>;
      try { result = await lookupInstagramCompetitor(accessToken, connectedProfile.externalAccountId, parsed.data.identifier, false); }
      catch (error) {
        if (error instanceof InstagramCompetitorError && error.code === "profile_not_found") {
          throw new ApiError(API_ERROR_CODES.competitorProfileNotFound, HTTP_STATUS.notFound);
        }
        if (error instanceof InstagramCompetitorError && error.code === "connection_required") {
          throw new ApiError(API_ERROR_CODES.competitorInstagramConnectionRequired, HTTP_STATUS.conflict);
        }
        if (error instanceof InstagramCompetitorError && error.code === "invalid_identifier") throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
        if (error instanceof InstagramCompetitorError && error.code === "permission_required") throw new ApiError(API_ERROR_CODES.competitorInstagramConnectionRequired, HTTP_STATUS.conflict);
        throw new ApiError(API_ERROR_CODES.competitorProfileLookupUnavailable, HTTP_STATUS.unavailable);
      }
      const profile = result.profile;
      const response = competitorProfileLookupResponseSchema.parse({ data: {
        platform: "instagram", externalProfileId: profile.id, name: profile.name ?? profile.username,
        handle: `@${profile.username}`, profileUrl: profile.profileUrl, feedUrl: null,
      } });
      return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
    }
    if (parsed.data.platform === "facebook") {
      const requiredScopes = ["pages_show_list", "pages_read_engagement"];
      if (!connectedProfile?.externalAccountId || !requiredScopes.every((scope) => connectedProfile.scopes.includes(scope))) {
        throw new ApiError(API_ERROR_CODES.competitorFacebookConnectionRequired, HTTP_STATUS.conflict);
      }
      const accessToken = await getValidSocialAccessToken(tenant.organizationId, connectedProfile.id);
      if (!accessToken) throw new ApiError(API_ERROR_CODES.competitorFacebookConnectionRequired, HTTP_STATUS.conflict);
      let result: Awaited<ReturnType<typeof lookupFacebookCompetitor>>;
      try { result = await lookupFacebookCompetitor(accessToken, parsed.data.identifier); }
      catch (error) {
        if (error instanceof FacebookCompetitorError && error.code === "profile_not_found") throw new ApiError(API_ERROR_CODES.competitorProfileNotFound, HTTP_STATUS.notFound);
        if (error instanceof FacebookCompetitorError && error.code === "invalid_identifier") throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
        if (error instanceof FacebookCompetitorError && (error.code === "connection_required" || error.code === "permission_required")) throw new ApiError(API_ERROR_CODES.competitorFacebookConnectionRequired, HTTP_STATUS.conflict);
        throw new ApiError(API_ERROR_CODES.competitorProfileLookupUnavailable, HTTP_STATUS.unavailable);
      }
      const profile = result.profile;
      const response = competitorProfileLookupResponseSchema.parse({ data: {
        platform: "facebook", externalProfileId: profile.id, name: profile.name,
        handle: profile.username ? `@${profile.username}` : profile.id, profileUrl: profile.profileUrl, feedUrl: null,
      } });
      return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
    }
    if (parsed.data.platform === "x") {
      if (!COMPETITOR_FEATURES.xApi) throw new ApiError(API_ERROR_CODES.competitorXApiDisabled, HTTP_STATUS.unavailable);
      const requiredScopes = ["users.read", "tweet.read"];
      if (!connectedProfile || !requiredScopes.every((scope) => connectedProfile.scopes.includes(scope))) {
        throw new ApiError(API_ERROR_CODES.competitorXConnectionRequired, HTTP_STATUS.conflict);
      }
      const accessToken = await getValidSocialAccessToken(tenant.organizationId, connectedProfile.id);
      if (!accessToken) throw new ApiError(API_ERROR_CODES.competitorXConnectionRequired, HTTP_STATUS.conflict);
      let result: Awaited<ReturnType<typeof lookupXCompetitor>>;
      try { result = await lookupXCompetitor(accessToken, parsed.data.identifier); }
      catch (error) {
        if (error instanceof XCompetitorError && error.code === "profile_not_found") throw new ApiError(API_ERROR_CODES.competitorProfileNotFound, HTTP_STATUS.notFound);
        if (error instanceof XCompetitorError && error.code === "invalid_identifier") throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
        if (error instanceof XCompetitorError && (error.code === "connection_required" || error.code === "permission_required")) throw new ApiError(API_ERROR_CODES.competitorXConnectionRequired, HTTP_STATUS.conflict);
        throw new ApiError(API_ERROR_CODES.competitorProfileLookupUnavailable, HTTP_STATUS.unavailable);
      }
      const profile = result.profile;
      const response = competitorProfileLookupResponseSchema.parse({ data: {
        platform: "x", externalProfileId: profile.id, name: profile.name,
        handle: `@${profile.username}`, profileUrl: `https://x.com/${encodeURIComponent(profile.username)}/`, feedUrl: null,
      } });
      return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
    }
    const requiredScope = "https://www.googleapis.com/auth/youtube.readonly";
    if (!connectedProfile || !connectedProfile.scopes.includes(requiredScope)) {
      throw new ApiError(API_ERROR_CODES.competitorYouTubeConnectionRequired, HTTP_STATUS.conflict);
    }
    const accessToken = await getValidSocialAccessToken(tenant.organizationId, connectedProfile.id);
    if (!accessToken) throw new ApiError(API_ERROR_CODES.competitorYouTubeConnectionRequired, HTTP_STATUS.conflict);

    const query = parseChannelIdentifier(parsed.data.identifier);
    const providerUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    providerUrl.searchParams.set("part", "snippet");
    providerUrl.searchParams.set(query.parameter, query.value);
    providerUrl.searchParams.set("maxResults", "1");
    let response: Response;
    try {
      response = await fetch(providerUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(COMPETITOR_WORKER.profileLookupTimeoutMilliseconds),
      });
    } catch {
      throw new ApiError(API_ERROR_CODES.competitorProfileLookupUnavailable, HTTP_STATUS.unavailable);
    }
    if (!response.ok) throw new ApiError(API_ERROR_CODES.competitorProfileLookupUnavailable, HTTP_STATUS.unavailable);
    let providerPayload: unknown;
    try { providerPayload = JSON.parse(await readBoundedSocialProviderResponse(response)); }
    catch { throw new ApiError(API_ERROR_CODES.competitorProfileLookupUnavailable, HTTP_STATUS.unavailable); }
    const providerResult = youtubeResponseSchema.safeParse(providerPayload);
    const channel = providerResult.success ? providerResult.data.items[0] : undefined;
    if (!channel) throw new ApiError(API_ERROR_CODES.competitorProfileNotFound, HTTP_STATUS.notFound);

    const result = competitorProfileLookupResponseSchema.parse({ data: {
      platform: "youtube", externalProfileId: channel.id, name: channel.snippet.title,
      handle: channel.snippet.customUrl ?? null,
      profileUrl: `https://www.youtube.com/channel/${channel.id}`,
      feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`,
    } });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
