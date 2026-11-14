import { TENANT_ROLE } from "@/lib/constants";

export function canManageTeamMember(
  actorUserId: string,
  actorRole: string,
  targetUserId: string,
  targetRole: string,
  nextRole?: string,
) {
  if (actorUserId === targetUserId || targetRole === TENANT_ROLE.owner) return false;
  if (actorRole !== TENANT_ROLE.owner && actorRole !== TENANT_ROLE.admin) return false;
  if (actorRole === TENANT_ROLE.admin && (targetRole === TENANT_ROLE.admin || nextRole === TENANT_ROLE.admin)) return false;
  return true;
}
