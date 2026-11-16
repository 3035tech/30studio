import { z } from "zod";
import { SOCIAL_PLATFORMS, SOCIAL_PROFILE_STATUSES, SOCIAL_PUBLISHING_CAPABILITIES } from "@/lib/constants";

export const socialConnectionSchema = z.object({
  id: z.string().uuid(), platform: z.enum(SOCIAL_PLATFORMS), displayName: z.string(), handle: z.string().nullable(),
  status: z.enum(SOCIAL_PROFILE_STATUSES), connectedAt: z.iso.datetime({ offset: true }).nullable(),
  connectedByName: z.string().nullable(), grantedScopes: z.array(z.string()), missingScopes: z.array(z.string()),
  tokenExpiresAt: z.iso.datetime({ offset: true }).nullable(), refreshTokenExpiresAt: z.iso.datetime({ offset: true }).nullable(),
  credentialsUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
});
export const socialConnectionListResponseSchema = z.object({ data: z.array(socialConnectionSchema) });
export const socialConnectionConfigurationResponseSchema = z.object({
  data: z.array(z.object({
    platform: z.enum(SOCIAL_PLATFORMS), configured: z.boolean(),
    publication: z.enum(SOCIAL_PUBLISHING_CAPABILITIES), maximumTextCharacters: z.number().int().positive().nullable(),
  })),
});
