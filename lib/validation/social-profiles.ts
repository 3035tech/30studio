import { z } from "zod";
import { SOCIAL_PLATFORMS } from "@/lib/constants";

const SOCIAL_PROFILE_LIMITS = { displayNameCharacters: 120, handleCharacters: 120 } as const;

export const socialProfileCreateSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  displayName: z.string().trim().min(1).max(SOCIAL_PROFILE_LIMITS.displayNameCharacters),
  handle: z.string().trim().max(SOCIAL_PROFILE_LIMITS.handleCharacters).optional(),
}).strict();

export type SocialProfileCreateInput = z.infer<typeof socialProfileCreateSchema>;
