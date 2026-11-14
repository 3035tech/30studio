import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET as listBrandKitRoute, POST as createBrandKitRoute } from "@/app/api/brands/[brandId]/brand-kit/route";
import { POST as approveBrandKitRoute } from "@/app/api/brands/[brandId]/brand-kit/[versionId]/approve/route";
import { BETTER_AUTH_ENV, BRAND_KIT_LIMITS, BRAND_KIT_VERSION_STATUS, HTTP_STATUS, TENANT_ROLE } from "@/lib/constants";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { brandKitVersions, member, organization, session, user } from "@/lib/db/schema";
import { createBrand } from "@/lib/db/repositories/brands";
import { getAuth } from "@/lib/server/better-auth";
import { brandKitVersionSchema, brandKitVersionsResponseSchema } from "@/lib/validation/brand-kits";

const TEST_ORIGIN = "http://localhost:3000";
const TEST_EMAIL = `brand-kit-owner-${crypto.randomUUID()}@example.invalid`;
const TEST_PASSWORD = "brand-kit-test-password-30studio";
const TEST_SECRET = "30studio-brand-kit-test-secret-is-not-used-outside-tests";
const ORGANIZATION_IDS = {
  active: `brand-kit-active-${crypto.randomUUID()}`,
  other: `brand-kit-other-${crypto.randomUUID()}`,
} as const;

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
    body: JSON.stringify({ name: "Brand Kit owner", email: TEST_EMAIL, password: TEST_PASSWORD }),
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
    { id: ORGANIZATION_IDS.active, name: "Active Brand Kit tenant", slug: ORGANIZATION_IDS.active, createdAt },
    { id: ORGANIZATION_IDS.other, name: "Other Brand Kit tenant", slug: ORGANIZATION_IDS.other, createdAt },
  ]);
  await getDatabase().insert(member).values({
    id: `brand-kit-owner-${crypto.randomUUID()}`,
    organizationId: ORGANIZATION_IDS.active,
    userId: ownerId,
    role: TENANT_ROLE.owner,
    createdAt,
  });
  await getDatabase().update(session).set({ activeOrganizationId: ORGANIZATION_IDS.active }).where(eq(session.token, sessionToken));
  const activeBrand = await createBrand({ name: "Active tenant brand" }, ORGANIZATION_IDS.active, ownerId);
  const otherBrand = await createBrand({ name: "Other tenant brand" }, ORGANIZATION_IDS.other, ownerId);
  assert.ok(activeBrand);
  assert.ok(otherBrand);
  activeBrandId = activeBrand.id;
  otherBrandId = otherBrand.id;
});

after(async () => {
  try {
    await getDatabase().delete(organization).where(inArray(organization.id, Object.values(ORGANIZATION_IDS)));
    if (ownerId) await getDatabase().delete(user).where(eq(user.id, ownerId));
  } finally {
    await closeDatabase();
  }
});

