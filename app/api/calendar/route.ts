import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, CALENDAR_QUERY_PARAMETERS, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createCalendarIdea, listCalendarItems } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { hasTenantPermission } from "@/lib/server/permissions";
import { calendarItemCreateSchema, calendarQuerySchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentRead);
    const searchParams = request.nextUrl.searchParams;
    const parsed = calendarQuerySchema.safeParse({
      start: searchParams.get(CALENDAR_QUERY_PARAMETERS.start),
      end: searchParams.get(CALENDAR_QUERY_PARAMETERS.end),
      brandId: searchParams.get(CALENDAR_QUERY_PARAMETERS.brandId) ?? undefined,
      platform: searchParams.get(CALENDAR_QUERY_PARAMETERS.platform) ?? undefined,
      status: searchParams.get(CALENDAR_QUERY_PARAMETERS.status) ?? undefined,
      publicationStatus: searchParams.get(CALENDAR_QUERY_PARAMETERS.publicationStatus) ?? undefined,
    });
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const result = await listCalendarItems(tenant.organizationId, {
      ...parsed.data,
      start: new Date(parsed.data.start),
      end: new Date(parsed.data.end),
    });
    return NextResponse.json({
      data: result.data.map((item) => ({
        ...item,
        plannedAt: item.plannedAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
      })),
      truncated: result.truncated,
      canManage: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.contentManage),
      canReview: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.contentApprove),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentManage);
    assertSameOriginJsonRequest(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }
    const parsed = calendarItemCreateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const item = await createCalendarIdea(tenant.organizationId, tenant.userId, parsed.data);
    if (!item) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: item }, { status: HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
