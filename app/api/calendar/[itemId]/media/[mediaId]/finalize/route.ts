import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, CONTENT_MEDIA_STATUS, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { completeContentMediaUpload, getPendingContentMediaUpload, removePendingContentMediaUpload } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { deleteBrandAssetObject, storeVerifiedBrandAsset, verifyBrandAssetUpload } from "@/lib/server/brand-asset-storage";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { contentMediaUploadRequestSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ itemId: string; mediaId: string }> };
const idSchema = z.uuid();

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentManage);
    assertSameOriginJsonRequest(request);
    const { itemId, mediaId } = await params;
    if (!idSchema.safeParse(itemId).success || !idSchema.safeParse(mediaId).success) {
      throw new ApiError(API_ERROR_CODES.contentMediaNotFound, HTTP_STATUS.notFound);
    }
    const asset = await getPendingContentMediaUpload(tenant.organizationId, itemId, mediaId);
    if (!asset) throw new ApiError(API_ERROR_CODES.contentMediaNotFound, HTTP_STATUS.notFound);
    const parsed = contentMediaUploadRequestSchema.pick({ fileName: true, contentType: true, sizeBytes: true, sha256: true }).safeParse({
      fileName: asset.fileName,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      sha256: asset.sha256,
    });
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.brandAssetInvalid, HTTP_STATUS.unprocessable);

    let verified;
    try {
      verified = await verifyBrandAssetUpload(parsed.data, asset.objectKey);
    } catch (error) {
      if (error instanceof ApiError && error.code === API_ERROR_CODES.brandAssetInvalid) {
        await deleteBrandAssetObject(asset.objectKey).catch(() => undefined);
        await removePendingContentMediaUpload(tenant.organizationId, itemId, mediaId);
      }
      throw error;
    }

    const objectKey = `tenants/${encodeURIComponent(tenant.organizationId)}/brands/${asset.brandId}/content/${itemId}/${asset.contentVersionId}/${mediaId}`;
    await storeVerifiedBrandAsset(parsed.data, objectKey, verified.bytes);
    const completed = await completeContentMediaUpload(tenant.organizationId, itemId, mediaId, objectKey, verified.width, verified.height);
    if (!completed) {
      await deleteBrandAssetObject(objectKey).catch(() => undefined);
      throw new ApiError(API_ERROR_CODES.contentMediaConflict, HTTP_STATUS.conflict);
    }
    await deleteBrandAssetObject(asset.objectKey).catch(() => undefined);
    return NextResponse.json({ data: { id: mediaId, status: CONTENT_MEDIA_STATUS.pendingReview, width: verified.width, height: verified.height } }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
