import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { archiveBrand, createBrand, listBrands, updateBrand } from "@/lib/db/repositories/brands";
import { brands, organization, user } from "@/lib/db/schema";

const testIds = {
  user: `30studio-test-user-${crypto.randomUUID()}`,
  organizationA: `30studio-test-org-a-${crypto.randomUUID()}`,
  organizationB: `30studio-test-org-b-${crypto.randomUUID()}`,
};
let userCreated = false;
let organizationsCreated = false;

after(async () => {
  const database = getDatabase();

  try {
    if (organizationsCreated) {
      await database.delete(organization).where(inArray(organization.id, [testIds.organizationA, testIds.organizationB]));
    }
    if (userCreated) await database.delete(user).where(eq(user.id, testIds.user));
  } finally {
    await closeDatabase();
  }
});

test("brand management remains scoped to the owning organization", async () => {
  const database = getDatabase();
  const createdAt = new Date();

  await database.insert(user).values({
    id: testIds.user,
    name: "30studio integration test",
    email: `${testIds.user}@example.invalid`,
    emailVerified: true,
    createdAt,
    updatedAt: createdAt,
  });
  userCreated = true;
  await database.insert(organization).values([
    { id: testIds.organizationA, name: "Tenant A", slug: testIds.organizationA, createdAt },
    { id: testIds.organizationB, name: "Tenant B", slug: testIds.organizationB, createdAt },
  ]);
  organizationsCreated = true;

  const brandA = await createBrand({ name: "30pay", description: "Billing platform" }, testIds.organizationA, testIds.user);
  const brandB = await createBrand({ name: "30pay", description: "Separate tenant brand" }, testIds.organizationB, testIds.user);

  assert.ok(brandA);
  assert.ok(brandB);
  assert.notEqual(brandA.id, brandB.id);
  assert.equal((await listBrands(testIds.organizationA)).length, 1);
  assert.equal((await listBrands(testIds.organizationB)).length, 1);

  assert.equal(await updateBrand(brandA.id, { name: "30pay revised" }, testIds.organizationB), null);
  assert.equal(await archiveBrand(brandA.id, testIds.organizationB), false);
  assert.equal((await listBrands(testIds.organizationB))[0]?.name, "30pay");

  const updatedBrand = await updateBrand(
    brandA.id,
    { name: "30pay revised", description: "Updated description", industry: "Education" },
    testIds.organizationA,
  );
  assert.equal(updatedBrand?.name, "30pay revised");
  assert.equal(updatedBrand?.description, "Updated description");

  assert.equal(await archiveBrand(brandA.id, testIds.organizationA), true);
  assert.equal((await listBrands(testIds.organizationA)).length, 0);

  const archivedBrand = await database.query.brands.findFirst({
    where: and(eq(brands.id, brandA.id), eq(brands.organizationId, testIds.organizationA)),
  });
  assert.equal(archivedBrand?.isActive, false);
  assert.equal(archivedBrand?.description, "Updated description");
});
