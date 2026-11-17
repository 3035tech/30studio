import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { archiveBrand, updateBrand } from "@/lib/db/repositories/brands";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, assertSameOriginRequest, requireTenant } from "@/lib/server/auth";
import { brandUpdateSchema } from "@/lib/validation/brands";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ brandId: string }> };
const brandIdSchema = z.string().uuid();

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginJsonRequest(request);
    const { brandId } = await context.params;
    if (!brandIdSchema.safeParse(brandId).success) {
      throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }

    const parsed = brandUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    }

    const brand = await updateBrand(brandId, parsed.data, tenant.organizationId);
    if (!brand) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);

    return NextResponse.json({ data: brand }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginRequest(request);
    const { brandId } = await context.params;
    if (!brandIdSchema.safeParse(brandId).success) {
      throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    }

    const archived = await archiveBrand(brandId, tenant.organizationId);
    if (!archived) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);

    return new NextResponse(null, { status: HTTP_STATUS.ok, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
