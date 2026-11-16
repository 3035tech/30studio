import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { DELETE as cancelInvitationRoute, POST as updateInvitationRoute } from "@/app/api/team/invitations/[invitationId]/route";
import { GET as listInvitationsRoute, POST as createInvitationRoute } from "@/app/api/team/invitations/route";
import { GET as listAuditRoute } from "@/app/api/team/audit/route";
import { BETTER_AUTH_ENV, HTTP_STATUS, TEAM_AUDIT_ACTIONS, TENANT_ROLE } from "@/lib/constants";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { invitation, member, organization, session, teamAuditEvents, user } from "@/lib/db/schema";
import { getAuth } from "@/lib/server/better-auth";
import { teamAuditResponseSchema, teamInvitationsResponseSchema } from "@/lib/validation/team";

const TEST_ORIGIN = "http://localhost:3000";
const OWNER_EMAIL = `invitation-owner-${crypto.randomUUID()}@example.invalid`;
const OWNER_PASSWORD = "invitation-test-password-30studio";
const INVITEE_EMAIL = `invitation-recipient-${crypto.randomUUID()}@example.invalid`;
const ACCEPTED_EMAIL = `invitation-accepted-${crypto.randomUUID()}@example.invalid`;
const TEST_SECRET = "30studio-invitation-test-secret-is-not-used-outside-tests";
const ORGANIZATION_ID = `invitation-test-org-${crypto.randomUUID()}`;
const OTHER_ORGANIZATION_ID = `invitation-test-other-org-${crypto.randomUUID()}`;
const OTHER_INVITEE_EMAIL = `other-tenant-invite-${crypto.randomUUID()}@example.invalid`;
const MAILPIT_API_URL = process.env.MAILPIT_API_URL;

let ownerUserId = "";
let ownerSessionCookie = "";
let ownerSessionToken = "";

before(async () => {
  if (!MAILPIT_API_URL) return;
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
    method: "POST", headers: { "content-type": "application/json", origin: TEST_ORIGIN },
    body: JSON.stringify({ name: "Invitation test owner", email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  }));
  assert.equal(signUpResponse.status, HTTP_STATUS.ok);
  const signUp = await signUpResponse.json() as { user: { id: string } };
  ownerUserId = signUp.user.id;
  const database = getDatabase();
  await database.update(user).set({ emailVerified: true }).where(eq(user.id, ownerUserId));

  const signInResponse = await auth.handler(new Request(`${TEST_ORIGIN}/api/auth/sign-in/email`, {
    method: "POST", headers: { "content-type": "application/json", origin: TEST_ORIGIN },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  }));
  assert.equal(signInResponse.status, HTTP_STATUS.ok);
  const signIn = await signInResponse.json() as { token: string };
  ownerSessionToken = signIn.token;
  const sessionSetCookie = signInResponse.headers.getSetCookie().find((value) => value.includes("better-auth.session_token="));
  assert.ok(sessionSetCookie);
  ownerSessionCookie = sessionSetCookie.split(";", 1)[0] ?? "";
  assert.notEqual(ownerSessionCookie, "");

  const createdAt = new Date();
  await database.insert(organization).values({ id: ORGANIZATION_ID, name: "Invitation test tenant", slug: ORGANIZATION_ID, createdAt });
  await database.insert(organization).values({ id: OTHER_ORGANIZATION_ID, name: "Other invitation tenant", slug: OTHER_ORGANIZATION_ID, createdAt });
  await database.insert(member).values([
    { id: `invitation-owner-member-${crypto.randomUUID()}`, organizationId: ORGANIZATION_ID, userId: ownerUserId, role: TENANT_ROLE.owner, createdAt },
    { id: `invitation-other-owner-${crypto.randomUUID()}`, organizationId: OTHER_ORGANIZATION_ID, userId: ownerUserId, role: TENANT_ROLE.owner, createdAt },
  ]);
  await database.insert(invitation).values({
    id: `other-tenant-invitation-${crypto.randomUUID()}`,
    organizationId: OTHER_ORGANIZATION_ID,
    email: OTHER_INVITEE_EMAIL,
    role: TENANT_ROLE.editor,
    status: "pending",
    expiresAt: new Date(Date.now() + 86_400_000),
    inviterId: ownerUserId,
  });
  await database.update(session).set({ activeOrganizationId: ORGANIZATION_ID }).where(eq(session.token, ownerSessionToken));
});