test("Brand Kit snapshots are tenant-scoped, immutable, and require approval", async () => {
  const headers = { cookie: sessionCookie };
  const listRequest = (brandId: string) => listBrandKitRoute(new NextRequest(`${TEST_ORIGIN}/api/brands/${brandId}/brand-kit`, { headers }), { params: Promise.resolve({ brandId }) });
  const createRequest = (brandId: string, content: unknown) => createBrandKitRoute(new NextRequest(`${TEST_ORIGIN}/api/brands/${brandId}/brand-kit`, {
    method: "POST",
    headers: { cookie: sessionCookie, origin: TEST_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(content),
  }), { params: Promise.resolve({ brandId }) });
  const content = {
    audience: "School operators",
    toneOfVoice: "Practical and clear",
    colors: ["#6A00FF"],
    fontFamilies: ["Inter"],
    keyMessages: ["Simplify recurring billing"],
    products: ["Payment management"],
    verifiedFacts: [{ statement: "Supports recurring payments", sourceUrl: "https://example.com/features" }],
    restrictedClaims: ["Guaranteed revenue"],
    callsToAction: ["Book a demo"],
  };

  const emptyResponse = await listRequest(activeBrandId);
  assert.equal(emptyResponse.status, HTTP_STATUS.ok);
  assert.deepEqual(brandKitVersionsResponseSchema.parse(await emptyResponse.json()).data, []);

  const invalidResponse = await createRequest(activeBrandId, { ...content, colors: ["violet"] });
  assert.equal(invalidResponse.status, HTTP_STATUS.unprocessable);

  const firstCreateResponse = await createRequest(activeBrandId, content);
  assert.equal(firstCreateResponse.status, HTTP_STATUS.created);
  const firstCreate = await firstCreateResponse.json() as { data: unknown };
  const firstVersion = brandKitVersionSchema.parse(firstCreate.data);
  assert.equal(firstVersion.version, BRAND_KIT_LIMITS.initialVersion + BRAND_KIT_LIMITS.versionIncrement);
  assert.equal(firstVersion.status, BRAND_KIT_VERSION_STATUS.draft);

  const firstApproveResponse = await approveBrandKitRoute(new NextRequest(`${TEST_ORIGIN}/api/brands/${activeBrandId}/brand-kit/${firstVersion.id}/approve`, {
    method: "POST", headers: { cookie: sessionCookie, origin: TEST_ORIGIN },
  }), { params: Promise.resolve({ brandId: activeBrandId, versionId: firstVersion.id }) });
  assert.equal(firstApproveResponse.status, HTTP_STATUS.ok);
  assert.equal(brandKitVersionSchema.parse((await firstApproveResponse.json() as { data: unknown }).data).status, BRAND_KIT_VERSION_STATUS.approved);

  const secondContent = { ...content, keyMessages: ["Protect time for students"] };
  const secondCreateResponse = await createRequest(activeBrandId, secondContent);
  assert.equal(secondCreateResponse.status, HTTP_STATUS.created);
  const secondVersion = brandKitVersionSchema.parse((await secondCreateResponse.json() as { data: unknown }).data);
  assert.equal(secondVersion.version, firstVersion.version + BRAND_KIT_LIMITS.versionIncrement);
  assert.equal(secondVersion.status, BRAND_KIT_VERSION_STATUS.draft);

  const staleApproveResponse = await approveBrandKitRoute(new NextRequest(`${TEST_ORIGIN}/api/brands/${activeBrandId}/brand-kit/${firstVersion.id}/approve`, {
    method: "POST", headers: { cookie: sessionCookie, origin: TEST_ORIGIN },
  }), { params: Promise.resolve({ brandId: activeBrandId, versionId: firstVersion.id }) });
  assert.equal(staleApproveResponse.status, HTTP_STATUS.notFound);

  const secondApproveResponse = await approveBrandKitRoute(new NextRequest(`${TEST_ORIGIN}/api/brands/${activeBrandId}/brand-kit/${secondVersion.id}/approve`, {
    method: "POST", headers: { cookie: sessionCookie, origin: TEST_ORIGIN },
  }), { params: Promise.resolve({ brandId: activeBrandId, versionId: secondVersion.id }) });
  assert.equal(secondApproveResponse.status, HTTP_STATUS.ok);

  const historyResponse = await listRequest(activeBrandId);
  const history = brandKitVersionsResponseSchema.parse(await historyResponse.json()).data;
  assert.deepEqual(history.map((version) => version.version), [2, 1]);
  assert.equal(history[0]?.content.keyMessages[0], "Protect time for students");
  assert.equal(history[1]?.content.keyMessages[0], "Simplify recurring billing");
  assert.equal(history[1]?.status, BRAND_KIT_VERSION_STATUS.superseded);
  assert.equal(history[0]?.status, BRAND_KIT_VERSION_STATUS.approved);

  const otherTenantResponse = await listRequest(otherBrandId);
  assert.equal(otherTenantResponse.status, HTTP_STATUS.notFound);

  const concurrentDraftResponses = await Promise.all([
    createRequest(activeBrandId, content),
    createRequest(activeBrandId, secondContent),
  ]);
  assert.deepEqual(concurrentDraftResponses.map((response) => response.status), [HTTP_STATUS.created, HTTP_STATUS.created]);
  const concurrentDrafts = await Promise.all(concurrentDraftResponses.map(async (response) => brandKitVersionSchema.parse((await response.json() as { data: unknown }).data)));
  assert.deepEqual(concurrentDrafts.map((version) => version.version).sort((left, right) => left - right), [
    secondVersion.version + BRAND_KIT_LIMITS.versionIncrement,
    secondVersion.version + BRAND_KIT_LIMITS.versionIncrement * 2,
  ]);

  await getDatabase().update(member).set({ role: TENANT_ROLE.analyst }).where(eq(member.userId, ownerId));
  const restrictedResponse = await createRequest(activeBrandId, content);
  assert.equal(restrictedResponse.status, HTTP_STATUS.forbidden);

  const persistedVersions = await getDatabase().select({ id: brandKitVersions.id }).from(brandKitVersions).where(eq(brandKitVersions.brandId, activeBrandId));
  assert.equal(persistedVersions.length, 4);
});
