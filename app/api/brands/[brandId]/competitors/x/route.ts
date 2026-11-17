import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, COMPETITOR_FEATURES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createSocialGraphCompetitorSource, getCompetitorLookupContext } from "@/lib/db/repositories/competitors";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { XCompetitorError, lookupXCompetitor } from "@/lib/server/competitor-x";
import { getValidSocialAccessToken } from "@/lib/server/social-access-token";
import { competitorBrandIdSchema, competitorProfileLookupRequestSchema } from "@/lib/validation/competitors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.competitorResearchManage);
    assertSameOriginJsonRequest(request);
    const { brandId } = await params;
    if (!competitorBrandIdSchema.safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    if (!COMPETITOR_FEATURES.xApi) throw new ApiError(API_ERROR_CODES.competitorXApiDisabled, HTTP_STATUS.unavailable);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = competitorProfileLookupRequestSchema.safeParse({ ...(typeof body === "object" && body ? body : {}), platform: "x" });
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const context = await getCompetitorLookupContext(tenant.organizationId, brandId, "x");
    if (!context.brandExists) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    const profile = context.profile;
    if (!profile || !["users.read", "tweet.read"].every((scope) => profile.scopes.includes(scope))) {
      throw new ApiError(API_ERROR_CODES.competitorXConnectionRequired, HTTP_STATUS.conflict);
    }
    const accessToken = await getValidSocialAccessToken(tenant.organizationId, profile.id);
    if (!accessToken) throw new ApiError(API_ERROR_CODES.competitorXConnectionRequired, HTTP_STATUS.conflict);
    let result: Awaited<ReturnType<typeof lookupXCompetitor>>;
    try { result = await lookupXCompetitor(accessToken, parsed.data.identifier); }
    catch (error) {
      if (error instanceof XCompetitorError && error.code === "profile_not_found") throw new ApiError(API_ERROR_CODES.competitorProfileNotFound, HTTP_STATUS.notFound);
      if (error instanceof XCompetitorError && error.code === "invalid_identifier") throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
      if (error instanceof XCompetitorError && (error.code === "connection_required" || error.code === "permission_required")) throw new ApiError(API_ERROR_CODES.competitorXConnectionRequired, HTTP_STATUS.conflict);
      throw new ApiError(API_ERROR_CODES.competitorProfileLookupUnavailable, HTTP_STATUS.unavailable);
    }
    const created = await createSocialGraphCompetitorSource(tenant.organizationId, brandId, tenant.userId, {
      name: result.profile.name, profileUrl: `https://x.com/${encodeURIComponent(result.profile.username)}/`,
      profileIdentifier: result.profile.id, socialProfileId: profile.id, retrievalMethod: "x_api",
    });
    if (created.kind === "not_found") throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    if (created.kind === "connection_required") throw new ApiError(API_ERROR_CODES.competitorXConnectionRequired, HTTP_STATUS.conflict);
    if (created.kind === "duplicate") throw new ApiError(API_ERROR_CODES.competitorSourceExists, HTTP_STATUS.conflict);
    if (created.kind === "limit_reached") throw new ApiError(API_ERROR_CODES.competitorSourceLimitReached, HTTP_STATUS.conflict);
    return NextResponse.json({ data: { id: created.id } }, { status: HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
