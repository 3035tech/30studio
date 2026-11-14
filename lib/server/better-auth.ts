import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";
import { getDatabase } from "@/lib/db/client";
import { BETTER_AUTH_ENV } from "@/lib/constants";

const permissions = {
  ...defaultStatements,
  brands: ["read", "manage"],
  content: ["read", "manage", "approve"],
  analytics: ["read"],
} as const;
const accessControl = createAccessControl(permissions);
const owner = accessControl.newRole({ ...ownerAc.statements, brands: ["read", "manage"], content: ["read", "manage", "approve"], analytics: ["read"] });
const admin = accessControl.newRole({ ...adminAc.statements, brands: ["read", "manage"], content: ["read", "manage", "approve"], analytics: ["read"] });
const editor = accessControl.newRole({ ...memberAc.statements, brands: ["read"], content: ["read", "manage"], analytics: ["read"] });
const approver = accessControl.newRole({ ...memberAc.statements, brands: ["read"], content: ["read", "approve"], analytics: ["read"] });
const analyst = accessControl.newRole({ ...memberAc.statements, brands: ["read"], content: ["read"], analytics: ["read"] });

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
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    plugins: [
      organization({
        ac: accessControl,
        roles: { owner, admin, editor, approver, analyst },
        allowUserToCreateOrganization: true,
        organizationLimit: 20,
        membershipLimit: 100,
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
