import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { approveBrandKitVersion } from "@/lib/db/repositories/brand-kits";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginRequest, requireTenant } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ brandId: string; versionId: string }> };
const resourceIdSchema = z.string().uuid();

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginRequest(request);
    const { brandId, versionId } = await params;
    if (!resourceIdSchema.safeParse(brandId).success || !resourceIdSchema.safeParse(versionId).success) {
      throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    }

    const version = await approveBrandKitVersion(tenant.organizationId, brandId, versionId, tenant.userId);
    if (!version) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);

    return NextResponse.json({ data: version }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
