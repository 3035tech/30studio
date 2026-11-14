import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, BRAND_ASSET_STATUS, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { completeBrandAssetUpload, getBrandAssetForTenant, removePendingBrandAsset } from "@/lib/db/repositories/brand-assets";
import { ApiError } from "@/lib/server/api-error";
import { deleteBrandAssetObject, storeVerifiedBrandAsset, verifyBrandAssetUpload, type VerifiedBrandImage } from "@/lib/server/brand-asset-storage";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { brandAssetUploadSchema } from "@/lib/validation/brand-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ brandId: string; assetId: string }> };
const idSchema = z.string().uuid();

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginJsonRequest(request);
    const { brandId, assetId } = await params;
    if (!idSchema.safeParse(brandId).success || !idSchema.safeParse(assetId).success) {
      throw new ApiError(API_ERROR_CODES.brandAssetNotFound, HTTP_STATUS.notFound);
    }
    const asset = await getBrandAssetForTenant(tenant.organizationId, brandId, assetId);
    if (!asset) throw new ApiError(API_ERROR_CODES.brandAssetNotFound, HTTP_STATUS.notFound);
    if (asset.status !== BRAND_ASSET_STATUS.uploadPending) {
      return NextResponse.json({ data: { id: asset.id, status: asset.status } }, { headers: { "Cache-Control": "no-store" } });
    }

    const storageInput = brandAssetUploadSchema.pick({ contentType: true, sha256: true, sizeBytes: true }).safeParse(asset);
    if (!storageInput.success) {
      await deleteBrandAssetObject(asset.uploadKey).catch(() => undefined);
      await removePendingBrandAsset(tenant.organizationId, brandId, assetId);
      throw new ApiError(API_ERROR_CODES.brandAssetInvalid, HTTP_STATUS.unprocessable);
    }
    let verified: VerifiedBrandImage;
    try {
      verified = await verifyBrandAssetUpload(storageInput.data, asset.uploadKey);
    } catch (error) {
      if (error instanceof ApiError && error.code === API_ERROR_CODES.brandAssetInvalid) {
        await deleteBrandAssetObject(asset.uploadKey).catch(() => undefined);
        await removePendingBrandAsset(tenant.organizationId, brandId, assetId);
      }
      throw error;
    }
    await storeVerifiedBrandAsset(storageInput.data, asset.objectKey, verified.bytes);
    const completed = await completeBrandAssetUpload(tenant.organizationId, brandId, assetId, verified.width, verified.height);
    if (!completed) throw new ApiError(API_ERROR_CODES.brandAssetStateConflict, HTTP_STATUS.conflict);
    await deleteBrandAssetObject(asset.uploadKey).catch(() => undefined);
    return NextResponse.json({ data: { id: assetId, status: BRAND_ASSET_STATUS.pendingReview, width: verified.width, height: verified.height } }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
