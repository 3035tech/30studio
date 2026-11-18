import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { appendCalendarCampaignPublication, getCalendarCampaignSchedule } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { calendarCampaignPublicationAppendResponseSchema, calendarCampaignPublicationAppendSchema, calendarCampaignScheduleResponseSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentRead);
    const { campaignId } = await context.params;
    if (!z.uuid().safeParse(campaignId).success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const schedule = await getCalendarCampaignSchedule(tenant.organizationId, campaignId);
    if (!schedule) throw new ApiError(API_ERROR_CODES.campaignNotFound, HTTP_STATUS.notFound);
    const response = calendarCampaignScheduleResponseSchema.safeParse({ data: {
      ...schedule,
      publications: schedule.publications.map((publication) => ({ ...publication, plannedAt: publication.plannedAt.toISOString(), createdAt: publication.createdAt.toISOString() })),
    } });
    if (!response.success) throw new ApiError(API_ERROR_CODES.internalError, HTTP_STATUS.internalError);
    return NextResponse.json(response.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
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
    const parsed = calendarCampaignPublicationAppendSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const result = await appendCalendarCampaignPublication(tenant.organizationId, tenant.userId, campaignId, parsed.data);
    if (result.kind === "not_found") throw new ApiError(API_ERROR_CODES.campaignNotFound, HTTP_STATUS.notFound);
    if (result.kind === "outside_period") throw new ApiError(API_ERROR_CODES.campaignScheduleOutsidePeriod, HTTP_STATUS.unprocessable);
    if (result.kind === "limit_reached") throw new ApiError(API_ERROR_CODES.campaignPublicationLimitReached, HTTP_STATUS.conflict);
    if (result.kind === "conflict") throw new ApiError(API_ERROR_CODES.campaignIdempotencyConflict, HTTP_STATUS.conflict);
    const response = calendarCampaignPublicationAppendResponseSchema.safeParse({ data: {
      id: result.id,
      platform: result.platform,
      plannedAt: result.plannedAt.toISOString(),
      replayed: result.replayed,
    } });
    if (!response.success) throw new ApiError(API_ERROR_CODES.internalError, HTTP_STATUS.internalError);
    return NextResponse.json(response.data, { status: result.replayed ? HTTP_STATUS.ok : HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
