import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { GET as listBrandsRoute, POST as createBrandRoute } from "@/app/api/brands/route";
import { PATCH as updateBrandRoute } from "@/app/api/brands/[brandId]/route";
import { DELETE as removeTeamMemberRoute, PATCH as updateTeamMemberRoute } from "@/app/api/team/[memberId]/route";
import { GET as listTeamRoute } from "@/app/api/team/route";
import { API_ERROR_CODES, BETTER_AUTH_ENV, HTTP_STATUS, TEAM_AUDIT_ACTIONS, TENANT_ROLE } from "@/lib/constants";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { brands, member, organization, session, teamAuditEvents, user } from "@/lib/db/schema";
import { createBrand } from "@/lib/db/repositories/brands";
import { getAuth } from "@/lib/server/better-auth";
import { brandListResponseSchema } from "@/lib/validation/brands";
import { teamListResponseSchema } from "@/lib/validation/team";

const TEST_ORIGIN = "http://localhost:3000";
const TEST_EMAIL = `route-test-${crypto.randomUUID()}@example.invalid`;
const TEST_PASSWORD = "route-test-password-30studio";
const TEST_SECRET = "30studio-route-test-secret-that-is-not-used-outside-tests";
const ORGANIZATION_IDS = {
  active: `route-test-active-${crypto.randomUUID()}`,
  other: `route-test-other-${crypto.randomUUID()}`,
} as const;
const TEAMMATE_USER_ID = `route-test-teammate-${crypto.randomUUID()}`;

const signUpResponseSchema = z.object({
  token: z.string().min(1).nullable(),
  user: z.object({ id: z.string().min(1) }),
});
const signInResponseSchema = z.object({
  token: z.string().min(1),
  user: z.object({ id: z.string().min(1) }),
});

let testUserId: string | undefined;
let testSessionToken: string | undefined;
let sessionCookie = "";
let testBrandAId: string | undefined;
let testBrandBId: string | undefined;
let ownerMemberId: string | undefined;
let activeTeammateMemberId: string | undefined;
let otherTeammateMemberId: string | undefined;

before(async () => {
  process.env[BETTER_AUTH_ENV.secret] = TEST_SECRET;
  process.env[BETTER_AUTH_ENV.url] = TEST_ORIGIN;
  process.env[BETTER_AUTH_ENV.trustedOrigins] = TEST_ORIGIN;
  process.env.STUDIO_PUBLIC_ORIGIN = TEST_ORIGIN;

  const auth = getAuth();
  const signUpResponse = await auth.handler(new Request(`${TEST_ORIGIN}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: TEST_ORIGIN },
    body: JSON.stringify({ name: "Route test user", email: TEST_EMAIL, password: TEST_PASSWORD }),
  }));

  assert.equal(signUpResponse.status, HTTP_STATUS.ok);
  const signUp = signUpResponseSchema.safeParse(await signUpResponse.json());
  assert.equal(signUp.success, true);
  if (!signUp.success) throw new Error("Better Auth did not return the expected test account.");

  testUserId = signUp.data.user.id;
  const database = getDatabase();
  await database.update(user).set({ emailVerified: true }).where(eq(user.id, testUserId));

  const signInResponse = await auth.handler(new Request(`${TEST_ORIGIN}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: TEST_ORIGIN },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  }));
  assert.equal(signInResponse.status, HTTP_STATUS.ok);
  const signIn = signInResponseSchema.safeParse(await signInResponse.json());
  assert.equal(signIn.success, true);
  if (!signIn.success) throw new Error("Better Auth did not return the expected signed-in session.");

  testSessionToken = signIn.data.token;
  const sessionSetCookie = signInResponse.headers.getSetCookie().find((value) => value.includes("better-auth.session_token="));
  assert.ok(sessionSetCookie);
  sessionCookie = sessionSetCookie.split(";", 1)[0] ?? "";
  assert.notEqual(sessionCookie, "");

  const createdAt = new Date();
  await database.insert(user).values({
    id: TEAMMATE_USER_ID,
    name: "Route test teammate",
    email: `route-test-teammate-${crypto.randomUUID()}@example.invalid`,
    emailVerified: true,
    createdAt,
    updatedAt: createdAt,
  });
  await database.insert(organization).values([
    { id: ORGANIZATION_IDS.active, name: "Active test tenant", slug: ORGANIZATION_IDS.active, createdAt },
    { id: ORGANIZATION_IDS.other, name: "Other test tenant", slug: ORGANIZATION_IDS.other, createdAt },
  ]);
  ownerMemberId = `route-test-member-${crypto.randomUUID()}`;
  activeTeammateMemberId = `route-test-member-${crypto.randomUUID()}`;
  otherTeammateMemberId = `route-test-member-${crypto.randomUUID()}`;
  await database.insert(member).values([
    { id: ownerMemberId, organizationId: ORGANIZATION_IDS.active, userId: testUserId, role: TENANT_ROLE.owner, createdAt },
    { id: activeTeammateMemberId, organizationId: ORGANIZATION_IDS.active, userId: TEAMMATE_USER_ID, role: TENANT_ROLE.editor, createdAt },
    { id: otherTeammateMemberId, organizationId: ORGANIZATION_IDS.other, userId: TEAMMATE_USER_ID, role: TENANT_ROLE.editor, createdAt },
  ]);
  await database.update(session)
    .set({ activeOrganizationId: ORGANIZATION_IDS.active })
    .where(eq(session.token, testSessionToken));

  const brandA = await createBrand({ name: "Tenant A brand" }, ORGANIZATION_IDS.active, testUserId);
  const brandB = await createBrand({ name: "Tenant B brand" }, ORGANIZATION_IDS.other, testUserId);
  assert.ok(brandA);
  assert.ok(brandB);
  testBrandAId = brandA.id;
  testBrandBId = brandB.id;
});

