import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { getBrandAssetForTenant } from "@/lib/db/repositories/brand-assets";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { logOperationalError } from "@/lib/server/operational-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ brandId: string; assetId: string }> };
const uuidSchema = z.string().uuid();
const uploadFailureSchema = z.object({
  failure: z.enum(["network", "storage_rejected"]),
  status: z.number().int().min(400).max(599).nullable(),
}).strict();

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    assertSameOriginJsonRequest(request);
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    const { brandId, assetId } = await params;
    if (!uuidSchema.safeParse(brandId).success || !uuidSchema.safeParse(assetId).success) {
      throw new ApiError(API_ERROR_CODES.brandAssetNotFound, HTTP_STATUS.notFound);
    }
    const asset = await getBrandAssetForTenant(tenant.organizationId, brandId, assetId);
    if (!asset) throw new ApiError(API_ERROR_CODES.brandAssetNotFound, HTTP_STATUS.notFound);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = uploadFailureSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    logOperationalError("storage.brand_asset.upload.browser_failed", new Error(parsed.data.failure), {
      organizationId: tenant.organizationId,
      brandId,
      assetId,
      uploadStage: "presigned_post",
      storageStatus: parsed.data.status,
    });
    return NextResponse.json({ data: { recorded: true } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
