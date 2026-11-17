import { NextRequest, NextResponse } from "next/server";
import { listWorkspaceNotifications } from "@/lib/db/repositories/workspace-notifications";
import { apiErrorResponse } from "@/lib/server/api-response";
import { requireTenant } from "@/lib/server/auth";
import { workspaceNotificationResponseSchema } from "@/lib/validation/workspace-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request);
    const rows = await listWorkspaceNotifications(tenant.organizationId, tenant.userId);
    const data = rows.map((row) => ({
      ...row,
      plannedAt: row.plannedAt?.toISOString() ?? null,
      occurredAt: row.occurredAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    }));
    const result = workspaceNotificationResponseSchema.safeParse({ data });
    if (!result.success) throw new Error("Workspace notifications failed response validation.");
    return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error, request); }
}
