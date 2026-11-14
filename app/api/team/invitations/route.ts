import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS, TENANT_ROLE } from "@/lib/constants";
import { hasPendingInvitationForEmail, hasTeamMemberWithEmail, listTeamInvitations } from "@/lib/db/repositories/team";
import { getAuth } from "@/lib/server/better-auth";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { isEmailDeliveryConfigured } from "@/lib/server/email";
import { hasTenantPermission } from "@/lib/server/permissions";
import { ApiError } from "@/lib/server/api-error";
import { teamInvitationCreateSchema } from "@/lib/validation/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request);
    const canManage = hasTenantPermission(tenant.role, TENANT_PERMISSIONS.membersManage);
    const data = canManage ? await listTeamInvitations(tenant.organizationId) : [];
    return NextResponse.json({ data, canManage, actorRole: tenant.role }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.membersManage);
    assertSameOriginJsonRequest(request);
    if (!isEmailDeliveryConfigured()) {
      throw new ApiError(API_ERROR_CODES.invitationDeliveryUnavailable, HTTP_STATUS.unavailable);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }

    const parsed = teamInvitationCreateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    if (tenant.role === TENANT_ROLE.admin && parsed.data.role === TENANT_ROLE.admin) {
      throw new ApiError(API_ERROR_CODES.teamOperationNotAllowed, HTTP_STATUS.forbidden);
    }
    if (await hasTeamMemberWithEmail(tenant.organizationId, parsed.data.email)) {
      throw new ApiError(API_ERROR_CODES.invitationAlreadyExists, HTTP_STATUS.conflict);
    }
    if (await hasPendingInvitationForEmail(tenant.organizationId, parsed.data.email)) {
      throw new ApiError(API_ERROR_CODES.invitationAlreadyExists, HTTP_STATUS.conflict);
    }

    const invitation = await getAuth().api.createInvitation({
      headers: request.headers,
      body: {
        email: parsed.data.email,
        role: parsed.data.role,
        organizationId: tenant.organizationId,
      },
    });

    return NextResponse.json({ data: invitation }, {
      status: HTTP_STATUS.created,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
