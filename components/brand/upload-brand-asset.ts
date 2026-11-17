import { BRAND_ASSET_LIMITS, BRAND_ASSET_ACTIONS, getBrandAssetActionApiPath, getBrandAssetsApiPath, type BrandAssetKind } from "@/lib/constants";
import { brandAssetUploadSessionResponseSchema } from "@/lib/validation/brand-assets";

async function readJson(response: Response): Promise<unknown> {
  let result: unknown;
  try { result = await response.json(); } catch { throw new Error("invalid-response"); }
  if (!response.ok) throw new Error("request-failed");
  return result;
}

export async function uploadBrandAssetFile(brandId: string, file: File, options: { kind: BrandAssetKind; altText?: string | null }) {
  const allowedMimeTypes: readonly string[] = BRAND_ASSET_LIMITS.allowedMimeTypes;
  if (file.size > BRAND_ASSET_LIMITS.maximumBytes || !allowedMimeTypes.includes(file.type)) {
    throw new Error("unsupported-image");
  }

  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const sessionResponse = await fetch(getBrandAssetsApiPath(brandId), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      sha256,
      kind: options.kind,
      sourceUrl: null,
      license: null,
      rightsExpiresAt: null,
      altText: options.altText ?? null,
    }),
  });
  const session = brandAssetUploadSessionResponseSchema.parse(await readJson(sessionResponse));
  const form = new FormData();
  Object.entries(session.data.upload.fields).forEach(([field, value]) => form.append(field, value));
  form.append("file", file, file.name);
  let storageResponse: Response;
  try {
    storageResponse = await fetch(session.data.upload.url, { method: "POST", body: form, credentials: "omit" });
  } catch {
    await reportUploadFailure(brandId, session.data.id, "network", null);
    throw new Error("upload-failed");
  }
  if (!storageResponse.ok) {
    await reportUploadFailure(brandId, session.data.id, "storage_rejected", storageResponse.status);
    throw new Error("upload-failed");
  }

  const finalizeResponse = await fetch(getBrandAssetActionApiPath(brandId, session.data.id, BRAND_ASSET_ACTIONS.finalize), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  await readJson(finalizeResponse);
}

async function reportUploadFailure(brandId: string, assetId: string, failure: "network" | "storage_rejected", status: number | null) {
  await fetch(`${getBrandAssetsApiPath(brandId)}/${encodeURIComponent(assetId)}/upload-failure`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ failure, status }),
  }).catch(() => undefined);
}
