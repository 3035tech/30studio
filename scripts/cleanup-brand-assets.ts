import { closeDatabase } from "@/lib/db/client";
import { runBrandAssetCleanup } from "@/lib/server/brand-asset-cleanup";

async function main() {
  try {
    const result = await runBrandAssetCleanup();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void main().catch(() => {
  process.stderr.write("Brand asset cleanup failed. Check the sanitized application logs.\n");
  process.exitCode = 1;
});
