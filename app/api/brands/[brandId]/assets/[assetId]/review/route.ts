import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { reviewBrandAsset } from "@/lib/db/repositories/brand-assets";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { brandAssetReviewSchema } from "@/lib/validation/brand-assets";

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
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = brandAssetReviewSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const asset = await reviewBrandAsset(tenant.organizationId, brandId, assetId, tenant.userId, parsed.data.decision, parsed.data.note);
    if (!asset) throw new ApiError(API_ERROR_CODES.brandAssetStateConflict, HTTP_STATUS.conflict);
    return NextResponse.json({ data: asset }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
