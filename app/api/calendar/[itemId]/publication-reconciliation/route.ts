import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { reconcileSocialPublication } from "@/lib/db/repositories/social-publications";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { socialPublicationReconciliationRequestSchema } from "@/lib/validation/social-publication";

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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }
    const parsed = socialPublicationReconciliationRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const result = await reconcileSocialPublication(tenant.organizationId, tenant.userId, itemId, parsed.data);
    if (result.kind === "retry_limit_reached") throw new ApiError(API_ERROR_CODES.socialPublicationRetryLimitReached, HTTP_STATUS.conflict);
    if (result.kind === "conflict") throw new ApiError(API_ERROR_CODES.socialPublicationReconciliationConflict, HTTP_STATUS.conflict);
    return NextResponse.json({ data: {
      outcome: result.outcome,
      publicationStatus: result.publicationStatus,
      itemStatus: result.itemStatus,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
