import "server-only";
import { createHash } from "node:crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { generateImage } from "ai";
import sharp from "sharp";
import { AI_PROVIDER_ENV, CONTENT_MEDIA_STATUS, CONTENT_MEDIA_WORKER, COPY_GENERATION } from "@/lib/constants";
import { claimNextContentMediaJob, completeContentMediaJob, expireExhaustedContentMediaJobs, failContentMediaJob } from "@/lib/db/repositories/calendar";
import { storeVerifiedBrandAsset } from "@/lib/server/brand-asset-storage";

export type ContentMediaJob = Awaited<ReturnType<typeof claimNextContentMediaJob>>;

async function renderAndStoreImage(job: NonNullable<ContentMediaJob>) {
  const apiKey = process.env[AI_PROVIDER_ENV.apiKey];
  if (!apiKey) throw new Error(CONTENT_MEDIA_STATUS.failed);

  const openai = createOpenAI({ apiKey });
  const { image } = await generateImage({
    model: openai.image(job.modelId),
    prompt: job.prompt,
    n: 1,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(COPY_GENERATION.imageTimeoutMilliseconds),
  });

  const imageBytes = Buffer.from(image.uint8Array);
  if (imageBytes.byteLength === 0 || imageBytes.byteLength > CONTENT_MEDIA_WORKER.maximumImageBytes) throw new Error(CONTENT_MEDIA_STATUS.failed);
  const imagePipeline = sharp(imageBytes, { limitInputPixels: CONTENT_MEDIA_WORKER.maximumImagePixels, animated: false });
  const metadata = await imagePipeline.metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > CONTENT_MEDIA_WORKER.maximumImagePixels || (metadata.pages ?? 1) > 1) {
    throw new Error(CONTENT_MEDIA_STATUS.failed);
  }
  const webp = await sharp(imageBytes, { limitInputPixels: CONTENT_MEDIA_WORKER.maximumImagePixels, animated: false })
    .webp({ quality: CONTENT_MEDIA_WORKER.outputQuality })
    .toBuffer();
  if (webp.byteLength === 0 || webp.byteLength > CONTENT_MEDIA_WORKER.maximumImageBytes) throw new Error(CONTENT_MEDIA_STATUS.failed);
  const sha256 = createHash("sha256").update(webp).digest("hex");
  await storeVerifiedBrandAsset({ contentType: "image/webp", sha256 }, job.objectKey, webp);
  const outputMetadata = await sharp(webp).metadata();
  if (!outputMetadata.width || !outputMetadata.height) throw new Error(CONTENT_MEDIA_STATUS.failed);
  return { contentType: "image/webp", sizeBytes: webp.byteLength, width: outputMetadata.width, height: outputMetadata.height, sha256 };
}

export async function processNextContentMediaJob(now = new Date()) {
  await expireExhaustedContentMediaJobs(now);
  const job = await claimNextContentMediaJob(now);
  if (!job) return false;
  if (!job.claimedAt) return true;

  try {
    const image = await renderAndStoreImage(job);
    await completeContentMediaJob({ organizationId: job.organizationId, id: job.id, claimedAt: job.claimedAt, ...image });
  } catch {
    await failContentMediaJob({ organizationId: job.organizationId, id: job.id, claimedAt: job.claimedAt, attempts: job.attempts }, new Date());
  }
  return true;
}

export async function runContentMediaWorker(shouldStop: () => boolean, onIdle: () => Promise<void>) {
  while (!shouldStop()) {
    const processed = await processNextContentMediaJob();
    if (!processed && !shouldStop()) await onIdle();
  }
}
