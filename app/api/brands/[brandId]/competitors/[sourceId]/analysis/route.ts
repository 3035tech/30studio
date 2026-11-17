import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { retryUnavailableCompetitorAnalysis } from "@/lib/db/repositories/competitors";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { competitorBrandIdSchema } from "@/lib/validation/competitors";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ brandId: string; sourceId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.competitorResearchManage);
    assertSameOriginJsonRequest(request);
    const { brandId, sourceId } = await params;
    if (!competitorBrandIdSchema.safeParse(brandId).success || !competitorBrandIdSchema.safeParse(sourceId).success) {
      throw new ApiError(API_ERROR_CODES.competitorSourceNotFound, HTTP_STATUS.notFound);
    }
    const retried = await retryUnavailableCompetitorAnalysis(tenant.organizationId, brandId, sourceId);
    return NextResponse.json({ data: { retried } }, { status: HTTP_STATUS.accepted, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error, request); }
}
