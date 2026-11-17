import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_ERROR_CODES, CONTENT_APPROVAL_ACTION, CONTENT_APPROVAL_STATUS, HTTP_STATUS, TENANT_PERMISSIONS, WORKSPACE_NOTIFICATION_TYPES } from "@/lib/constants";
import { decideContentApproval, getContentApprovalState, submitContentForApproval } from "@/lib/db/repositories/content-approvals";
import { recordWorkspaceNotification } from "@/lib/db/repositories/workspace-notifications";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { contentApprovalRequestSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };
const itemIdSchema = z.uuid();

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentRead);
    const { itemId } = await context.params;
    if (!itemIdSchema.safeParse(itemId).success) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    const approval = await getContentApprovalState(tenant.organizationId, itemId);
    if (!approval) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: approval }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertSameOriginJsonRequest(request);
    const { itemId } = await context.params;
    if (!itemIdSchema.safeParse(itemId).success) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest);
    }
    const parsed = contentApprovalRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const permission = parsed.data.action === CONTENT_APPROVAL_ACTION.submit ? TENANT_PERMISSIONS.contentManage : TENANT_PERMISSIONS.contentApprove;
    const tenant = await requireTenant(request, permission);

    if (parsed.data.action === CONTENT_APPROVAL_ACTION.submit) {
      const result = await submitContentForApproval(tenant.organizationId, tenant.userId, itemId, parsed.data.socialProfileId ?? null);
      if (result.kind === "not_found") throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
      if (result.kind === "content_required") throw new ApiError(API_ERROR_CODES.contentApprovalContentRequired, HTTP_STATUS.conflict);
      if (result.kind === "media_pending") throw new ApiError(API_ERROR_CODES.contentApprovalMediaPending, HTTP_STATUS.conflict);
      if (result.kind === "publisher_profile_required") throw new ApiError(API_ERROR_CODES.contentApprovalPublisherConnectionRequired, HTTP_STATUS.conflict);
      if (result.kind === "publisher_media_unsupported") throw new ApiError(API_ERROR_CODES.contentApprovalPublisherMediaUnsupported, HTTP_STATUS.conflict);
      if (result.kind === "publisher_text_limit") throw new ApiError(API_ERROR_CODES.contentApprovalPublisherTextLimit, HTTP_STATUS.unprocessable);
      if (result.kind === "conflict") throw new ApiError(API_ERROR_CODES.contentApprovalConflict, HTTP_STATUS.conflict);
      if (result.kind === "created") await recordWorkspaceNotification({ organizationId: tenant.organizationId, eventType: WORKSPACE_NOTIFICATION_TYPES.approvalRequested, dedupeKey: `approval:${result.id}`, brandId: result.brandId, contentItemId: itemId, platform: result.platform });
      return NextResponse.json({ data: { kind: result.kind, requestId: result.id, itemStatus: "in_review" } }, { status: result.kind === "created" ? HTTP_STATUS.created : HTTP_STATUS.ok, headers: { "Cache-Control": "no-store" } });
    }

    const decision = parsed.data.action;
    const result = await decideContentApproval(tenant.organizationId, tenant.userId, itemId, decision, parsed.data.note ?? null);
    if (result.kind === "not_found") throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    if (result.kind === "self_review") throw new ApiError(API_ERROR_CODES.contentApprovalSelfReview, HTTP_STATUS.forbidden);
    if (result.kind === "stale") throw new ApiError(API_ERROR_CODES.contentApprovalStale, HTTP_STATUS.conflict);
    if (result.kind === "conflict") throw new ApiError(API_ERROR_CODES.contentApprovalConflict, HTTP_STATUS.conflict);
    if (result.kind === "already_decided") throw new ApiError(API_ERROR_CODES.contentApprovalConflict, HTTP_STATUS.conflict);
    const itemStatus = result.kind === "partial" ? "in_review" : result.kind === "decided" ? result.itemStatus : decision === CONTENT_APPROVAL_STATUS.approved ? "approved" : "draft";
    return NextResponse.json({ data: { kind: result.kind, decision, itemStatus, ...(result.kind === "partial" ? { approvedCount: result.approvedCount, requiredApprovals: result.requiredApprovals } : {}) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
