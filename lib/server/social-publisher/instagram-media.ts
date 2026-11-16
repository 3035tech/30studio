import "server-only";
import { SOCIAL_PUBLICATION_LIMITS } from "@/lib/constants";

export type InstagramImageMetadata = { contentType: string | null; sizeBytes: number | null; width: number | null; height: number | null };

export function isPublishableInstagramImage(asset: InstagramImageMetadata) {
  const limits = SOCIAL_PUBLICATION_LIMITS.instagram;
  if (!limits.supportedSourceImageTypes.some((type) => type === asset.contentType)) return false;
  if (!asset.sizeBytes || asset.sizeBytes > limits.maximumSourceImageBytes || !asset.width || !asset.height) return false;
  const aspectRatio = asset.width / asset.height;
  return aspectRatio >= limits.minimumAspectRatio && aspectRatio <= limits.maximumAspectRatio;
}
