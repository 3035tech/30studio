import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS, LOCALES, SOCIAL_CONNECTION, TENANT_PERMISSIONS } from "@/lib/constants";
import type { SocialPlatform } from "@/lib/constants";
import { createSocialOAuthState, listSocialConnections } from "@/lib/db/repositories/social-connections";
import { ApiError } from "@/lib/server/api-error";
import { apiErrorResponse } from "@/lib/server/api-response";
import { assertSameOriginJsonRequest, requireTenant } from "@/lib/server/auth";
import { createSocialAuthorizationUrl, getSocialConnector, isSocialConnectorConfigured, isSupportedSocialPlatform } from "@/lib/server/social-connectors";
import { encryptSocialSecret, isSocialTokenEncryptionConfigured } from "@/lib/server/social-token-crypto";
import * as oauth from "oauth4webapi";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ brandId: string }> };
const startSchema = z.object({ platform: z.string(), locale: z.enum(LOCALES) }).strict();

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsRead);
    const { brandId } = await context.params;
    if (!z.string().uuid().safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const connections = await listSocialConnections(tenant.organizationId, brandId);
    return NextResponse.json({ data: connections }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error, request); }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tenant = await requireTenant(request, TENANT_PERMISSIONS.brandsManage);
    assertSameOriginJsonRequest(request);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.badRequest); }
    const parsed = startSchema.safeParse(body);
    if (!parsed.success || !isSupportedSocialPlatform(parsed.data.platform)) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const platform: SocialPlatform = parsed.data.platform;
    const connector = getSocialConnector(platform);
    if (!connector || !isSocialConnectorConfigured(platform) || !process.env.STUDIO_PUBLIC_ORIGIN || !isSocialTokenEncryptionConfigured()) throw new ApiError(API_ERROR_CODES.socialConnectorUnavailable, HTTP_STATUS.unavailable);
    const { brandId } = await context.params;
    if (!z.string().uuid().safeParse(brandId).success) throw new ApiError(API_ERROR_CODES.invalidRequest, HTTP_STATUS.unprocessable);
    const state = oauth.generateRandomState();
    const codeVerifier = connector.config.supportsPkce ? oauth.generateRandomCodeVerifier() : null;
    const nonce = connector.config.nonce ? oauth.generateRandomNonce() : null;
    const origin = new URL(process.env.STUDIO_PUBLIC_ORIGIN);
    const callback = new URL(SOCIAL_CONNECTION.callbackPath, origin);
    const saved = await createSocialOAuthState({
      stateHash: await oauth.calculatePKCECodeChallenge(state), organizationId: tenant.organizationId, brandId,
      platform, initiatedBy: tenant.userId, locale: parsed.data.locale,
      codeVerifierCiphertext: codeVerifier ? encryptSocialSecret(codeVerifier).ciphertext : null,
      nonceCiphertext: nonce ? encryptSocialSecret(nonce).ciphertext : null,
      expiresAt: new Date(Date.now() + SOCIAL_CONNECTION.oauthStateLifetimeMilliseconds),
    });
    if (!saved) throw new ApiError(API_ERROR_CODES.brandNotFound, HTTP_STATUS.notFound);
    const authorizationUrl = await createSocialAuthorizationUrl(connector, state, codeVerifier, nonce, callback.toString());
    return NextResponse.json({ data: { authorizationUrl: authorizationUrl.toString() } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error, request); }
}
