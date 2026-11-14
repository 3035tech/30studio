import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, BRAND_ASSET_STATUS, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createPendingBrandAsset, listBrandAssets, removePendingBrandAsset } from "@/lib/db/repositories/brand-assets";
import { ApiError } from "@/lib/server/api-error";
import { createBrandAssetUpload } from "@/lib/server/brand-asset-storage";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { hasTenantPermission } from "@/lib/server/permissions";
import { brandAssetUploadSchema } from "@/lib/validation/brand-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ brandId: string }> };
const brandIdSchema = z.string().uuid();

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsRead);
    const { brandId } = await params;
    if (!brandIdSchema.safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    const canManage = hasTenantPermission(tenant.role, TENANT_PERMISSIONS.brandsManage);
    const assets = await listBrandAssets(tenant.organizationId, brandId, canManage);
    if (!assets) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: assets, canManage }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginJsonRequest(request);
    const { brandId } = await params;
    if (!brandIdSchema.safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);

    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = brandAssetUploadSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const assetId = randomUUID();
    const objectKey = `tenants/${encodeURIComponent(tenant.organizationId)}/brands/${brandId}/assets/${assetId}`;
    const uploadKey = `staging/tenants/${encodeURIComponent(tenant.organizationId)}/brands/${brandId}/assets/${assetId}`;
    const created = await createPendingBrandAsset(tenant.organizationId, brandId, tenant.userId, assetId, objectKey, uploadKey, parsed.data);
    if (!created) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    try {
      const upload = await createBrandAssetUpload(parsed.data, created.uploadKey);
      return NextResponse.json({ data: { id: created.id, status: BRAND_ASSET_STATUS.uploadPending, upload } }, {
        status: HTTP_STATUS.created,
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      await removePendingBrandAsset(tenant.organizationId, brandId, assetId).catch(() => undefined);
      throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
