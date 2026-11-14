import { z } from "zod";
import { TENANT_ROLES } from "@/lib/constants";

export const teamMemberRoleUpdateSchema = z.object({
  role: z.enum(TENANT_ROLES),
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

export type TeamMemberRoleUpdate = z.infer<typeof teamMemberRoleUpdateSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
