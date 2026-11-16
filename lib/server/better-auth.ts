import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";
import { getDatabase } from "@/lib/db/client";
import { API_ERROR_CODES, BETTER_AUTH_ENV, EMAIL_DELIVERY_LIMITS, TEAM_AUDIT_ACTIONS, TEAM_INVITATION_LIMIT } from "@/lib/constants";
import { sendInvitationEmail, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/server/email";
import { recordTeamAuditEvent } from "@/lib/db/repositories/team";

const permissions = {
  ...defaultStatements,
  brands: ["read", "manage"],
  content: ["read", "manage", "approve"],
  analytics: ["read"],
  competitiveResearch: ["read", "manage"],
} as const;
const accessControl = createAccessControl(permissions);
const owner = accessControl.newRole({ ...ownerAc.statements, brands: ["read", "manage"], content: ["read", "manage", "approve"], analytics: ["read"], competitiveResearch: ["read", "manage"] });
const admin = accessControl.newRole({ ...adminAc.statements, brands: ["read", "manage"], content: ["read", "manage", "approve"], analytics: ["read"], competitiveResearch: ["read", "manage"] });
const editor = accessControl.newRole({ ...memberAc.statements, brands: ["read"], content: ["read", "manage"], analytics: ["read"], competitiveResearch: ["read", "manage"] });
const approver = accessControl.newRole({ ...memberAc.statements, brands: ["read"], content: ["read", "approve"], analytics: ["read"], competitiveResearch: ["read"] });
const analyst = accessControl.newRole({ ...memberAc.statements, brands: ["read"], content: ["read"], analytics: ["read"], competitiveResearch: ["read"] });

function createAuth() {
  const authSecret = process.env[BETTER_AUTH_ENV.secret];
  const authUrl = process.env[BETTER_AUTH_ENV.url];
  const trustedOrigins = (process.env[BETTER_AUTH_ENV.trustedOrigins] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!authSecret || authSecret.length < 32 || !authUrl || trustedOrigins.length === 0) {
    throw new Error("Better Auth configuration is incomplete.");
  }

  return betterAuth({
    appName: "30studio",
    baseURL: authUrl,
    secret: authSecret,
    trustedOrigins,
    database: drizzleAdapter(getDatabase(), { provider: "pg" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: EMAIL_DELIVERY_LIMITS.passwordResetExpirySeconds,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async (data) => sendPasswordResetEmail(data),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: EMAIL_DELIVERY_LIMITS.verificationExpirySeconds,
      sendVerificationEmail,
    },
    plugins: [
      organization({
        ac: accessControl,
        roles: { owner, admin, editor, approver, analyst },
        allowUserToCreateOrganization: true,
        organizationLimit: 20,
        membershipLimit: 100,
        invitationLimit: TEAM_INVITATION_LIMIT,
        invitationExpiresIn: EMAIL_DELIVERY_LIMITS.invitationExpirySeconds,
        requireEmailVerificationOnInvitation: true,
        sendInvitationEmail: async (data) => {
          try {
            await sendInvitationEmail(data);
          } catch {
            await recordTeamAuditEvent({
              organizationId: data.organization.id,
              actorUserId: data.inviter.user.id,
              targetEmail: data.email,
              invitationId: data.id,
              action: TEAM_AUDIT_ACTIONS.invitationDeliveryFailed,
            });
            throw new Error(API_ERROR_CODES.invitationDeliveryUnavailable);
          }
        },
        organizationHooks: {
          afterCreateInvitation: async ({ invitation, inviter }) => {
            await recordTeamAuditEvent({
              organizationId: invitation.organizationId,
              actorUserId: inviter.id,
              targetEmail: invitation.email,
              invitationId: invitation.id,
              action: TEAM_AUDIT_ACTIONS.invitationCreated,
              newRole: invitation.role,
            });
          },
          afterAcceptInvitation: async ({ invitation, member: acceptedMember, user: acceptedUser }) => {
            await recordTeamAuditEvent({
              organizationId: invitation.organizationId,
              actorUserId: acceptedUser.id,
              targetUserId: acceptedUser.id,
              targetEmail: invitation.email,
              invitationId: invitation.id,
              action: TEAM_AUDIT_ACTIONS.invitationAccepted,
              newRole: acceptedMember.role,
            });
          },
          afterCancelInvitation: async ({ invitation, cancelledBy }) => {
            await recordTeamAuditEvent({
              organizationId: invitation.organizationId,
              actorUserId: cancelledBy.id,
              targetEmail: invitation.email,
              invitationId: invitation.id,
              action: TEAM_AUDIT_ACTIONS.invitationCancelled,
              previousRole: invitation.role,
            });
          },
        },
      }),
    ],
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let authInstance: AuthInstance | undefined;

export function getAuth() {
  authInstance ??= createAuth();
  return authInstance;
}
