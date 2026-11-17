import { NextRequest, NextResponse } from "next/server";
import { TENANT_PERMISSIONS } from "@/lib/constants";
import { listTeamMembers } from "@/lib/db/repositories/team";
import { apiErrorResponse } from "@/lib/server/api-response";
import { requireTenant } from "@/lib/server/auth";
import { hasTenantPermission } from "@/lib/server/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request);
    const canManage = hasTenantPermission(tenant.role, TENANT_PERMISSIONS.membersManage);
    const members = canManage ? await listTeamMembers(tenant.organizationId) : [];

    return NextResponse.json(
      { data: members, canManage, actorRole: tenant.role, actorUserId: tenant.userId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
