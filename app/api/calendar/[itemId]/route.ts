import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { updateCalendarIdea } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { calendarItemUpdateSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };
const itemIdSchema = z.uuid();

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentManage);
    assertSameOriginJsonRequest(request);
    const { itemId } = await context.params;
    if (!itemIdSchema.safeParse(itemId).success) {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.notFound);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }
    const parsed = calendarItemUpdateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const item = await updateCalendarIdea(tenant.organizationId, itemId, parsed.data);
    if (!item) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    if ("kind" in item && item.kind === "period_conflict") throw new ApiError(API_ERROR_CODES.campaignScheduleOutsidePeriod, HTTP_STATUS.unprocessable);
    return NextResponse.json({ data: item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
