import assert from "node:assert/strict";
import { test } from "node:test";
import { BRAND_ASSET_LIMITS } from "@/lib/constants";
import { runBrandAssetCleanup } from "@/lib/server/brand-asset-cleanup";

test("brand asset cleanup uses the retention window and bounded batch", async () => {
  const now = new Date("2026-11-14T12:00:00.000Z");
  let queriedCutoff: Date | undefined;
  let queriedLimit = 0;
  let removedId = "";
  const result = await runBrandAssetCleanup({
    findAbandoned: async (cutoff, limit) => {
      queriedCutoff = cutoff;
      queriedLimit = limit;
      return [{ id: "asset-1", uploadKey: "staging/asset-1" }];
    },
    deleteObject: async () => undefined,
    removeIfStillAbandoned: async (id) => { removedId = id; return true; },
    now: () => now,
  });

  assert.equal(queriedCutoff?.getTime(), now.getTime() - BRAND_ASSET_LIMITS.abandonedUploadRetentionSeconds * 1_000);
  assert.equal(queriedLimit, BRAND_ASSET_LIMITS.cleanupBatchSize);
  assert.equal(removedId, "asset-1");
  assert.deepEqual(result, { examined: 1, removed: 1, failed: 0 });
});

test("brand asset cleanup keeps database records when object deletion fails", async () => {
  let databaseRemovalAttempted = false;
  const result = await runBrandAssetCleanup({
    findAbandoned: async () => [{ id: "asset-1", uploadKey: "staging/asset-1" }],
    deleteObject: async () => { throw new Error("storage unavailable"); },
    removeIfStillAbandoned: async () => { databaseRemovalAttempted = true; return true; },
    now: () => new Date("2026-11-14T12:00:00.000Z"),
  });

  assert.equal(databaseRemovalAttempted, false);
  assert.deepEqual(result, { examined: 1, removed: 0, failed: 1 });
});
