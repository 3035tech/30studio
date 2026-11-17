import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { removeTeamMember, updateTeamMemberRole } from "@/lib/db/repositories/team";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, assertSameOriginRequest, requireTenant } from "@/lib/server/auth";
import { teamMemberRoleUpdateSchema } from "@/lib/validation/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ memberId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.membersManage);
    assertSameOriginJsonRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }

    const parsed = teamMemberRoleUpdateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const { memberId } = await params;
    const updated = await updateTeamMemberRole(tenant.organizationId, tenant.userId, memberId, parsed.data.role);
    if (!updated) throw new ApiError(API_ERROR_CODES.teamMemberNotFound, HTTP_STATUS.notFound);

    return NextResponse.json({ data: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.membersManage);
    assertSameOriginRequest(request);
    const { memberId } = await params;
    const removed = await removeTeamMember(tenant.organizationId, tenant.userId, memberId);
    if (!removed) throw new ApiError(API_ERROR_CODES.teamMemberNotFound, HTTP_STATUS.notFound);

    return new NextResponse(null, { status: HTTP_STATUS.ok, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
