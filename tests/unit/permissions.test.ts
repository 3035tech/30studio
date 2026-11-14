import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANT_PERMISSIONS, TENANT_ROLE } from "@/lib/constants";
import { hasTenantPermission } from "@/lib/server/permissions";

test("brand management permission follows the tenant role policy", () => {
  assert.equal(hasTenantPermission(TENANT_ROLE.owner, TENANT_PERMISSIONS.brandsManage), true);
  assert.equal(hasTenantPermission(TENANT_ROLE.admin, TENANT_PERMISSIONS.brandsManage), true);
  assert.equal(hasTenantPermission(TENANT_ROLE.editor, TENANT_PERMISSIONS.brandsManage), false);
  assert.equal(hasTenantPermission(TENANT_ROLE.approver, TENANT_PERMISSIONS.brandsManage), false);
  assert.equal(hasTenantPermission(TENANT_ROLE.analyst, TENANT_PERMISSIONS.brandsManage), false);
});

test("calendar access separates content readers from idea creators", () => {
  assert.equal(hasTenantPermission(TENANT_ROLE.editor, TENANT_PERMISSIONS.contentRead), true);
  assert.equal(hasTenantPermission(TENANT_ROLE.editor, TENANT_PERMISSIONS.contentManage), true);
  assert.equal(hasTenantPermission(TENANT_ROLE.approver, TENANT_PERMISSIONS.contentRead), true);
  assert.equal(hasTenantPermission(TENANT_ROLE.approver, TENANT_PERMISSIONS.contentManage), false);
  assert.equal(hasTenantPermission(TENANT_ROLE.analyst, TENANT_PERMISSIONS.contentManage), false);
});

test("unknown and malformed roles fail closed", () => {
  assert.equal(hasTenantPermission("unknown", TENANT_PERMISSIONS.brandsManage), false);
  assert.equal(hasTenantPermission(" ,unknown, ", TENANT_PERMISSIONS.brandsManage), false);
});

test("multiple recognized roles grant only their combined permissions", () => {
  assert.equal(hasTenantPermission(`unknown, ${TENANT_ROLE.editor}`, TENANT_PERMISSIONS.brandsRead), true);
  assert.equal(hasTenantPermission(`unknown, ${TENANT_ROLE.editor}`, TENANT_PERMISSIONS.brandsManage), false);
});
