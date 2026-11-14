import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS } from "@/lib/constants";
import { createBrand, listBrands } from "@/lib/db/repositories/brands";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { brandCreateSchema } from "@/lib/validation/brands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, "brands:read");
    const brands = await listBrands(tenant.organizationId);
    return NextResponse.json({ data: brands }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, "brands:manage");
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
      { data: { ...brand, socialProfiles: [] } },
      { status: HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
