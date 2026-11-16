import type { SocialPlatform } from "@/lib/constants";

export type SocialPublishResult =
  | { kind: "published"; externalPostId: string }
  | { kind: "rejected"; status: number }
  | { kind: "indeterminate" };

export type SocialPublicationReconciliationResult =
  | { kind: "published" }
  | { kind: "unknown" };

export type SocialTextPostInput = {
  externalAccountId: string;
  copy: string;
  imageUrl?: string;
  beforeFinalPublish?: (providerReferenceId: string) => Promise<void>;
};

export type SocialPublisherAdapter = {
  platform: SocialPlatform;
  requiredScopes: readonly string[];
  mediaSupport: "none" | "single_image";
  maximumTextCharacters?: number;
  assertConfigured(): void;
  publishText(accessToken: string, input: SocialTextPostInput): Promise<SocialPublishResult>;
  reconcilePublished?(accessToken: string, input: { externalAccountId: string; providerReferenceId: string }): Promise<SocialPublicationReconciliationResult>;
};
