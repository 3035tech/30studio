import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { deleteBrandApprovalPolicy, listContentApprovalPolicies, saveContentApprovalPolicy } from "@/lib/db/repositories/content-approval-policies";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { contentApprovalPolicyDeleteSchema, contentApprovalPolicySaveSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentRead);
    const data = await listContentApprovalPolicies(tenant.organizationId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOriginJsonRequest(request);
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentApprovalPoliciesManage);
    const body: unknown = await request.json().catch(() => null);
    const parsed = contentApprovalPolicySaveSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const saved = await saveContentApprovalPolicy(tenant.organizationId, tenant.userId, parsed.data.brandId, parsed.data.requiredApprovals);
    if (!saved) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    return NextResponse.json({ data: await listContentApprovalPolicies(tenant.organizationId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOriginJsonRequest(request);
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentApprovalPoliciesManage);
    const body: unknown = await request.json().catch(() => null);
    const parsed = contentApprovalPolicyDeleteSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    await deleteBrandApprovalPolicy(tenant.organizationId, parsed.data.brandId);
    return NextResponse.json({ data: await listContentApprovalPolicies(tenant.organizationId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