after(async () => {
  try {
    await getDatabase().delete(organization).where(inArray(organization.id, [ORGANIZATION_ID, OTHER_ORGANIZATION_ID]));
    if (ownerUserId) await getDatabase().delete(user).where(eq(user.id, ownerUserId));
  } finally {
    await closeDatabase();
  }
});

test("tenant invitations can be created, resent, cancelled, and audited without cross-tenant exposure", {
  skip: MAILPIT_API_URL ? false : "Set MAILPIT_API_URL and SMTP settings to run invitation email integration tests.",
}, async () => {
  const database = getDatabase();
  const requestHeaders = { cookie: ownerSessionCookie, origin: TEST_ORIGIN, "content-type": "application/json" };
  const createResponse = await createInvitationRoute(new NextRequest(`${TEST_ORIGIN}/api/team/invitations`, {
    method: "POST", headers: requestHeaders, body: JSON.stringify({ email: INVITEE_EMAIL, role: TENANT_ROLE.editor }),
  }));
  assert.equal(createResponse.status, HTTP_STATUS.created, await createResponse.clone().text());
  const createdBody = await createResponse.json() as { data: { id: string } };

  const invitationList = await listInvitationsRoute(new NextRequest(`${TEST_ORIGIN}/api/team/invitations`, { headers: { cookie: ownerSessionCookie } }));
  assert.equal(invitationList.status, HTTP_STATUS.ok);
  const parsedInvitations = teamInvitationsResponseSchema.parse(await invitationList.json());
  assert.equal(parsedInvitations.data.length, 1);
  assert.equal(parsedInvitations.data.some((row) => row.email === OTHER_INVITEE_EMAIL), false);
  const createdInvitation = parsedInvitations.data[0];
  assert.ok(createdInvitation);
  assert.equal(createdInvitation.email, INVITEE_EMAIL);
  assert.equal(createdInvitation.status, "pending");
  const foreignInvitation = await getDatabase().query.invitation.findFirst({ where: eq(invitation.organizationId, OTHER_ORGANIZATION_ID) });
  assert.ok(foreignInvitation);
  const foreignCancelResponse = await cancelInvitationRoute(new NextRequest(`${TEST_ORIGIN}/api/team/invitations/${foreignInvitation.id}`, {
    method: "DELETE", headers: { cookie: ownerSessionCookie, origin: TEST_ORIGIN },
  }), { params: Promise.resolve({ invitationId: foreignInvitation.id }) });
  assert.equal(foreignCancelResponse.status, HTTP_STATUS.notFound);

  const mailpitResponse = await fetch(`${MAILPIT_API_URL}/api/v1/messages`);
  assert.equal(mailpitResponse.status, HTTP_STATUS.ok);
  const mailpit = await mailpitResponse.json() as { messages: Array<{ To: Array<{ Address: string }>; ID: string }> };
  assert.ok(mailpit.messages.some((message) => message.To.some((recipient) => recipient.Address === INVITEE_EMAIL)));
  const invitationEmail = mailpit.messages.find((message) => message.To.some((recipient) => recipient.Address === INVITEE_EMAIL));
  assert.ok(invitationEmail);
  const invitationEmailResponse = await fetch(`${MAILPIT_API_URL}/api/v1/message/${invitationEmail.ID}`);
  const invitationEmailBody = await invitationEmailResponse.json() as { Text: string };
  assert.ok(invitationEmailBody.Text.includes(`/pt/accept-invitation?invitationId=${createdBody.data.id}`));

  const resendResponse = await updateInvitationRoute(new NextRequest(`${TEST_ORIGIN}/api/team/invitations/${createdInvitation.id}`, {
    method: "POST", headers: { cookie: ownerSessionCookie, origin: TEST_ORIGIN },
  }), { params: Promise.resolve({ invitationId: createdInvitation.id }) });
  assert.equal(resendResponse.status, HTTP_STATUS.ok);
  assert.equal(await database.select({ id: invitation.id }).from(invitation).where(and(eq(invitation.organizationId, ORGANIZATION_ID), eq(invitation.email, INVITEE_EMAIL))).then((rows) => rows.length), 1);

  const cancelResponse = await cancelInvitationRoute(new NextRequest(`${TEST_ORIGIN}/api/team/invitations/${createdInvitation.id}`, {
    method: "DELETE", headers: { cookie: ownerSessionCookie, origin: TEST_ORIGIN },
  }), { params: Promise.resolve({ invitationId: createdInvitation.id }) });
  assert.equal(cancelResponse.status, HTTP_STATUS.ok);

  const auditResponse = await listAuditRoute(new NextRequest(`${TEST_ORIGIN}/api/team/audit`, { headers: { cookie: ownerSessionCookie } }));
  assert.equal(auditResponse.status, HTTP_STATUS.ok);
  const audit = teamAuditResponseSchema.parse(await auditResponse.json());
  assert.ok(audit.data.some((event) => event.action === TEAM_AUDIT_ACTIONS.invitationCreated && event.targetEmail === INVITEE_EMAIL));
  assert.ok(audit.data.some((event) => event.action === TEAM_AUDIT_ACTIONS.invitationResent && event.targetEmail === INVITEE_EMAIL));
  assert.ok(audit.data.some((event) => event.action === TEAM_AUDIT_ACTIONS.invitationCancelled && event.targetEmail === INVITEE_EMAIL));

  const cancelledInvitation = await database.query.invitation.findFirst({ where: eq(invitation.id, createdInvitation.id) });
  assert.equal(cancelledInvitation?.status, "canceled");

  const acceptInviteResponse = await createInvitationRoute(new NextRequest(`${TEST_ORIGIN}/api/team/invitations`, {
    method: "POST", headers: requestHeaders, body: JSON.stringify({ email: ACCEPTED_EMAIL, role: TENANT_ROLE.analyst }),
  }));
  assert.equal(acceptInviteResponse.status, HTTP_STATUS.created);
  const acceptInviteBody = await acceptInviteResponse.json() as { data: { id: string } };
  const auth = getAuth();
  const inviteeSignUp = await auth.handler(new Request(`${TEST_ORIGIN}/api/auth/sign-up/email`, {
    method: "POST", headers: { "content-type": "application/json", origin: TEST_ORIGIN },
    body: JSON.stringify({ name: "Invitation test recipient", email: ACCEPTED_EMAIL, password: OWNER_PASSWORD }),
  }));
  assert.equal(inviteeSignUp.status, HTTP_STATUS.ok);
  const inviteeSignUpBody = await inviteeSignUp.json() as { user: { id: string } };
  await database.update(user).set({ emailVerified: true }).where(eq(user.id, inviteeSignUpBody.user.id));
  const inviteeSignIn = await auth.handler(new Request(`${TEST_ORIGIN}/api/auth/sign-in/email`, {
    method: "POST", headers: { "content-type": "application/json", origin: TEST_ORIGIN },
    body: JSON.stringify({ email: ACCEPTED_EMAIL, password: OWNER_PASSWORD }),
  }));
  assert.equal(inviteeSignIn.status, HTTP_STATUS.ok);
  const inviteeCookie = inviteeSignIn.headers.getSetCookie().find((value) => value.includes("better-auth.session_token="));
  assert.ok(inviteeCookie);
  const acceptResponse = await auth.handler(new Request(`${TEST_ORIGIN}/api/auth/organization/accept-invitation`, {
    method: "POST",
    headers: { cookie: inviteeCookie.split(";", 1)[0] ?? "", origin: TEST_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ invitationId: acceptInviteBody.data.id }),
  }));
  assert.equal(acceptResponse.status, HTTP_STATUS.ok);
  assert.ok(await database.query.member.findFirst({ where: and(eq(member.organizationId, ORGANIZATION_ID), eq(member.userId, inviteeSignUpBody.user.id)) }));

  const refreshedAuditResponse = await listAuditRoute(new NextRequest(`${TEST_ORIGIN}/api/team/audit`, { headers: { cookie: ownerSessionCookie } }));
  const refreshedAudit = teamAuditResponseSchema.parse(await refreshedAuditResponse.json());
  assert.ok(refreshedAudit.data.some((event) => event.action === TEAM_AUDIT_ACTIONS.invitationAccepted && event.targetEmail === ACCEPTED_EMAIL));
  const events = await database.select({ id: teamAuditEvents.id }).from(teamAuditEvents).where(eq(teamAuditEvents.organizationId, ORGANIZATION_ID));
  assert.equal(events.length, 5);

  const cleanupUsers = await database.select({ id: user.id }).from(user).where(inArray(user.email, [INVITEE_EMAIL, ACCEPTED_EMAIL]));
  if (cleanupUsers.length) await database.delete(user).where(inArray(user.id, cleanupUsers.map((row) => row.id)));
});
