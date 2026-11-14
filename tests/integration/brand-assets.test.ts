import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET as listAssetsRoute } from "@/app/api/brands/[brandId]/assets/route";
import { POST as reviewAssetRoute } from "@/app/api/brands/[brandId]/assets/[assetId]/review/route";
import { GET as downloadAssetRoute } from "@/app/api/brands/[brandId]/assets/[assetId]/download/route";
import { API_ERROR_CODES, BRAND_ASSET_KINDS, BRAND_ASSET_STATUS, BRAND_ASSET_REVIEW_DECISION, BRAND_ASSET_REVIEW_DECISIONS, BETTER_AUTH_ENV, HTTP_STATUS, TENANT_ROLE } from "@/lib/constants";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { brandAssetReviews, brandAssets, member, organization, session, user } from "@/lib/db/schema";
import { createBrand } from "@/lib/db/repositories/brands";
import { getAuth } from "@/lib/server/better-auth";
import { brandAssetsResponseSchema } from "@/lib/validation/brand-assets";

const TEST_ORIGIN = "http://localhost:3000";
const TEST_EMAIL = `brand-assets-owner-${crypto.randomUUID()}@example.invalid`;
const TEST_PASSWORD = "brand-assets-test-password-30studio";
const TEST_SECRET = "30studio-brand-assets-test-secret-is-not-used-outside-tests";
const ORGANIZATION_IDS = {
  active: `brand-assets-active-${crypto.randomUUID()}`,
  other: `brand-assets-other-${crypto.randomUUID()}`,
} as const;
const ASSET_IDS = { approved: crypto.randomUUID(), pending: crypto.randomUUID(), other: crypto.randomUUID() } as const;

let ownerId = "";
let sessionToken = "";
let sessionCookie = "";
let activeBrandId = "";
let otherBrandId = "";

before(async () => {
  process.env[BETTER_AUTH_ENV.secret] = TEST_SECRET;
  process.env[BETTER_AUTH_ENV.url] = TEST_ORIGIN;
  process.env[BETTER_AUTH_ENV.trustedOrigins] = TEST_ORIGIN;
  process.env.STUDIO_PUBLIC_ORIGIN = TEST_ORIGIN;
  process.env.SMTP_HOST ??= "127.0.0.1";
  process.env.SMTP_PORT ??= "1025";
  process.env.SMTP_SECURE ??= "false";
  process.env.SMTP_REQUIRE_TLS ??= "false";
  process.env.MAIL_FROM_EMAIL ??= "30studio@example.invalid";

  const auth = getAuth();
  const signUpResponse = await auth.handler(new Request(`${TEST_ORIGIN}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: TEST_ORIGIN },
    body: JSON.stringify({ name: "Brand assets owner", email: TEST_EMAIL, password: TEST_PASSWORD }),
  }));
  assert.equal(signUpResponse.status, HTTP_STATUS.ok);
  const signUp = await signUpResponse.json() as { user: { id: string } };
  ownerId = signUp.user.id;
  await getDatabase().update(user).set({ emailVerified: true }).where(eq(user.id, ownerId));

  const signInResponse = await auth.handler(new Request(`${TEST_ORIGIN}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: TEST_ORIGIN },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  }));
  assert.equal(signInResponse.status, HTTP_STATUS.ok);
  const signIn = await signInResponse.json() as { token: string };
  sessionToken = signIn.token;
  const cookie = signInResponse.headers.getSetCookie().find((value) => value.includes("better-auth.session_token="));
  assert.ok(cookie);
  sessionCookie = cookie.split(";", 1)[0] ?? "";

  const createdAt = new Date();
  await getDatabase().insert(organization).values([
    { id: ORGANIZATION_IDS.active, name: "Active brand assets tenant", slug: ORGANIZATION_IDS.active, createdAt },
    { id: ORGANIZATION_IDS.other, name: "Other brand assets tenant", slug: ORGANIZATION_IDS.other, createdAt },
  ]);
  await getDatabase().insert(member).values({
    id: `brand-assets-owner-${crypto.randomUUID()}`,
    organizationId: ORGANIZATION_IDS.active,
    userId: ownerId,
    role: TENANT_ROLE.owner,
    createdAt,
  });
  await getDatabase().update(session).set({ activeOrganizationId: ORGANIZATION_IDS.active }).where(eq(session.token, sessionToken));
  const activeBrand = await createBrand({ name: "Active assets brand" }, ORGANIZATION_IDS.active, ownerId);
  const otherBrand = await createBrand({ name: "Other assets brand" }, ORGANIZATION_IDS.other, ownerId);
  assert.ok(activeBrand);
  assert.ok(otherBrand);
  activeBrandId = activeBrand.id;
  otherBrandId = otherBrand.id;

  await getDatabase().insert(brandAssets).values([
    { id: ASSET_IDS.approved, organizationId: ORGANIZATION_IDS.active, brandId: activeBrandId, createdBy: ownerId, objectKey: `test/${ASSET_IDS.approved}`, uploadKey: `staging/test/${ASSET_IDS.approved}`, kind: BRAND_ASSET_KINDS[0], status: BRAND_ASSET_STATUS.approved, fileName: "approved.png", contentType: "image/png", sizeBytes: 10, width: 2, height: 2, sha256: "a".repeat(64), sourceUrl: "https://example.com/logo", license: "Owned", altText: "Approved logo" },
    { id: ASSET_IDS.pending, organizationId: ORGANIZATION_IDS.active, brandId: activeBrandId, createdBy: ownerId, objectKey: `test/${ASSET_IDS.pending}`, uploadKey: `staging/test/${ASSET_IDS.pending}`, kind: BRAND_ASSET_KINDS[1], status: BRAND_ASSET_STATUS.pendingReview, fileName: "pending.png", contentType: "image/png", sizeBytes: 12, width: 2, height: 3, sha256: "b".repeat(64), sourceUrl: null, license: null, altText: null },
    { id: ASSET_IDS.other, organizationId: ORGANIZATION_IDS.other, brandId: otherBrandId, createdBy: ownerId, objectKey: `test/${ASSET_IDS.other}`, uploadKey: `staging/test/${ASSET_IDS.other}`, kind: BRAND_ASSET_KINDS[0], status: BRAND_ASSET_STATUS.approved, fileName: "private.png", contentType: "image/png", sizeBytes: 10, width: 2, height: 2, sha256: "c".repeat(64), sourceUrl: null, license: null, altText: null },
  ]);
});

