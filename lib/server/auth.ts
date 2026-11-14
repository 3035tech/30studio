import "server-only";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/server/better-auth";
import { member } from "@/lib/db/auth-schema";
import { getDatabase } from "@/lib/db/client";
import { API_ERROR_CODES, HTTP_STATUS } from "@/lib/constants";
import type { TenantPermission } from "@/lib/constants";
import { ApiError } from "@/lib/server/api-error";
import { hasTenantPermission } from "@/lib/server/permissions";

export type TenantContext = {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
};

export async function requireTenant(request: NextRequest, permission?: TenantPermission): Promise<TenantContext> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new ApiError(API_ERROR_CODES.unauthenticated, HTTP_STATUS.unauthorized);

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) throw new ApiError(API_ERROR_CODES.organizationRequired, HTTP_STATUS.forbidden);

  const [membership] = await getDatabase()
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
    .limit(1);

  if (!membership) throw new ApiError(API_ERROR_CODES.forbidden, HTTP_STATUS.forbidden);
  if (permission) {
    if (!hasTenantPermission(membership.role, permission)) {
      throw new ApiError(API_ERROR_CODES.forbidden, HTTP_STATUS.forbidden);
    }
  }
  return {
    userId: session.user.id,
    email: session.user.email,
    organizationId,
    role: membership.role,
  };
}

export function assertSameOriginJsonRequest(request: Request) {
  assertSameOriginRequest(request);
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLocaleLowerCase("en");

  if (contentType !== "application/json") {
    throw new ApiError(API_ERROR_CODES.forbidden, HTTP_STATUS.forbidden);
  }
}

export function assertSameOriginRequest(request: Request) {
  const configuredOrigin = process.env.STUDIO_PUBLIC_ORIGIN;
  const requestOrigin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!configuredOrigin || !requestOrigin || requestOrigin !== configuredOrigin) {
    throw new ApiError(API_ERROR_CODES.forbidden, HTTP_STATUS.forbidden);
  }
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ApiError(API_ERROR_CODES.forbidden, HTTP_STATUS.forbidden);
  }
}
