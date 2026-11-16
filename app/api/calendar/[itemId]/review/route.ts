import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { getCalendarContentReviewContext } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { reviewCalendarContent } from "@/lib/server/content-review";
import { contentReviewRequestSchema, contentReviewResponseSchema } from "@/lib/validation/content-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };
const itemIdSchema = z.uuid();

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertSameOriginJsonRequest(request);
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentManage);
    const { itemId } = await context.params;
    if (!itemIdSchema.safeParse(itemId).success) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    const body: unknown = await request.json().catch(() => null);
    const parsed = contentReviewRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const contextData = await getCalendarContentReviewContext(tenant.organizationId, itemId);
    if (!contextData) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    const review = await reviewCalendarContent(contextData, parsed.data.locale);
    if (!review) throw new ApiError(API_ERROR_CODES.aiServiceUnavailable, HTTP_STATUS.unavailable);
    const response = contentReviewResponseSchema.safeParse({
      data: {
        contentVersionId: contextData.version.id,
        versionNumber: contextData.version.versionNumber,
        model: review.model,
        findings: review.findings,
      },
    });
    if (!response.success) throw new ApiError(API_ERROR_CODES.internalError, HTTP_STATUS.internalError);
    return NextResponse.json(response.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
