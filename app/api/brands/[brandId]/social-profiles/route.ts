import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { createSocialProfile } from "@/lib/db/repositories/social-profiles";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { socialProfileCreateSchema } from "@/lib/validation/social-profiles";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginJsonRequest(request);
    const { brandId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }

    const parsed = socialProfileCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    }

    const result = await createSocialProfile(tenant.organizationId, brandId, parsed.data);
    if (result.kind === "missing_brand") {
      throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    }
    if (result.kind === "duplicate") {
      throw new ApiError(API_ERROR_CODES.profileExists, HTTP_STATUS.conflict);
    }

    return NextResponse.json(
      { data: result.profile },
      { status: HTTP_STATUS.created, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
