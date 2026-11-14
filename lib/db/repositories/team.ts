import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { API_ERROR_CODES, INVITATION_STATUS, TEAM_AUDIT_ACTIONS, TEAM_AUDIT_LIMIT, TEAM_INVITATION_LIMIT, TEAM_MEMBER_LIMIT, TENANT_PERMISSIONS } from "@/lib/constants";
import type { TenantRole } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { invitation, member, teamAuditEvents, user } from "@/lib/db/schema";
import { ApiError } from "@/lib/server/api-error";
import { HTTP_STATUS } from "@/lib/constants";
import { canManageTeamMember } from "@/lib/server/team-policy";
import { hasTenantPermission } from "@/lib/server/permissions";
import { invitationStatusSchema, tenantRoleSchema } from "@/lib/validation/team";

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

export async function listTeamInvitations(organizationId: string) {
  const inviter = alias(user, "team_invitation_inviter");
  const rows = await getDatabase()
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      inviterName: inviter.name,
    })
    .from(invitation)
    .leftJoin(inviter, eq(inviter.id, invitation.inviterId))
    .where(eq(invitation.organizationId, organizationId))
    .orderBy(desc(invitation.createdAt), asc(invitation.id))
    .limit(TEAM_INVITATION_LIMIT);

  return rows.map((row) => ({
    ...row,
    role: tenantRoleSchema.parse(row.role),
    status: invitationStatusSchema.parse(row.status),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    inviterName: row.inviterName ?? "",
  }));
}

export async function getTeamInvitation(organizationId: string, invitationId: string) {
  const [row] = await getDatabase()
    .select({ id: invitation.id, email: invitation.email, role: invitation.role, status: invitation.status })
    .from(invitation)
    .where(and(eq(invitation.organizationId, organizationId), eq(invitation.id, invitationId)))
    .limit(1);

  return row ? { ...row, role: tenantRoleSchema.parse(row.role), status: invitationStatusSchema.parse(row.status) } : null;
}

export async function hasTeamMemberWithEmail(organizationId: string, email: string) {
  const [existingMember] = await getDatabase()
    .select({ id: member.id })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, organizationId), eq(user.email, email)))
    .limit(1);

  return Boolean(existingMember);
}

export async function hasPendingInvitationForEmail(organizationId: string, email: string) {
  const [existingInvitation] = await getDatabase()
    .select({ id: invitation.id })
    .from(invitation)
    .where(and(eq(invitation.organizationId, organizationId), eq(invitation.email, email), eq(invitation.status, INVITATION_STATUS.pending)))
    .limit(1);

  return Boolean(existingInvitation);
}

export async function listTeamAuditEvents(organizationId: string) {
  const actor = alias(user, "team_audit_actor");
  const target = alias(user, "team_audit_target");
  const rows = await getDatabase()
    .select({
      id: teamAuditEvents.id,
      action: teamAuditEvents.action,
      actorName: actor.name,
      actorEmail: actor.email,
      targetName: target.name,
      targetEmail: teamAuditEvents.targetEmail,
      targetInvitationId: teamAuditEvents.invitationId,
      previousRole: teamAuditEvents.previousRole,
      newRole: teamAuditEvents.newRole,
      occurredAt: teamAuditEvents.occurredAt,
    })
    .from(teamAuditEvents)
    .leftJoin(actor, eq(actor.id, teamAuditEvents.actorUserId))
    .leftJoin(target, eq(target.id, teamAuditEvents.targetUserId))
    .where(eq(teamAuditEvents.organizationId, organizationId))
    .orderBy(desc(teamAuditEvents.occurredAt), asc(teamAuditEvents.id))
    .limit(TEAM_AUDIT_LIMIT);

  return rows.map((row) => ({
    ...row,
    actorName: row.actorName ?? "",
    actorEmail: row.actorEmail ?? "",
    targetName: row.targetName ?? "",
    occurredAt: row.occurredAt.toISOString(),
  }));
}

export async function recordTeamAuditEvent(event: {
  organizationId: string;
  actorUserId: string;
  action: (typeof TEAM_AUDIT_ACTIONS)[keyof typeof TEAM_AUDIT_ACTIONS];
  targetUserId?: string | null;
  targetEmail?: string | null;
  invitationId?: string | null;
  previousRole?: string | null;
  newRole?: string | null;
}) {
  await getDatabase().insert(teamAuditEvents).values(event);
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
