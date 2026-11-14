import assert from "node:assert/strict";
import { test } from "node:test";
import { brandUpdateSchema } from "@/lib/validation/brands";

test("brand updates accept a non-empty partial set of editable fields", () => {
  const result = brandUpdateSchema.safeParse({ name: "  30pay  ", description: "  Billing  " });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, { name: "30pay", description: "Billing" });
  }
});

test("brand updates reject empty or unknown fields", () => {
  assert.equal(brandUpdateSchema.safeParse({}).success, false);
  assert.equal(brandUpdateSchema.safeParse({ organizationId: "other-tenant" }).success, false);
});
