import { competitorWorkerPollIntervalMilliseconds, runCompetitorWorker } from "@/lib/server/competitor-worker";
import { logOperationalError } from "@/lib/server/operational-logger";

let stopping = false;
process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

async function waitForNextJob() {
  await new Promise((resolve) => setTimeout(resolve, competitorWorkerPollIntervalMilliseconds));
}

runCompetitorWorker(() => stopping, waitForNextJob).catch((error) => {
  logOperationalError("worker.competitor.stopped", error);
  process.exitCode = 1;
});
