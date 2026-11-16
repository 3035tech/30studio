import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCAL_DEVELOPMENT } from "@/lib/constants";
import { isAllowedBrandAssetEndpoint } from "@/lib/server/brand-asset-endpoint";

test("allows loopback storage endpoints and the exact LocalStack Docker endpoint only in development", () => {
  assert.equal(isAllowedBrandAssetEndpoint("http://127.0.0.1:4566", "test"), true);
  assert.equal(isAllowedBrandAssetEndpoint(LOCAL_DEVELOPMENT.objectStorageEndpoint, LOCAL_DEVELOPMENT.runtimeEnvironment), true);
  assert.equal(isAllowedBrandAssetEndpoint(LOCAL_DEVELOPMENT.objectStorageEndpoint, "production"), false);
  assert.equal(isAllowedBrandAssetEndpoint("http://localstack:4567", LOCAL_DEVELOPMENT.runtimeEnvironment), false);
  assert.equal(isAllowedBrandAssetEndpoint("http://169.254.169.254/latest/meta-data", LOCAL_DEVELOPMENT.runtimeEnvironment), false);
  assert.equal(isAllowedBrandAssetEndpoint("http://localstack:4566?bucket=external", LOCAL_DEVELOPMENT.runtimeEnvironment), false);
});
