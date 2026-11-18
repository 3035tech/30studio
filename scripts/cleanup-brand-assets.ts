import { closeDatabase } from "@/lib/db/client";
import { runBrandAssetCleanup } from "@/lib/server/brand-asset-cleanup";
import { runContentMediaUploadCleanup } from "@/lib/server/content-media-upload-cleanup";

async function main() {
  try {
    const [brandAssets, contentMediaUploads] = await Promise.all([runBrandAssetCleanup(), runContentMediaUploadCleanup()]);
    process.stdout.write(`${JSON.stringify({ brandAssets, contentMediaUploads })}\n`);
    if (brandAssets.failed > 0 || contentMediaUploads.failed > 0) process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void main().catch(() => {
  process.stderr.write("Brand asset cleanup failed. Check the sanitized application logs.\n");
  process.exitCode = 1;
});
