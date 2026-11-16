import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { getPublicationAnalytics } from "@/lib/db/repositories/analytics";
import { getDashboardPublicationGoals } from "@/lib/db/repositories/dashboard-goals";
import { getSocialPublicationWorkerHealth } from "@/lib/db/repositories/social-publication-health";
import { getLatestMetaAnalytics } from "@/lib/db/repositories/social-analytics";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { hasTenantPermission } from "@/lib/server/permissions";
import { refreshMetaEngagement } from "@/lib/server/social-analytics/collection";
import { analyticsQuerySchema, analyticsRefreshRequestSchema, analyticsRefreshResponseSchema } from "@/lib/validation/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.analyticsRead);
    const searchParams = request.nextUrl.searchParams;
    const parsed = analyticsQuerySchema.safeParse({
      start: searchParams.get("start"),
      end: searchParams.get("end"),
      brandId: searchParams.get("brandId") ?? undefined,
      platform: searchParams.get("platform") ?? undefined,
    });
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const data = await getPublicationAnalytics(tenant.organizationId, {
      start: new Date(parsed.data.start), end: new Date(parsed.data.end), brandId: parsed.data.brandId, platform: parsed.data.platform,
    });
    const engagement = await getLatestMetaAnalytics(tenant.organizationId, {
      start: new Date(parsed.data.start), end: new Date(parsed.data.end), brandId: parsed.data.brandId, platform: parsed.data.platform,
    });
    const goalTargets = await getDashboardPublicationGoals(tenant.organizationId, parsed.data.brandId);
    const worker = await getSocialPublicationWorkerHealth(tenant.organizationId, parsed.data);
    return NextResponse.json({ data: {
      ...data, engagement, goalTargets,
      worker,
      canManageGoals: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.contentManage),
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.analyticsRead);
    assertSameOriginJsonRequest(request);
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = analyticsRefreshRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const data = await refreshMetaEngagement(tenant.organizationId, parsed.data);
    const result = analyticsRefreshResponseSchema.safeParse({ data });
    if (!result.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.internalError);
    return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