after(async () => {
  try {
    await getDatabase().delete(organization).where(inArray(organization.id, Object.values(ORGANIZATION_IDS)));
    if (ownerId) await getDatabase().delete(user).where(eq(user.id, ownerId));
  } finally {
    await closeDatabase();
  }
});

test("brand asset visibility and decisions remain inside the active tenant", async () => {
  const headers = { cookie: sessionCookie };
  const listRequest = (brandId: string) => listAssetsRoute(
    new NextRequest(`${TEST_ORIGIN}/api/brands/${brandId}/assets`, { headers }),
    { params: Promise.resolve({ brandId }) },
  );
  const managerResponse = await listRequest(activeBrandId);
  assert.equal(managerResponse.status, HTTP_STATUS.ok);
  const managerAssets = brandAssetsResponseSchema.parse(await managerResponse.json());
  assert.equal(managerAssets.canManage, true);
  assert.deepEqual(new Set(managerAssets.data.map((asset) => asset.id)), new Set([ASSET_IDS.approved, ASSET_IDS.pending]));
  assert.equal((await listRequest(otherBrandId)).status, HTTP_STATUS.notFound);

  const crossTenantDownload = await downloadAssetRoute(new NextRequest(`${TEST_ORIGIN}/api/brands/${otherBrandId}/assets/${ASSET_IDS.other}/download`, { headers }), {
    params: Promise.resolve({ brandId: otherBrandId, assetId: ASSET_IDS.other }),
  });
  assert.equal(crossTenantDownload.status, HTTP_STATUS.notFound);
  assert.equal((await crossTenantDownload.json() as { code: string }).code, API_ERROR_CODES.brandAssetNotFound);

  const approval = await reviewAssetRoute(new NextRequest(`${TEST_ORIGIN}/api/brands/${activeBrandId}/assets/${ASSET_IDS.pending}/review`, {
    method: "POST",
    headers: { cookie: sessionCookie, origin: TEST_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ decision: BRAND_ASSET_REVIEW_DECISION.approved, note: "Verified against the official logo source." }),
  }), { params: Promise.resolve({ brandId: activeBrandId, assetId: ASSET_IDS.pending }) });
  assert.equal(approval.status, HTTP_STATUS.ok);
  const reviewHistory = await getDatabase().select().from(brandAssetReviews).where(and(
    eq(brandAssetReviews.organizationId, ORGANIZATION_IDS.active),
    eq(brandAssetReviews.brandId, activeBrandId),
    eq(brandAssetReviews.assetId, ASSET_IDS.pending),
  ));
  assert.equal(reviewHistory.length, BRAND_ASSET_REVIEW_DECISIONS.length - 1);

  await getDatabase().update(member).set({ role: TENANT_ROLE.analyst }).where(eq(member.userId, ownerId));
  const analystAssets = brandAssetsResponseSchema.parse(await (await listRequest(activeBrandId)).json());
  assert.equal(analystAssets.canManage, false);
  assert.equal(analystAssets.data.length, 2);

  const deniedReview = await reviewAssetRoute(new NextRequest(`${TEST_ORIGIN}/api/brands/${activeBrandId}/assets/${ASSET_IDS.approved}/review`, {
    method: "POST",
    headers: { cookie: sessionCookie, origin: TEST_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ decision: BRAND_ASSET_REVIEW_DECISION.rejected, note: null }),
  }), { params: Promise.resolve({ brandId: activeBrandId, assetId: ASSET_IDS.approved }) });
  assert.equal(deniedReview.status, HTTP_STATUS.forbidden);
});
