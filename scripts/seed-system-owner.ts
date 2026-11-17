import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { TENANT_ROLE } from "@/lib/constants";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { account, member, organization, user } from "@/lib/db/schema";

const BOOTSTRAP_OWNER = {
  emailEnvironmentName: "STUDIO_INITIAL_OWNER_EMAIL",
  passwordEnvironmentName: "STUDIO_INITIAL_OWNER_PASSWORD",
  organizationName: "30studio",
  organizationSlug: "30studio",
  userName: "30studio Owner",
  credentialProviderId: "credential",
  minimumPasswordCharacters: 12,
} as const;

function getBootstrapCredentials() {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("The initial system owner seed only runs in production.");
  }

  const email = process.env[BOOTSTRAP_OWNER.emailEnvironmentName]?.trim().toLowerCase();
  const password = process.env[BOOTSTRAP_OWNER.passwordEnvironmentName];
  if (!email || !password) {
    throw new Error("Initial system owner credentials are required through the runtime secret.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(".local") || email.endsWith(".invalid")) {
    throw new Error("The initial owner must use a valid, recoverable email address.");
  }
  if (password.length < BOOTSTRAP_OWNER.minimumPasswordCharacters) {
    throw new Error("The initial owner password does not meet the minimum length.");
  }

  return { email, password };
}

async function seedSystemOwner() {
  const { email, password } = getBootstrapCredentials();
  const database = getDatabase();
  const passwordHash = await hashPassword(password);
  const now = new Date();

  const created = await database.transaction(async (transaction) => {
    const [existingOrganization] = await transaction.select({ id: organization.id }).from(organization)
      .where(eq(organization.slug, BOOTSTRAP_OWNER.organizationSlug)).limit(1);
    const [existingUser] = await transaction.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);

    if (existingUser && existingOrganization) {
      const [ownerMembership] = await transaction.select({ id: member.id }).from(member).where(and(
        eq(member.organizationId, existingOrganization.id),
        eq(member.userId, existingUser.id),
        eq(member.role, TENANT_ROLE.owner),
      )).limit(1);
      if (ownerMembership) return false;
    }
    if (existingUser) {
      throw new Error("Bootstrap identity conflicts with existing user data; no changes were made.");
    }

    const userId = randomUUID();
    const organizationId = existingOrganization?.id ?? randomUUID();
    await transaction.insert(user).values({
      id: userId,
      name: BOOTSTRAP_OWNER.userName,
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await transaction.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: BOOTSTRAP_OWNER.credentialProviderId,
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    if (!existingOrganization) {
      await transaction.insert(organization).values({
        id: organizationId,
        name: BOOTSTRAP_OWNER.organizationName,
        slug: BOOTSTRAP_OWNER.organizationSlug,
        createdAt: now,
      });
    }
    await transaction.insert(member).values({
      id: randomUUID(),
      organizationId,
      userId,
      role: TENANT_ROLE.owner,
      createdAt: now,
    });
    return true;
  });

  console.info(created ? "Created the initial 30studio workspace owner." : "The initial 30studio workspace owner already exists; credentials were left unchanged.");
}

void seedSystemOwner()
  .catch((error: unknown) => {
    const cause = error instanceof Error ? error.cause : undefined;
    const causeMessage = cause instanceof Error ? cause.message : undefined;
    const code = typeof cause === "object" && cause !== null && "code" in cause
      ? String(cause.code)
      : typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;

    console.error("Could not seed the initial 30studio workspace owner.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      ...(!causeMessage && error instanceof Error ? { message: error.message } : {}),
      ...(causeMessage ? { cause: causeMessage } : {}),
      ...(code ? { code } : {}),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
