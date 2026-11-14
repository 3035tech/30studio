import "server-only";
import { BRAND_ASSET_LIMITS } from "@/lib/constants";
import { listAbandonedBrandAssetUploads, removeAbandonedBrandAssetUpload } from "@/lib/db/repositories/brand-assets";
import { deleteBrandAssetObject } from "@/lib/server/brand-asset-storage";

type CleanupCandidate = { id: string; uploadKey: string };
type CleanupDependencies = {
  findAbandoned: (cutoff: Date, limit: number) => Promise<CleanupCandidate[]>;
  deleteObject: (key: string) => Promise<void>;
  removeIfStillAbandoned: (id: string, cutoff: Date) => Promise<boolean>;
  now?: () => Date;
};

const productionDependencies: CleanupDependencies = {
  findAbandoned: listAbandonedBrandAssetUploads,
  deleteObject: deleteBrandAssetObject,
  removeIfStillAbandoned: removeAbandonedBrandAssetUpload,
};

export async function runBrandAssetCleanup(dependencies: CleanupDependencies = productionDependencies) {
  const cutoff = new Date((dependencies.now?.() ?? new Date()).getTime() - BRAND_ASSET_LIMITS.abandonedUploadRetentionSeconds * 1_000);
  const candidates = await dependencies.findAbandoned(cutoff, BRAND_ASSET_LIMITS.cleanupBatchSize);
  let removed = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      await dependencies.deleteObject(candidate.uploadKey);
      if (await dependencies.removeIfStillAbandoned(candidate.id, cutoff)) removed += 1;
    } catch {
      failed += 1;
    }
  }

  return { examined: candidates.length, removed, failed };
}
