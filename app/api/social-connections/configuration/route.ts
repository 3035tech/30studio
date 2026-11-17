import { NextRequest, NextResponse } from "next/server";
import { TENANT_PERMISSIONS } from "@/lib/constants";
import { apiErrorResponse } from "@/lib/server/api-response";
import { requireTenant } from "@/lib/server/auth";
import { getSocialConnectorAvailability } from "@/lib/server/social-connectors";
import { getSocialPublisherCapabilities } from "@/lib/server/social-publisher/registry";
import { isSocialTokenEncryptionConfigured } from "@/lib/server/social-token-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireTenant(request, TENANT_PERMISSIONS.brandsRead);
    const capabilities = new Map(getSocialPublisherCapabilities().map((capability) => [capability.platform, capability]));
    const data = getSocialConnectorAvailability().map((provider) => ({
      ...provider, configured: provider.configured && isSocialTokenEncryptionConfigured(),
      publication: capabilities.get(provider.platform)?.publication ?? "connection_only",
      maximumTextCharacters: capabilities.get(provider.platform)?.maximumTextCharacters ?? null,
    }));
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error, request); }
}
