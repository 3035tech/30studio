import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createCalendarCampaign } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { calendarCampaignCreateSchema, calendarCampaignCreateResponseSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const parsed = calendarCampaignCreateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const campaign = await createCalendarCampaign(tenant.organizationId, tenant.userId, parsed.data);
    if (!campaign) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    if (campaign.kind === "conflict") throw new ApiError(API_ERROR_CODES.campaignIdempotencyConflict, HTTP_STATUS.conflict);
    const response = calendarCampaignCreateResponseSchema.safeParse({ data: {
      campaignId: campaign.campaignId,
      publications: campaign.publications,
      replayed: campaign.replayed,
    } });
    if (!response.success) throw new ApiError(API_ERROR_CODES.internalError, HTTP_STATUS.internalError);
    return NextResponse.json(response.data, { status: campaign.replayed ? HTTP_STATUS.ok : HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
