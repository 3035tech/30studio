import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { saveDashboardPublicationGoal } from "@/lib/db/repositories/dashboard-goals";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { dashboardPublicationGoalSchema } from "@/lib/validation/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentManage);
    assertSameOriginJsonRequest(request);
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = dashboardPublicationGoalSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const updated = await saveDashboardPublicationGoal(tenant.organizationId, parsed.data.brandId, parsed.data.platform, parsed.data.monthlyTarget, tenant.userId);
    if (!updated) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: { saved: true } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error, request); }
}
