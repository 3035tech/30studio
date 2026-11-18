import "server-only";
import { BRAND_ASSET_LIMITS } from "@/lib/constants";
import { listAbandonedContentMediaUploads, removeAbandonedContentMediaUpload } from "@/lib/db/repositories/calendar";
import { deleteBrandAssetObject } from "@/lib/server/brand-asset-storage";

export async function runContentMediaUploadCleanup(now = new Date()) {
  const cutoff = new Date(now.getTime() - BRAND_ASSET_LIMITS.abandonedUploadRetentionSeconds * 1_000);
  const candidates = await listAbandonedContentMediaUploads(cutoff, BRAND_ASSET_LIMITS.cleanupBatchSize);
  let removed = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      await deleteBrandAssetObject(candidate.uploadKey);
      if (await removeAbandonedContentMediaUpload(candidate.id, cutoff)) removed += 1;
    } catch {
      failed += 1;
    }
  }
  return { examined: candidates.length, removed, failed };
}
