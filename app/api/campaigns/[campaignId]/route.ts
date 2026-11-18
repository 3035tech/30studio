import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { updateCalendarCampaignPeriod } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { calendarCampaignPeriodUpdateResponseSchema, calendarCampaignPeriodUpdateSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentManage);
    assertSameOriginJsonRequest(request);
    const { campaignId } = await context.params;
    if (!z.uuid().safeParse(campaignId).success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }
    const parsed = calendarCampaignPeriodUpdateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const result = await updateCalendarCampaignPeriod(tenant.organizationId, campaignId, parsed.data);
    if (result.kind === "not_found") throw new ApiError(API_ERROR_CODES.campaignNotFound, HTTP_STATUS.notFound);
    if (result.kind === "conflict") throw new ApiError(API_ERROR_CODES.campaignPeriodConflict, HTTP_STATUS.conflict);
    const response = calendarCampaignPeriodUpdateResponseSchema.safeParse({ data: {
      startDate: result.startDate,
      endDate: result.endDate,
    } });
    if (!response.success) throw new ApiError(API_ERROR_CODES.internalError, HTTP_STATUS.internalError);
    return NextResponse.json(response.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
