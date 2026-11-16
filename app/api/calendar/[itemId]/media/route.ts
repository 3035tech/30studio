import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AI_PROVIDER_ENV, API_ERROR_CODES, BRAND_ASSET_ENV, CONTENT_MEDIA_GENERATION_MODE, CONTENT_MEDIA_TEMPLATE, HTTP_STATUS, TENANT_PERMISSIONS } from "@/lib/constants";
import { enqueueContentCarouselGeneration, enqueueContentMediaGeneration, listContentMediaForVersion } from "@/lib/db/repositories/calendar";
import { getCalendarContentVersions } from "@/lib/db/repositories/calendar";
import { ApiError } from "@/lib/server/api-error";
import { assertBrandAssetStorageConfigured, createBrandAssetDownload } from "@/lib/server/brand-asset-storage";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { createContentCarouselPrompts, createContentImagePrompt, createContentTextCardPrompt } from "@/lib/server/content-media-prompt";
import { hasTenantPermission } from "@/lib/server/permissions";
import { contentMediaGenerationRequestSchema, contentMediaGenerationResponseSchema, contentMediaResponseSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };
const itemIdSchema = z.uuid();

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentRead);
    const { itemId } = await context.params;
    const versionId = request.nextUrl.searchParams.get("versionId");
    if (!itemIdSchema.safeParse(itemId).success || !versionId || !itemIdSchema.safeParse(versionId).success) {
      throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    }
    const assets = await listContentMediaForVersion(tenant.organizationId, itemId, versionId);
    const data = await Promise.all(assets.map(async (asset) => ({
      id: asset.id,
      carouselId: asset.carouselId,
      pageNumber: asset.pageNumber,
      pageCount: asset.pageCount,
      status: asset.status,
      fileName: asset.fileName,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      createdAt: asset.createdAt,
      createdByName: asset.createdByName,
      reviewedAt: asset.reviewedAt,
      previewUrl: asset.contentType && asset.width && asset.height ? await createBrandAssetDownload(asset.objectKey, asset.fileName, asset.contentType) : null,
    })));
    const parsed = contentMediaResponseSchema.safeParse({
      data,
      canManage: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.contentManage),
      canReview: hasTenantPermission(tenant.role, TENANT_PERMISSIONS.contentApprove),
    });
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.internalError, HTTP_STATUS.internalError);
    return NextResponse.json(parsed.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.contentManage);
    assertSameOriginJsonRequest(request);
    const { itemId } = await context.params;
    if (!itemIdSchema.safeParse(itemId).success) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = contentMediaGenerationRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);

    const isCarousel = parsed.data.mode === CONTENT_MEDIA_GENERATION_MODE.carousel;
    const isTextCard = parsed.data.mode === CONTENT_MEDIA_GENERATION_MODE.textCard || isCarousel;
    const modelId = isTextCard ? CONTENT_MEDIA_TEMPLATE.textCardModelId : process.env[AI_PROVIDER_ENV.imageModel];
    const apiKey = process.env[AI_PROVIDER_ENV.apiKey];
    const bucket = process.env[BRAND_ASSET_ENV.bucket];
    const region = process.env[BRAND_ASSET_ENV.region];
    if (!modelId || (!isTextCard && !apiKey) || !bucket || !region) {
      throw new ApiError(API_ERROR_CODES.contentMediaGenerationUnavailable, HTTP_STATUS.unavailable);
    }
    assertBrandAssetStorageConfigured();

    const [current] = await getCalendarContentVersions(tenant.organizationId, itemId).then((result) => result?.current ? [result.current] : []);
    if (!current || current.id !== parsed.data.contentVersionId) {
      throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    }
    const prompt = isCarousel
      ? await createContentCarouselPrompts(tenant.organizationId, itemId, current.id, parsed.data.pageCopies)
      : isTextCard
      ? await createContentTextCardPrompt(tenant.organizationId, itemId, current.id)
      : await createContentImagePrompt(tenant.organizationId, itemId, current.id);
    if (!prompt) throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    const commonInput = {
      organizationId: tenant.organizationId,
      itemId,
      contentVersionId: current.id,
      idempotencyKey: parsed.data.idempotencyKey,
      userId: tenant.userId,
      modelId,
    };
    const result = isCarousel
      ? await enqueueContentCarouselGeneration({ ...commonInput, prompts: prompt as string[] })
      : await enqueueContentMediaGeneration({ ...commonInput, prompt: prompt as string });
    if (result.kind === "not_found") throw new ApiError(API_ERROR_CODES.calendarItemNotFound, HTTP_STATUS.notFound);
    if (result.kind === "conflict") throw new ApiError(API_ERROR_CODES.contentMediaConflict, HTTP_STATUS.conflict);
    if (result.kind === "limit") throw new ApiError(API_ERROR_CODES.contentMediaLimitReached, HTTP_STATUS.conflict);

    const response = contentMediaGenerationResponseSchema.safeParse({ data: { id: result.assetId, status: result.status } });
    if (!response.success) throw new ApiError(API_ERROR_CODES.internalError, HTTP_STATUS.internalError);
    return NextResponse.json(response.data, {
      status: result.kind === "existing" ? HTTP_STATUS.ok : HTTP_STATUS.accepted,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
