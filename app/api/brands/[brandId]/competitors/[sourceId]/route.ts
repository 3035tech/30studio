import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { updateCompetitorSourceStatus } from "@/lib/db/repositories/competitors";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { competitorBrandIdSchema, competitorSourceUpdateSchema } from "@/lib/validation/competitors";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ brandId: string; sourceId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.competitorResearchManage);
    assertSameOriginJsonRequest(request);
    const { brandId, sourceId } = await params;
    if (!competitorBrandIdSchema.safeParse(brandId).success || !competitorBrandIdSchema.safeParse(sourceId).success) {
      throw new ApiError(API_ERROR_CODES.competitorSourceNotFound, HTTP_STATUS.notFound);
    }
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = competitorSourceUpdateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const updated = await updateCompetitorSourceStatus(tenant.organizationId, brandId, sourceId, parsed.data.status);
    if (!updated) throw new ApiError(API_ERROR_CODES.competitorSourceNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: { updated: true } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
