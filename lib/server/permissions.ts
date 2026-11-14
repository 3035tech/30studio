import { TENANT_ROLE_PERMISSIONS, TENANT_ROLES } from "@/lib/constants";
import type { TenantPermission, TenantRole } from "@/lib/constants";

function isTenantRole(value: string): value is TenantRole {
  return TENANT_ROLES.some((role) => role === value);
}

export function hasTenantPermission(roles: string, permission: TenantPermission) {
  const permissions = roles.split(",").flatMap((role) => {
    const normalizedRole = role.trim();
    return isTenantRole(normalizedRole) ? TENANT_ROLE_PERMISSIONS[normalizedRole] : [];
  });

  return new Set<TenantPermission>(permissions).has(permission);
}
