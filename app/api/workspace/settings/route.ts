import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { getOrganizationSettings } from "@/lib/db/repositories/organizations";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { getAuth } from "@/lib/server/better-auth";
import { hasTenantPermission } from "@/lib/server/permissions";
import { workspaceNameUpdateSchema } from "@/lib/validation/workspace-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request);
    const settings = await getOrganizationSettings(tenant.organizationId);
    if (!settings) throw new ApiError(API_ERROR_CODES.organizationNotFound, HTTP_STATUS.notFound);

    return NextResponse.json({ data: settings, canManage: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.organizationManage) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireTenant(request, TENANT_PERMISSIONS.organizationManage);
    assertSameOriginJsonRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }

    const parsed = workspaceNameUpdateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const updated = await getAuth().api.updateOrganization({
      headers: request.headers,
      body: { data: { name: parsed.data.name } },
    });
    if (!updated) throw new ApiError(API_ERROR_CODES.organizationNotFound, HTTP_STATUS.notFound);

    return NextResponse.json({ data: { id: updated.id, name: updated.name, slug: updated.slug }, canManage: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
