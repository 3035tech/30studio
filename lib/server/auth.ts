import "server-only";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/server/better-auth";
import { member } from "@/lib/db/auth-schema";
import { getDatabase } from "@/lib/db/client";
import { API_ERROR_CODES, HTTP_STATUS, TENANT_ROLE_PERMISSIONS } from "@/lib/constants";
import type { TenantPermission, TenantRole } from "@/lib/constants";
import { ApiError } from "@/lib/server/api-error";

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
    const rolePermissions = membership.role.split(",").flatMap((role) =>
      TENANT_ROLE_PERMISSIONS[role.trim() as TenantRole] ?? [],
    );
    if (!new Set<string>(rolePermissions).has(permission)) {
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
  const configuredOrigin = process.env.STUDIO_PUBLIC_ORIGIN;
  const requestOrigin = request.headers.get("origin");
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLocaleLowerCase("en");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!configuredOrigin || !requestOrigin || requestOrigin !== configuredOrigin || contentType !== "application/json") {
    throw new ApiError(API_ERROR_CODES.forbidden, HTTP_STATUS.forbidden);
  }
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ApiError(API_ERROR_CODES.forbidden, HTTP_STATUS.forbidden);
  }
}
