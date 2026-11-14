import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { API_ERROR_CODES, TEAM_AUDIT_ACTIONS, TEAM_MEMBER_LIMIT, TENANT_PERMISSIONS } from "@/lib/constants";
import type { TenantRole } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { member, teamAuditEvents } from "@/lib/db/schema";
import { ApiError } from "@/lib/server/api-error";
import { HTTP_STATUS } from "@/lib/constants";
import { canManageTeamMember } from "@/lib/server/team-policy";
import { hasTenantPermission } from "@/lib/server/permissions";

export async function listTeamMembers(organizationId: string) {
  const members = await getDatabase().query.member.findMany({
    where: eq(member.organizationId, organizationId),
    with: { user: { columns: { id: true, name: true, email: true } } },
    orderBy: [asc(member.createdAt), asc(member.id)],
    limit: TEAM_MEMBER_LIMIT,
  });

  return members.map(({ user: memberUser, ...membership }) => ({
    id: membership.id,
    userId: memberUser.id,
    name: memberUser.name,
    email: memberUser.email,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
  }));
}

export async function updateTeamMemberRole(
  organizationId: string,
  actorUserId: string,
  memberId: string,
  nextRole: TenantRole,
) {
  const database = getDatabase();

  return database.transaction(async (transaction) => {
    const [actor] = await transaction
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, actorUserId)))
      .for("share")
      .limit(1);

    if (!actor || !hasTenantPermission(actor.role, TENANT_PERMISSIONS.membersManage)) {
      throw new ApiError(API_ERROR_CODES.forbidden, HTTP_STATUS.forbidden);
    }

    const [target] = await transaction
      .select({ id: member.id, userId: member.userId, role: member.role })
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
      .for("update")
      .limit(1);

    if (!target) return null;
    if (!canManageTeamMember(actorUserId, actor.role, target.userId, target.role, nextRole)) {
      throw new ApiError(API_ERROR_CODES.teamOperationNotAllowed, HTTP_STATUS.forbidden);
    }
    if (target.role === nextRole) return target;

    const [updated] = await transaction
      .update(member)
      .set({ role: nextRole })
      .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
      .returning({ id: member.id, userId: member.userId, role: member.role });

    await transaction.insert(teamAuditEvents).values({
      organizationId,
      actorUserId,
      targetUserId: target.userId,
      action: TEAM_AUDIT_ACTIONS.memberRoleChanged,
      previousRole: target.role,
      newRole: nextRole,
    });

    return updated ?? null;
  });
}

export async function removeTeamMember(
  organizationId: string,
  actorUserId: string,
  memberId: string,
) {
  const database = getDatabase();

  return database.transaction(async (transaction) => {
    const [actor] = await transaction
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, actorUserId)))
      .for("share")
      .limit(1);

    if (!actor || !hasTenantPermission(actor.role, TENANT_PERMISSIONS.membersManage)) {
      throw new ApiError(API_ERROR_CODES.forbidden, HTTP_STATUS.forbidden);
    }

    const [target] = await transaction
      .select({ id: member.id, userId: member.userId, role: member.role })
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
      .for("update")
      .limit(1);

    if (!target) return null;
    if (!canManageTeamMember(actorUserId, actor.role, target.userId, target.role)) {
      throw new ApiError(API_ERROR_CODES.teamOperationNotAllowed, HTTP_STATUS.forbidden);
    }

    await transaction.insert(teamAuditEvents).values({
      organizationId,
      actorUserId,
      targetUserId: target.userId,
      action: TEAM_AUDIT_ACTIONS.memberRemoved,
      previousRole: target.role,
    });

    const [removed] = await transaction
      .delete(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
      .returning({ id: member.id });

    return removed ?? null;
  });
}
