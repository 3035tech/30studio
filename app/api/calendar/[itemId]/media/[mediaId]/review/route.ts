import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, CONTENT_MEDIA_STATUS, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { reviewContentMedia } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { contentMediaReviewSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string; mediaId: string }> };
const idSchema = z.uuid();

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentApprove);
    assertSameOriginJsonRequest(request);
    const { itemId, mediaId } = await context.params;
    if (!idSchema.safeParse(itemId).success || !idSchema.safeParse(mediaId).success) {
      throw new ApiError(API_ERROR_CODES.contentMediaNotFound, HTTP_STATUS.notFound);
    }
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = contentMediaReviewSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const review = await reviewContentMedia(tenant.organizationId, itemId, mediaId, tenant.userId, parsed.data.decision, parsed.data.note);
    if (!review) throw new ApiError(API_ERROR_CODES.contentMediaNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: { id: review.id, status: parsed.data.decision === CONTENT_MEDIA_STATUS.approved ? CONTENT_MEDIA_STATUS.approved : CONTENT_MEDIA_STATUS.rejected } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
