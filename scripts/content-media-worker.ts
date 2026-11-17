import { CONTENT_MEDIA_WORKER } from "@/lib/constants";
import { runContentMediaWorker } from "@/lib/server/content-media-worker";
import { logOperationalError } from "@/lib/server/operational-logger";

let stopping = false;
process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

async function waitForNextJob() {
  await new Promise((resolve) => setTimeout(resolve, CONTENT_MEDIA_WORKER.pollIntervalMilliseconds));
}

runContentMediaWorker(() => stopping, waitForNextJob).catch((error) => {
  logOperationalError("worker.content_media.stopped", error);
  process.exitCode = 1;
});
