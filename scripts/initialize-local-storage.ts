import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { BRAND_ASSET_ENV, LOCAL_DEVELOPMENT } from "@/lib/constants";

const endpoint = process.env[BRAND_ASSET_ENV.endpoint];
const bucket = process.env[BRAND_ASSET_ENV.bucket];
if (process.env.NODE_ENV !== "development" || endpoint !== LOCAL_DEVELOPMENT.objectStorageEndpoint || bucket !== LOCAL_DEVELOPMENT.objectStorageBucket) {
  throw new Error("Local object storage initialization is restricted to the 30studio Docker development stack.");
}

const client = new S3Client({
  region: process.env[BRAND_ASSET_ENV.region] ?? LOCAL_DEVELOPMENT.region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
} catch {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
}
client.destroy();
