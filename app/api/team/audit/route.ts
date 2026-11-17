import { NextRequest, NextResponse } from "next/server";
import { TENANT_PERMISSIONS } from "@/lib/constants";
import { listTeamAuditEvents } from "@/lib/db/repositories/team";
import { apiErrorResponse } from "@/lib/server/api-response";
import { requireTenant } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.membersManage);
    const events = await listTeamAuditEvents(tenant.organizationId);
    return NextResponse.json({ data: events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
