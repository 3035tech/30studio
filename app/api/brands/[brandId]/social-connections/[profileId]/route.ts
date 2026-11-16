import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { disconnectSocialProfile } from "@/lib/db/repositories/social-connections";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { z } from "zod";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ brandId: string; profileId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginJsonRequest(request);
    const { brandId, profileId } = await context.params;
    if (!z.string().uuid().safeParse(profileId).success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const disconnected = await disconnectSocialProfile(tenant.organizationId, brandId, profileId, tenant.userId);
    if (!disconnected) throw new ApiError(API_ERROR_CODES.socialConnectionNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: { disconnected: true } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
