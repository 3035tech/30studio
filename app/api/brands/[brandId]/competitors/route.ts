import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createCompetitorSource, listCompetitorSources } from "@/lib/db/repositories/competitors";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { hasTenantPermission } from "@/lib/server/permissions";
import { competitorBrandIdSchema, competitorSourceCreateSchema, competitorSourcesResponseSchema } from "@/lib/validation/competitors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.competitorResearchRead);
    const { brandId } = await params;
    if (!competitorBrandIdSchema.safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    const result = await listCompetitorSources(tenant.organizationId, brandId);
    if (!result) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    const response = competitorSourcesResponseSchema.safeParse({
      data: { ...result, canManage: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.competitorResearchManage) },
    });
    if (!response.success) throw new ApiError(API_ERROR_CODES.internalError, HTTP_STATUS.internalError);
    return NextResponse.json(response.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.competitorResearchManage);
    assertSameOriginJsonRequest(request);
    const { brandId } = await params;
    if (!competitorBrandIdSchema.safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = competitorSourceCreateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const result = await createCompetitorSource(tenant.organizationId, brandId, tenant.userId, parsed.data);
    if (result.kind === "not_found") throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    if (result.kind === "duplicate") throw new ApiError(API_ERROR_CODES.competitorSourceExists, HTTP_STATUS.conflict);
    if (result.kind === "limit_reached") throw new ApiError(API_ERROR_CODES.competitorSourceLimitReached, HTTP_STATUS.conflict);
    return NextResponse.json({ data: { id: result.id } }, { status: HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
