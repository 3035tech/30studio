import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createBrandKitVersion, listBrandKitVersions } from "@/lib/db/repositories/brand-kits";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { hasTenantPermission } from "@/lib/server/permissions";
import { brandKitVersionCreateSchema } from "@/lib/validation/brand-kits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ brandId: string }> };
const brandIdSchema = z.string().uuid();

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsRead);
    const { brandId } = await params;
    if (!brandIdSchema.safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    const versions = await listBrandKitVersions(tenant.organizationId, brandId);
    if (!versions) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: versions, canManage: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.brandsManage) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginJsonRequest(request);
    const { brandId } = await params;
    if (!brandIdSchema.safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }

    const parsed = brandKitVersionCreateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const version = await createBrandKitVersion(tenant.organizationId, brandId, tenant.userId, parsed.data);
    if (!version) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);

    return NextResponse.json({ data: version }, { status: HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
