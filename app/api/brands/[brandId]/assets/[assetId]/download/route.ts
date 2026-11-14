import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, BRAND_ASSET_LIMITS, BRAND_ASSET_STATUS, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { getBrandAssetForTenant } from "@/lib/db/repositories/brand-assets";
import { ApiError } from "@/lib/server/api-error";
import { createBrandAssetDownload } from "@/lib/server/brand-asset-storage";
import { apiErrorResponse } from "@/lib/server/api-response";
import { requireTenant } from "@/lib/server/auth";
import { hasTenantPermission } from "@/lib/server/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ brandId: string; assetId: string }> };
const idSchema = z.string().uuid();

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsRead);
    const { brandId, assetId } = await params;
    if (!idSchema.safeParse(brandId).success || !idSchema.safeParse(assetId).success) {
      throw new ApiError(API_ERROR_CODES.brandAssetNotFound, HTTP_STATUS.notFound);
    }
    const asset = await getBrandAssetForTenant(tenant.organizationId, brandId, assetId);
    if (!asset) throw new ApiError(API_ERROR_CODES.brandAssetNotFound, HTTP_STATUS.notFound);
    const canManage = hasTenantPermission(tenant.role, TENANT_PERMISSIONS.brandsManage);
    if (asset.status !== BRAND_ASSET_STATUS.approved && !canManage) {
      throw new ApiError(API_ERROR_CODES.brandAssetNotFound, HTTP_STATUS.notFound);
    }
    let url: string;
    try {
      url = await createBrandAssetDownload(asset.objectKey, asset.fileName, asset.contentType);
    } catch {
      throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
    }
    return NextResponse.json({ data: { url, expiresInSeconds: BRAND_ASSET_LIMITS.downloadExpirySeconds } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