after(async () => {
  const database = getDatabase();

  try {
    await database.delete(organization).where(inArray(organization.id, Object.values(ORGANIZATION_IDS)));
    if (testUserId) await database.delete(user).where(eq(user.id, testUserId));
    await database.delete(user).where(eq(user.id, TEAMMATE_USER_ID));
  } finally {
    await closeDatabase();
  }
});

test("brand routes enforce session, active membership, tenant scope, and role permission", async () => {
  assert.ok(testUserId);
  assert.ok(testSessionToken);
  assert.ok(testBrandAId);
  assert.ok(testBrandBId);
  assert.ok(ownerMemberId);
  assert.ok(activeTeammateMemberId);
  assert.ok(otherTeammateMemberId);

  const database = getDatabase();
  const unauthenticatedResponse = await listBrandsRoute(new NextRequest(`${TEST_ORIGIN}/api/brands`));
  assert.equal(unauthenticatedResponse.status, HTTP_STATUS.unauthorized);

  const authenticatedRequest = () => new NextRequest(`${TEST_ORIGIN}/api/brands`, {
    headers: { cookie: sessionCookie },
  });

  const teamResponse = await listTeamRoute(new NextRequest(`${TEST_ORIGIN}/api/team`, { headers: { cookie: sessionCookie } }));
  assert.equal(teamResponse.status, HTTP_STATUS.ok);
  const teamBody = teamListResponseSchema.parse(await teamResponse.json());
  assert.deepEqual(teamBody.data.map((teamMember) => teamMember.id), [ownerMemberId, activeTeammateMemberId].sort());
  assert.equal(teamBody.canManage, true);

  const crossTenantTeamUpdate = await updateTeamMemberRoute(
    new NextRequest(`${TEST_ORIGIN}/api/team/${otherTeammateMemberId}`, {
      method: "PATCH",
      headers: { cookie: sessionCookie, origin: TEST_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ role: TENANT_ROLE.analyst }),
    }),
    { params: Promise.resolve({ memberId: otherTeammateMemberId }) },
  );
  assert.equal(crossTenantTeamUpdate.status, HTTP_STATUS.notFound);

  const updateTeammate = await updateTeamMemberRoute(
    new NextRequest(`${TEST_ORIGIN}/api/team/${activeTeammateMemberId}`, {
      method: "PATCH",
      headers: { cookie: sessionCookie, origin: TEST_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ role: TENANT_ROLE.approver }),
    }),
    { params: Promise.resolve({ memberId: activeTeammateMemberId }) },
  );
  assert.equal(updateTeammate.status, HTTP_STATUS.ok);
  const roleChangeEvent = await database.query.teamAuditEvents.findFirst({
    where: and(eq(teamAuditEvents.organizationId, ORGANIZATION_IDS.active), eq(teamAuditEvents.action, TEAM_AUDIT_ACTIONS.memberRoleChanged)),
  });
  assert.equal(roleChangeEvent?.previousRole, TENANT_ROLE.editor);
  assert.equal(roleChangeEvent?.newRole, TENANT_ROLE.approver);

  const removeTeammate = await removeTeamMemberRoute(
    new NextRequest(`${TEST_ORIGIN}/api/team/${activeTeammateMemberId}`, {
      method: "DELETE",
      headers: { cookie: sessionCookie, origin: TEST_ORIGIN },
    }),
    { params: Promise.resolve({ memberId: activeTeammateMemberId }) },
  );
  assert.equal(removeTeammate.status, HTTP_STATUS.ok);
  assert.equal(await database.query.member.findFirst({ where: eq(member.id, activeTeammateMemberId) }), undefined);
  assert.ok(await database.query.teamAuditEvents.findFirst({
    where: and(eq(teamAuditEvents.organizationId, ORGANIZATION_IDS.active), eq(teamAuditEvents.action, TEAM_AUDIT_ACTIONS.memberRemoved)),
  }));
  assert.ok(await database.query.user.findFirst({ where: eq(user.id, TEAMMATE_USER_ID) }));

  const listResponse = await listBrandsRoute(authenticatedRequest());
  assert.equal(listResponse.status, HTTP_STATUS.ok);
  const listBody = brandListResponseSchema.parse(await listResponse.json());
  assert.deepEqual(listBody.data.map((brand) => brand.id), [testBrandAId]);

  const crossTenantUpdate = await updateBrandRoute(
    new NextRequest(`${TEST_ORIGIN}/api/brands/${testBrandBId}`, {
      method: "PATCH",
      headers: { cookie: sessionCookie, origin: TEST_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ name: "Unauthorized rename" }),
    }),
    { params: Promise.resolve({ brandId: testBrandBId }) },
  );
  assert.equal(crossTenantUpdate.status, HTTP_STATUS.notFound);

  const otherTenantBrand = await database.query.brands.findFirst({
    where: and(eq(brands.id, testBrandBId), eq(brands.organizationId, ORGANIZATION_IDS.other)),
  });
  assert.equal(otherTenantBrand?.name, "Tenant B brand");

  await database.update(member).set({ role: TENANT_ROLE.analyst }).where(eq(member.userId, testUserId));
  const forbiddenCreate = await createBrandRoute(new NextRequest(`${TEST_ORIGIN}/api/brands`, {
    method: "POST",
    headers: { cookie: sessionCookie, origin: TEST_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ name: "Forbidden brand" }),
  }));
  assert.equal(forbiddenCreate.status, HTTP_STATUS.forbidden);
  assert.equal(z.object({ code: z.string() }).parse(await forbiddenCreate.json()).code, API_ERROR_CODES.forbidden);

  await database.delete(member).where(eq(member.userId, testUserId));
  const removedMembershipResponse = await listBrandsRoute(authenticatedRequest());
  assert.equal(removedMembershipResponse.status, HTTP_STATUS.forbidden);

  await database.update(session).set({ activeOrganizationId: null }).where(eq(session.token, testSessionToken));
  const missingTenantResponse = await listBrandsRoute(authenticatedRequest());
  assert.equal(missingTenantResponse.status, HTTP_STATUS.forbidden);
});
