import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { BRAND_ASSET_LIMITS } from "@/lib/constants";
import { createBrandAssetUpload, deleteBrandAssetObject, storeVerifiedBrandAsset, verifyBrandAssetUpload } from "@/lib/server/brand-asset-storage";
import { runBrandAssetCleanup } from "@/lib/server/brand-asset-cleanup";
import { ApiError } from "@/lib/server/api-error";

const endpoint = process.env.STUDIO_ASSET_ENDPOINT;
const endpointUrl = endpoint ? new URL(endpoint) : null;
const isLocalEndpoint = Boolean(endpointUrl && ["localhost", "127.0.0.1", "::1"].includes(endpointUrl.hostname));
const shouldSkip = !endpoint || !isLocalEndpoint;
const region = "us-east-1";
const bucket = `studio-asset-test-${randomUUID()}`;
const assetIds = { valid: randomUUID(), tampered: randomUUID() } as const;
let client: S3Client | undefined;
let imageBytes: Buffer;
let imageBlobPart: ArrayBuffer;
let imageHash: string;

before(async () => {
  if (shouldSkip || !endpoint) return;
  process.env.AWS_REGION = region;
  process.env.AWS_ACCESS_KEY_ID = "test";
  process.env.AWS_SECRET_ACCESS_KEY = "test";
  delete process.env.AWS_SESSION_TOKEN;
  process.env.STUDIO_ASSET_BUCKET = bucket;
  client = new S3Client({ region, endpoint, forcePathStyle: true });
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  imageBytes = await sharp({ create: { width: 3, height: 2, channels: 4, background: { r: 22, g: 33, b: 44, alpha: 1 } } }).png().toBuffer();
  imageBlobPart = new ArrayBuffer(imageBytes.byteLength);
  new Uint8Array(imageBlobPart).set(imageBytes);
  imageHash = createHash("sha256").update(imageBytes).digest("hex");
});

after(async () => {
  if (!client) return;
  const objectKeys = Object.values(assetIds).flatMap((id) => [`staging/${id}`, `assets/${id}`]);
  await Promise.all(objectKeys.map((key) => client?.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))));
  await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  client.destroy();
});

test("verified final assets stay unchanged when an upload URL is replayed", { skip: shouldSkip }, async () => {
  assert.ok(client);
  const validKey = `assets/${assetIds.valid}`;
  const uploadKey = `staging/${assetIds.valid}`;
  const validInput = { contentType: "image/png" as const, sha256: imageHash, sizeBytes: imageBytes.byteLength };
  const upload = await createBrandAssetUpload(validInput, uploadKey);
  const policy = JSON.parse(Buffer.from(upload.fields.Policy ?? "", "base64").toString("utf8")) as { conditions: unknown[] };
  assert.ok(policy.conditions.some((condition) => Array.isArray(condition) && condition[0] === "content-length-range" && condition[1] === 1 && condition[2] === BRAND_ASSET_LIMITS.maximumBytes));
  assert.ok(policy.conditions.some((condition) => Array.isArray(condition) && condition[0] === "eq" && condition[1] === "$key" && condition[2] === uploadKey));
  assert.equal("acl" in upload.fields, false);

  const form = new FormData();
  Object.entries(upload.fields).forEach(([key, value]) => form.append(key, value));
  form.append("file", new Blob([imageBlobPart], { type: validInput.contentType }), "logo.png");
  const uploadResponse = await fetch(upload.url, { method: "POST", body: form });
  assert.equal(uploadResponse.ok, true);
  const verified = await verifyBrandAssetUpload(validInput, uploadKey);
  assert.deepEqual({ width: verified.width, height: verified.height }, { width: 3, height: 2 });
  await storeVerifiedBrandAsset(validInput, validKey, verified.bytes);

  const alternateBytes = await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  const alternateBlobPart = new ArrayBuffer(alternateBytes.byteLength);
  new Uint8Array(alternateBlobPart).set(alternateBytes);
  const replayForm = new FormData();
  Object.entries(upload.fields).forEach(([key, value]) => replayForm.append(key, value));
  replayForm.append("file", new Blob([alternateBlobPart], { type: validInput.contentType }), "logo.png");
  const replayResponse = await fetch(upload.url, { method: "POST", body: replayForm });
  assert.equal(replayResponse.ok, true);
  const finalResponse = await client.send(new GetObjectCommand({ Bucket: bucket, Key: validKey }));
  assert.ok(finalResponse.Body);
  const finalBytes = Buffer.from(await finalResponse.Body.transformToByteArray());
  assert.equal(createHash("sha256").update(finalBytes).digest("hex"), imageHash);

  const tamperedKey = `staging/${assetIds.tampered}`;
  const incorrectHash = "0".repeat(64);
  const tamperedInput = { ...validInput, sha256: incorrectHash };
  const tamperedUpload = await createBrandAssetUpload(tamperedInput, tamperedKey);
  const tamperedForm = new FormData();
  Object.entries(tamperedUpload.fields).forEach(([key, value]) => tamperedForm.append(key, value));
  tamperedForm.append("file", new Blob([imageBlobPart], { type: tamperedInput.contentType }), "tampered.png");
  const tamperedResponse = await fetch(tamperedUpload.url, { method: "POST", body: tamperedForm });
  assert.equal(tamperedResponse.ok, true);
  await assert.rejects(verifyBrandAssetUpload(tamperedInput, tamperedKey), (error: unknown) => error instanceof ApiError);

  const cleanup = await runBrandAssetCleanup({
    findAbandoned: async () => [{ id: assetIds.tampered, uploadKey: tamperedKey }],
    deleteObject: deleteBrandAssetObject,
    removeIfStillAbandoned: async () => true,
    now: () => new Date(Date.now() + BRAND_ASSET_LIMITS.abandonedUploadRetentionSeconds * 1_000),
  });
  assert.deepEqual(cleanup, { examined: 1, removed: 1, failed: 0 });
  await assert.rejects(client.send(new GetObjectCommand({ Bucket: bucket, Key: tamperedKey })));
  assert.ok(BRAND_ASSET_LIMITS.maximumBytes > imageBytes.byteLength);
});
