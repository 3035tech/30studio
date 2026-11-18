import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createCalendarContentVersion, getCalendarContentVersions } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { hasTenantPermission } from "@/lib/server/permissions";
import { getSocialPublisher } from "@/lib/server/social-publisher/registry";
import { exceedsSocialCopyLimit } from "@/lib/social-copy";
import { calendarContentVersionSaveSchema, calendarContentVersionResponseSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };
const itemIdSchema = z.uuid();

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentRead);
    const { itemId } = await context.params;
    if (!itemIdSchema.safeParse(itemId).success) {
      throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    }
    const versions = await getCalendarContentVersions(tenant.organizationId, itemId);
    if (!versions) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    const parsed = calendarContentVersionResponseSchema.safeParse({
      data: versions,
      canManage: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.contentManage),
      canReview: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.contentApprove)
        && !versions.approval?.history.some((entry) => entry.matchesCurrent && entry.submittedBy === tenant.userId),
    });
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.internalError, HTTP_STATUS.internalError);
    return NextResponse.json(parsed.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentManage);
    assertSameOriginJsonRequest(request);
    const { itemId } = await context.params;
    if (!itemIdSchema.safeParse(itemId).success) {
      throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }
    const parsed = calendarContentVersionSaveSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const maximumTextCharacters = getSocialPublisher(parsed.data.platform)?.maximumTextCharacters;
    if (exceedsSocialCopyLimit(parsed.data.variantCopy, maximumTextCharacters)) {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    }

    const version = await createCalendarContentVersion(tenant.organizationId, tenant.userId, itemId, parsed.data);
    if (!version) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    if (version.kind === "conflict") throw new ApiError(API_ERROR_CODES.contentVersionConflict, HTTP_STATUS.conflict);
    if (version.kind === "period_conflict") throw new ApiError(API_ERROR_CODES.campaignScheduleOutsidePeriod, HTTP_STATUS.unprocessable);
    return NextResponse.json({ data: version }, { status: HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
