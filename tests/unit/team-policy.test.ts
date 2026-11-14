import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANT_ROLE } from "@/lib/constants";
import { canManageTeamMember } from "@/lib/server/team-policy";

test("team owners can manage non-owner members, including administrator assignments", () => {
  assert.equal(canManageTeamMember("owner-id", TENANT_ROLE.owner, "editor-id", TENANT_ROLE.editor, TENANT_ROLE.admin), true);
  assert.equal(canManageTeamMember("owner-id", TENANT_ROLE.owner, "admin-id", TENANT_ROLE.admin), true);
});

test("team administrators can manage non-admin members but cannot assign administrator role", () => {
  assert.equal(canManageTeamMember("admin-id", TENANT_ROLE.admin, "editor-id", TENANT_ROLE.editor, TENANT_ROLE.approver), true);
  assert.equal(canManageTeamMember("admin-id", TENANT_ROLE.admin, "editor-id", TENANT_ROLE.editor, TENANT_ROLE.admin), false);
  assert.equal(canManageTeamMember("admin-id", TENANT_ROLE.admin, "other-admin-id", TENANT_ROLE.admin), false);
});

test("team operations fail closed for owners, self-management, and non-admin roles", () => {
  assert.equal(canManageTeamMember("admin-id", TENANT_ROLE.admin, "owner-id", TENANT_ROLE.owner), false);
  assert.equal(canManageTeamMember("admin-id", TENANT_ROLE.admin, "admin-id", TENANT_ROLE.admin), false);
  assert.equal(canManageTeamMember("editor-id", TENANT_ROLE.editor, "member-id", TENANT_ROLE.analyst), false);
  assert.equal(canManageTeamMember("admin-id", "unknown", "member-id", TENANT_ROLE.editor), false);
});
