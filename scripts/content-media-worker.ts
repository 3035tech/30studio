import { CONTENT_MEDIA_WORKER } from "@/lib/constants";
import { runContentMediaWorker } from "@/lib/server/content-media-worker";

let stopping = false;
process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

async function waitForNextJob() {
  await new Promise((resolve) => setTimeout(resolve, CONTENT_MEDIA_WORKER.pollIntervalMilliseconds));
}

runContentMediaWorker(() => stopping, waitForNextJob).catch(() => {
  console.error("Content media worker stopped after an unrecoverable database error.");
  process.exitCode = 1;
});
