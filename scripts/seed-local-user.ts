import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { LOCAL_DEVELOPMENT } from "@/lib/constants";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { account, member, organization, user } from "@/lib/db/schema";

function assertLocalDevelopmentDatabase() {
  if (process.env.NODE_ENV !== LOCAL_DEVELOPMENT.runtimeEnvironment || process.env[LOCAL_DEVELOPMENT.enabledEnvironmentName] !== LOCAL_DEVELOPMENT.enabledEnvironmentValue) {
    throw new Error("The demo account seed is restricted to the explicit local Docker development environment.");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to seed the local demo account.");
  const { hostname, pathname } = new URL(databaseUrl);
  if (!(LOCAL_DEVELOPMENT.allowedDatabaseHosts as readonly string[]).includes(hostname)) {
    throw new Error("The demo account seed only accepts a loopback or Docker Compose PostgreSQL host.");
  }
  if (!(LOCAL_DEVELOPMENT.allowedDatabaseNames as readonly string[]).includes(pathname.slice(1))) {
    throw new Error("The demo account seed only accepts the 30studio local development database.");
  }
}

async function seedLocalUser() {
  assertLocalDevelopmentDatabase();
  const database = getDatabase();
  const [existingUser] = await database.select({ id: user.id }).from(user).where(eq(user.email, LOCAL_DEVELOPMENT.seedUserEmail)).limit(1);
  if (existingUser) {
    console.info(`Local demo account already exists: ${LOCAL_DEVELOPMENT.seedUserEmail}. Existing credentials were left unchanged.`);
    return;
  }

  const userId = randomUUID();
  const organizationId = randomUUID();
  const now = new Date();
  const passwordHash = await hashPassword(LOCAL_DEVELOPMENT.seedUserPassword);
  await database.transaction(async (transaction) => {
    await transaction.insert(user).values({
      id: userId,
      name: LOCAL_DEVELOPMENT.seedUserName,
      email: LOCAL_DEVELOPMENT.seedUserEmail,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await transaction.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: LOCAL_DEVELOPMENT.credentialProviderId,
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    await transaction.insert(organization).values({
      id: organizationId,
      name: LOCAL_DEVELOPMENT.seedOrganizationName,
      slug: LOCAL_DEVELOPMENT.seedOrganizationSlug,
      createdAt: now,
    });
    await transaction.insert(member).values({
      id: randomUUID(),
      organizationId,
      userId,
      role: LOCAL_DEVELOPMENT.ownerRole,
      createdAt: now,
    });
  });
  console.info(`Created local demo account: ${LOCAL_DEVELOPMENT.seedUserEmail}`);
}

void seedLocalUser()
  .catch((error: unknown) => {
    console.error("Could not create the local demo account.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
