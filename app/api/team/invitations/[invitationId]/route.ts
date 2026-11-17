import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, INVITATION_STATUS, TEAM_AUDIT_ACTIONS, TENANT_PERMISSIONS } from "@/lib/constants";
import { getTeamInvitation, recordTeamAuditEvent } from "@/lib/db/repositories/team";
import { getAuth } from "@/lib/server/better-auth";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginRequest, requireTenant } from "@/lib/server/auth";
import { isEmailDeliveryConfigured } from "@/lib/server/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ invitationId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.membersManage);
    assertSameOriginRequest(request);
    if (!isEmailDeliveryConfigured()) {
      throw new ApiError(API_ERROR_CODES.invitationDeliveryUnavailable, HTTP_STATUS.unavailable);
    }

    const { invitationId } = await params;
    const existing = await getTeamInvitation(tenant.organizationId, invitationId);
    if (!existing || existing.status !== INVITATION_STATUS.pending) {
      throw new ApiError(API_ERROR_CODES.invitationNotFound, HTTP_STATUS.notFound);
    }

    const resent = await getAuth().api.createInvitation({
      headers: request.headers,
      body: {
        email: existing.email,
        role: existing.role,
        organizationId: tenant.organizationId,
        resend: true,
      },
    });
    await recordTeamAuditEvent({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      targetEmail: existing.email,
      invitationId: resent.id,
      action: TEAM_AUDIT_ACTIONS.invitationResent,
      previousRole: existing.role,
      newRole: existing.role,
    });

    return NextResponse.json({ data: resent }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.membersManage);
    assertSameOriginRequest(request);
    const { invitationId } = await params;
    const existing = await getTeamInvitation(tenant.organizationId, invitationId);
    if (!existing || existing.status !== INVITATION_STATUS.pending) {
      throw new ApiError(API_ERROR_CODES.invitationNotFound, HTTP_STATUS.notFound);
    }

    await getAuth().api.cancelInvitation({
      headers: request.headers,
      body: { invitationId },
    });

    return new NextResponse(null, { status: HTTP_STATUS.ok, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
