import { createHash } from "node:crypto";
import type { SocialPlatform } from "@/lib/constants";
import type { SocialCapabilitySnapshot } from "@/lib/constants";

export type ContentApprovalFingerprintInput = {
  contentItemId: string;
  brandId: string;
  title: string;
  platform: SocialPlatform;
  plannedAt: Date;
  timeZone: string;
  contentVersionId: string;
  socialProfileId?: string | null;
  versionNumber: number;
  canonicalCopy: string;
  variantCopy: string;
  brandKitVersionNumber: number | null;
  capabilitySnapshot?: SocialCapabilitySnapshot | null;
  media: readonly { id: string; sha256: string | null; contentType: string | null; sizeBytes: number | null }[];
};

export function getContentApprovalFingerprint(input: ContentApprovalFingerprintInput) {
  const { capabilitySnapshot, ...fingerprintInput } = input;
  const snapshot = {
    ...fingerprintInput,
    plannedAt: input.plannedAt.toISOString(),
    ...(capabilitySnapshot ? { capabilitySnapshot } : {}),
    media: [...input.media]
      .map(({ id, sha256, contentType, sizeBytes }) => ({ id, sha256, contentType, sizeBytes }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}
