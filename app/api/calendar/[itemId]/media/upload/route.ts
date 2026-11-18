import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, CONTENT_MEDIA_STATUS, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createContentMediaUpload, removePendingContentMediaUpload } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { assertBrandAssetStorageConfigured, createBrandAssetUpload } from "@/lib/server/brand-asset-storage";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { logOperationalError } from "@/lib/server/operational-logger";
import { contentMediaUploadRequestSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ itemId: string }> };
const idSchema = z.uuid();

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentManage);
    assertSameOriginJsonRequest(request);
    const { itemId } = await params;
    if (!idSchema.safeParse(itemId).success) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = contentMediaUploadRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    assertBrandAssetStorageConfigured();

    const result = await createContentMediaUpload({
      ...parsed.data,
      organizationId: tenant.organizationId,
      itemId,
      userId: tenant.userId,
    });
    if (result.kind === "not_found") throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    if (result.kind === "conflict") throw new ApiError(API_ERROR_CODES.contentMediaConflict, HTTP_STATUS.conflict);
    if (result.kind === "limit") throw new ApiError(API_ERROR_CODES.contentMediaLimitReached, HTTP_STATUS.conflict);
    if (result.kind === "existing") throw new ApiError(API_ERROR_CODES.contentMediaConflict, HTTP_STATUS.conflict);

    try {
      const upload = await createBrandAssetUpload(parsed.data, result.objectKey);
      return NextResponse.json({ data: { id: result.id, status: CONTENT_MEDIA_STATUS.processing, upload } }, {
        status: HTTP_STATUS.created,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      logOperationalError("storage.content_media.upload.presign_failed", error, { organizationId: tenant.organizationId, itemId });
      await removePendingContentMediaUpload(tenant.organizationId, itemId, result.id).catch(() => undefined);
      throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
    }
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
