import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { CONTENT_STATUS, SOCIAL_PLATFORMS } from "@/lib/constants";
import { createBrand } from "@/lib/db/repositories/brands";
import { approveBrandKitVersion, createBrandKitVersion } from "@/lib/db/repositories/brand-kits";
import { createCalendarContentVersion, createCalendarIdea, getCalendarContentVersions, listCalendarItems } from "@/lib/db/repositories/calendar";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { organization, user } from "@/lib/db/schema";

const ids = {
  user: `calendar-test-user-${crypto.randomUUID()}`,
  organizationA: `calendar-test-org-a-${crypto.randomUUID()}`,
  organizationB: `calendar-test-org-b-${crypto.randomUUID()}`,
} as const;
let userCreated = false;
let organizationsCreated = false;

after(async () => {
  const database = getDatabase();
  try {
    if (organizationsCreated) await database.delete(organization).where(inArray(organization.id, [ids.organizationA, ids.organizationB]));
    if (userCreated) await database.delete(user).where(eq(user.id, ids.user));
  } finally {
    await closeDatabase();
  }
});

test("calendar ideas are persisted by tenant and listed only within the requested brand and period", async () => {
  const database = getDatabase();
  const now = new Date();
  await database.insert(user).values({
    id: ids.user,
    name: "Calendar integration test",
    email: `${ids.user}@example.invalid`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  userCreated = true;
  await database.insert(organization).values([
    { id: ids.organizationA, name: "Calendar tenant A", slug: ids.organizationA, createdAt: now },
    { id: ids.organizationB, name: "Calendar tenant B", slug: ids.organizationB, createdAt: now },
  ]);
  organizationsCreated = true;

  const brandA = await createBrand({ name: "Calendar brand A" }, ids.organizationA, ids.user);
  const brandB = await createBrand({ name: "Calendar brand B" }, ids.organizationB, ids.user);
  assert.ok(brandA);
  assert.ok(brandB);
  const brandKit = await createBrandKitVersion(ids.organizationA, brandA.id, ids.user, {
    audience: "School owners",
    toneOfVoice: "Clear and helpful",
    colors: [],
    fontFamilies: [],
    keyMessages: [],
    products: [],
    verifiedFacts: [],
    restrictedClaims: [],
    callsToAction: [],
  });
  assert.ok(brandKit);
  assert.ok(await approveBrandKitVersion(ids.organizationA, brandA.id, brandKit.id, ids.user));

  const plannedAt = new Date("2026-11-20T15:30:00.000Z");
  const item = await createCalendarIdea(ids.organizationA, ids.user, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Launch announcement",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
  });
  assert.ok(item);

  const query = { start: new Date("2026-11-01T00:00:00.000Z"), end: new Date("2026-12-01T00:00:00.000Z") };
  const tenantAItems = await listCalendarItems(ids.organizationA, query);
  assert.equal(tenantAItems.data.length, 1);
  assert.equal(tenantAItems.data[0]?.brandName, brandA.name);
  assert.equal(tenantAItems.data[0]?.status, CONTENT_STATUS.idea);
  assert.equal(tenantAItems.data[0]?.plannedAt.toISOString(), plannedAt.toISOString());
  assert.equal((await listCalendarItems(ids.organizationB, query)).data.length, 0);
  assert.equal((await createCalendarIdea(ids.organizationA, ids.user, {
    brandId: brandB.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Cross-tenant attempt",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
  })), null);
  assert.equal((await listCalendarItems(ids.organizationA, { ...query, brandId: brandB.id })).data.length, 0);

  const firstVersion = await createCalendarContentVersion(ids.organizationA, ids.user, item.id, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Launch announcement",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "The verified source message.",
    variantCopy: "A LinkedIn-specific draft.",
  });
  assert.ok(firstVersion);
  assert.equal(firstVersion.versionNumber, 1);
  assert.equal((await listCalendarItems(ids.organizationA, { ...query, status: CONTENT_STATUS.draft })).data.length, 1);

  const secondVersion = await createCalendarContentVersion(ids.organizationA, ids.user, item.id, {
    brandId: brandA.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Launch announcement",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "The updated verified source message.",
    variantCopy: "The updated LinkedIn-specific draft.",
  });
  assert.equal(secondVersion?.versionNumber, 2);

  const history = await getCalendarContentVersions(ids.organizationA, item.id);
  assert.equal(history?.current?.versionNumber, 2);
  assert.equal(history?.current?.brandKitVersionNumber, 1);
  assert.equal(history?.current?.canonicalCopy, "The updated verified source message.");
  assert.deepEqual(history?.history.map((version) => version.versionNumber), [2, 1]);
  assert.equal(await getCalendarContentVersions(ids.organizationB, item.id), null);
  assert.equal(await createCalendarContentVersion(ids.organizationB, ids.user, item.id, {
    brandId: brandB.id,
    platform: SOCIAL_PLATFORMS[0],
    title: "Cross-tenant attempt",
    plannedAt: plannedAt.toISOString(),
    timeZone: "America/Sao_Paulo",
    canonicalCopy: "Must not be stored.",
    variantCopy: "Must not be stored.",
  }), null);
});
