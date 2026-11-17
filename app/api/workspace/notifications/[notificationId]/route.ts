import { NextRequest, NextResponse } from "next/server";
import { markWorkspaceNotificationRead } from "@/lib/db/repositories/workspace-notifications";
import { API_ERROR_CODES, HTTP_STATUS } from "@/lib/constants";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { workspaceNotificationReadRequestSchema } from "@/lib/validation/workspace-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ notificationId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    assertSameOriginJsonRequest(request);
    const { notificationId } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(notificationId)) {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }
    const parsed = workspaceNotificationReadRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    const updated = await markWorkspaceNotificationRead(tenant.organizationId, tenant.userId, notificationId, parsed.data.read);
    if (!updated) throw new ApiError(API_ERROR_CODES.workspaceNotificationNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: { id: notificationId, read: parsed.data.read } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error, request); }
}
