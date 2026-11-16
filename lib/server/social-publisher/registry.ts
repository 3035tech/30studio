import "server-only";
import { SOCIAL_CAPABILITY_CATALOG_VERSION, SOCIAL_CAPABILITY_SNAPSHOT_SCHEMA_VERSION, SOCIAL_PLATFORMS, SOCIAL_PUBLICATION_LIMITS } from "@/lib/constants";
import type { SocialPlatform } from "@/lib/constants";
import { linkedinPublisher } from "@/lib/server/social-publisher/linkedin";
import { facebookPublisher } from "@/lib/server/social-publisher/facebook";
import { instagramPublisher } from "@/lib/server/social-publisher/instagram";
import { threadsPublisher } from "@/lib/server/social-publisher/threads";
import type { SocialPublisherAdapter } from "@/lib/server/social-publisher/types";

const publishers: Partial<Record<SocialPlatform, SocialPublisherAdapter>> = {
  linkedin: linkedinPublisher,
  facebook: facebookPublisher,
  instagram: instagramPublisher,
  threads: threadsPublisher,
};

export function getSocialPublisher(platform: SocialPlatform) {
  return publishers[platform] ?? null;
}

export function getConfiguredSocialPublishers() {
  return Object.values(publishers).filter((publisher): publisher is SocialPublisherAdapter => publisher !== undefined);
}

export function getSocialPublisherCapabilities() {
  return SOCIAL_PLATFORMS.map((platform) => {
    const publisher = getSocialPublisher(platform);
    return {
      platform,
      publication: !publisher ? "connection_only" as const : publisher.mediaSupport === "single_image" ? "single_image" as const : "text" as const,
      maximumTextCharacters: publisher?.maximumTextCharacters ?? null,
    };
  });
}

export function getSocialCapabilitySnapshot(platform: SocialPlatform) {
  const capability = getSocialPublisherCapabilities().find((entry) => entry.platform === platform);
  return {
    schemaVersion: SOCIAL_CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
    capabilityVersion: SOCIAL_CAPABILITY_CATALOG_VERSION,
    platform,
    publication: capability?.publication ?? "connection_only",
    maximumTextCharacters: capability?.maximumTextCharacters ?? null,
    image: platform === "instagram" ? {
      acceptedSourceTypes: SOCIAL_PUBLICATION_LIMITS.instagram.supportedSourceImageTypes,
      maximumSourceBytes: SOCIAL_PUBLICATION_LIMITS.instagram.maximumSourceImageBytes,
      maximumPublishedBytes: SOCIAL_PUBLICATION_LIMITS.instagram.maximumPublishedImageBytes,
      minimumAspectRatio: SOCIAL_PUBLICATION_LIMITS.instagram.minimumAspectRatio,
      maximumAspectRatio: SOCIAL_PUBLICATION_LIMITS.instagram.maximumAspectRatio,
      maximumWidth: SOCIAL_PUBLICATION_LIMITS.instagram.maximumImageWidth,
    } : null,
  } as const;
}
