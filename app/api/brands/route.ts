import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createBrand, listBrands } from "@/lib/db/repositories/brands";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { hasTenantPermission } from "@/lib/server/permissions";
import { brandCreateSchema } from "@/lib/validation/brands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsRead);
    const canManage = hasTenantPermission(tenant.role, TENANT_PERMISSIONS.brandsManage);
    const brands = await listBrands(tenant.organizationId, canManage);
    return NextResponse.json({ data: brands, canManage }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginJsonRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }

    const parsed = brandCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    }

    const brand = await createBrand(parsed.data, tenant.organizationId, tenant.userId);
    if (!brand) throw new ApiError(API_ERROR_CODES.brandExists, HTTP_STATUS.conflict);

    return NextResponse.json(
      { data: { ...brand, logoAssetId: null, logoAssetStatus: null, socialProfiles: [], brandKitStatus: null } },
      { status: HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
