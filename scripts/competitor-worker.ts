import { competitorWorkerPollIntervalMilliseconds, runCompetitorWorker } from "@/lib/server/competitor-worker";

let stopping = false;
process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

async function waitForNextJob() {
  await new Promise((resolve) => setTimeout(resolve, competitorWorkerPollIntervalMilliseconds));
}

runCompetitorWorker(() => stopping, waitForNextJob).catch(() => {
  console.error("Competitor research worker stopped after an unrecoverable database error.");
  process.exitCode = 1;
});
