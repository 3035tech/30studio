import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createSocialGraphCompetitorSource, getCompetitorLookupContext } from "@/lib/db/repositories/competitors";
import { FacebookCompetitorError, lookupFacebookCompetitor } from "@/lib/server/competitor-facebook";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
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
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = competitorProfileLookupRequestSchema.safeParse({ ...(typeof body === "object" && body ? body : {}), platform: "facebook" });
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const context = await getCompetitorLookupContext(tenant.organizationId, brandId, "facebook");
    if (!context.brandExists) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    const profile = context.profile;
    const requiredScopes = ["pages_show_list", "pages_read_engagement"];
    if (!profile?.externalAccountId || !requiredScopes.every((scope) => profile.scopes.includes(scope))) {
      throw new ApiError(API_ERROR_CODES.competitorFacebookConnectionRequired, HTTP_STATUS.conflict);
    }
    const accessToken = await getValidSocialAccessToken(tenant.organizationId, profile.id);
    if (!accessToken) throw new ApiError(API_ERROR_CODES.competitorFacebookConnectionRequired, HTTP_STATUS.conflict);
    let result: Awaited<ReturnType<typeof lookupFacebookCompetitor>>;
    try { result = await lookupFacebookCompetitor(accessToken, parsed.data.identifier); }
    catch (error) {
      if (error instanceof FacebookCompetitorError && error.code === "profile_not_found") throw new ApiError(API_ERROR_CODES.competitorProfileNotFound, HTTP_STATUS.notFound);
      if (error instanceof FacebookCompetitorError && error.code === "invalid_identifier") throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
      if (error instanceof FacebookCompetitorError && (error.code === "connection_required" || error.code === "permission_required")) throw new ApiError(API_ERROR_CODES.competitorFacebookConnectionRequired, HTTP_STATUS.conflict);
      throw new ApiError(API_ERROR_CODES.competitorProfileLookupUnavailable, HTTP_STATUS.unavailable);
    }
    const created = await createSocialGraphCompetitorSource(tenant.organizationId, brandId, tenant.userId, {
      name: result.profile.name, profileUrl: result.profile.profileUrl,
      profileIdentifier: result.profile.id, socialProfileId: profile.id, retrievalMethod: "facebook_graph",
    });
    if (created.kind === "not_found") throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    if (created.kind === "connection_required") throw new ApiError(API_ERROR_CODES.competitorFacebookConnectionRequired, HTTP_STATUS.conflict);
    if (created.kind === "duplicate") throw new ApiError(API_ERROR_CODES.competitorSourceExists, HTTP_STATUS.conflict);
    if (created.kind === "limit_reached") throw new ApiError(API_ERROR_CODES.competitorSourceLimitReached, HTTP_STATUS.conflict);
    return NextResponse.json({ data: { id: created.id } }, { status: HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
