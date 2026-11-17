import { z } from "zod";
import { AUTH_LIMITS, INVITATION_STATUSES, TEAM_AUDIT_ACTION_VALUES, TENANT_ROLE, TENANT_ROLES } from "@/lib/constants";

export const tenantRoleSchema = z.enum(TENANT_ROLES);
export const invitationStatusSchema = z.enum(INVITATION_STATUSES);

export const teamMemberRoleUpdateSchema = z.object({
  role: z.enum(TENANT_ROLES),
}).strict();

export const teamInvitationCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(AUTH_LIMITS.emailCharacters),
  role: z.enum(TENANT_ROLES).refine((role) => role !== TENANT_ROLE.owner),
}).strict();

export const teamMemberSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(TENANT_ROLES),
  createdAt: z.string().datetime(),
});

export const teamListResponseSchema = z.object({
  data: z.array(teamMemberSchema),
  canManage: z.boolean(),
  actorRole: z.enum(TENANT_ROLES),
  actorUserId: z.string().min(1),
});

export const teamInvitationSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  role: z.enum(TENANT_ROLES),
  status: z.enum(INVITATION_STATUSES),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  inviterName: z.string(),
});

export const teamInvitationsResponseSchema = z.object({
  data: z.array(teamInvitationSchema),
  canManage: z.boolean(),
  actorRole: z.enum(TENANT_ROLES),
});

export const teamAuditEventSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(TEAM_AUDIT_ACTION_VALUES),
  actorName: z.string(),
  actorEmail: z.string(),
  targetName: z.string(),
  targetEmail: z.string().nullable(),
  targetInvitationId: z.string().nullable(),
  previousRole: z.string().nullable(),
  newRole: z.string().nullable(),
  occurredAt: z.string().datetime(),
});

export const teamAuditResponseSchema = z.object({ data: z.array(teamAuditEventSchema) });

export type TeamMemberRoleUpdate = z.infer<typeof teamMemberRoleUpdateSchema>;
export type TeamInvitationCreate = z.infer<typeof teamInvitationCreateSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamInvitation = z.infer<typeof teamInvitationSchema>;
export type TeamAuditEvent = z.infer<typeof teamAuditEventSchema>;
