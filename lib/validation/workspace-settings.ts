import { z } from "zod";
import { WORKSPACE_LIMITS } from "@/lib/constants";

export const workspaceNameUpdateSchema = z.object({
  name: z.string().trim().min(1).max(WORKSPACE_LIMITS.nameCharacters),
}).strict();

export const workspaceSettingsResponseSchema = z.object({
  data: z.object({ id: z.string().min(1), name: z.string().min(1), slug: z.string().min(1) }),
  canManage: z.boolean(),
});

export type WorkspaceNameUpdate = z.infer<typeof workspaceNameUpdateSchema>;
