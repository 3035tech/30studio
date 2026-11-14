import "server-only";
import { createHash } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, type HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import sharp from "sharp";
import { API_ERROR_CODES, BRAND_ASSET_ENV, BRAND_ASSET_LIMITS, HTTP_STATUS } from "@/lib/constants";
import type { BrandAssetUpload } from "@/lib/validation/brand-assets";
import { ApiError } from "@/lib/server/api-error";

const MIME_BY_FORMAT = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export type VerifiedBrandImage = { width: number; height: number; bytes: Buffer };

function getStorageConfig() {
  const bucket = process.env[BRAND_ASSET_ENV.bucket];
  const region = process.env[BRAND_ASSET_ENV.region];
  const endpoint = process.env[BRAND_ASSET_ENV.endpoint];
  if (!bucket || !region) throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
  if (endpoint) {
    try {
      const parsedEndpoint = new URL(endpoint);
      if (!(["http:", "https:"].includes(parsedEndpoint.protocol) && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsedEndpoint.hostname))) {
        throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
      }
    } catch {
      throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
    }
  }
  return { bucket, region, endpoint };
}

let clientState: { key: string; client: S3Client } | undefined;
function getS3Client() {
  const config = getStorageConfig();
  const key = `${config.region}:${config.endpoint ?? "aws"}`;
  if (clientState?.key !== key) {
    clientState?.client.destroy();
    clientState = {
      key,
      client: new S3Client({
        region: config.region,
        ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
      }),
    };
  }
  return { bucket: config.bucket, client: clientState.client };
}

export function assertBrandAssetStorageConfigured() {
  getStorageConfig();
}

export async function createBrandAssetUpload(asset: Pick<BrandAssetUpload, "contentType" | "sha256">, objectKey: string) {
  const { bucket, client } = getS3Client();
  return createPresignedPost(client, {
    Bucket: bucket,
    Key: objectKey,
    Expires: BRAND_ASSET_LIMITS.uploadExpirySeconds,
    Fields: { key: objectKey, "Content-Type": asset.contentType, "x-amz-meta-sha256": asset.sha256 },
    Conditions: [
      ["content-length-range", 1, BRAND_ASSET_LIMITS.maximumBytes],
      ["eq", "$key", objectKey],
      ["eq", "$Content-Type", asset.contentType],
      ["eq", "$x-amz-meta-sha256", asset.sha256],
    ],
  });
}

export async function verifyBrandAssetUpload(input: Pick<BrandAssetUpload, "contentType" | "sha256" | "sizeBytes">, uploadKey: string): Promise<VerifiedBrandImage> {
  const { bucket, client } = getS3Client();
  let head: HeadObjectCommandOutput;
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: uploadKey }));
  } catch {
    throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
  }
  if (head.ContentLength !== input.sizeBytes || head.ContentType !== input.contentType || head.Metadata?.sha256 !== input.sha256 || head.ContentLength > BRAND_ASSET_LIMITS.maximumBytes) {
    throw new ApiError(API_ERROR_CODES.brandAssetInvalid, HTTP_STATUS.unprocessable);
  }

  let bytes: Buffer;
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: uploadKey }));
    if (!response.Body) throw new ApiError(API_ERROR_CODES.brandAssetInvalid, HTTP_STATUS.unprocessable);
    bytes = Buffer.from(await response.Body.transformToByteArray());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
  }
  if (bytes.byteLength !== input.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== input.sha256) {
    throw new ApiError(API_ERROR_CODES.brandAssetInvalid, HTTP_STATUS.unprocessable);
  }

  try {
    const decodeOptions = { limitInputPixels: BRAND_ASSET_LIMITS.maximumImagePixels, animated: false } as const;
    const metadata = await sharp(bytes, decodeOptions).metadata();
    const detectedContentType = metadata.format ? MIME_BY_FORMAT[metadata.format as keyof typeof MIME_BY_FORMAT] : undefined;
    if (!detectedContentType || detectedContentType !== input.contentType || !metadata.width || !metadata.height || metadata.width * metadata.height > BRAND_ASSET_LIMITS.maximumImagePixels || (metadata.pages ?? 1) > 1) {
      throw new Error("Uploaded image content was invalid or unsupported.");
    }
    await sharp(bytes, decodeOptions).stats();
    return { width: metadata.width, height: metadata.height, bytes };
  } catch {
    throw new ApiError(API_ERROR_CODES.brandAssetInvalid, HTTP_STATUS.unprocessable);
  }
}

export async function storeVerifiedBrandAsset(input: Pick<BrandAssetUpload, "contentType" | "sha256">, objectKey: string, bytes: Buffer) {
  const { bucket, client } = getS3Client();
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: bytes,
      ContentLength: bytes.byteLength,
      ContentType: input.contentType,
      Metadata: { sha256: input.sha256 },
      ChecksumSHA256: Buffer.from(input.sha256, "hex").toString("base64"),
    }));
  } catch {
    throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
  }
}

export async function deleteBrandAssetObject(objectKey: string) {
  const { bucket, client } = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}

export async function createBrandAssetDownload(objectKey: string, fileName: string, contentType: string) {
  const { bucket, client } = getS3Client();
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    ResponseContentType: contentType,
  }), { expiresIn: BRAND_ASSET_LIMITS.downloadExpirySeconds });
}
