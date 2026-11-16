import assert from "node:assert/strict";
import { test } from "node:test";
import { WORKSPACE_LIMITS } from "@/lib/constants";
import { workspaceNameUpdateSchema, workspaceSettingsResponseSchema } from "@/lib/validation/workspace-settings";

test("workspace name updates trim and bound the display name without accepting tenant scope", () => {
  const result = workspaceNameUpdateSchema.safeParse({ name: "  3035 Marketing  " });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.name, "3035 Marketing");
  assert.equal(workspaceNameUpdateSchema.safeParse({ name: " " }).success, false);
  assert.equal(workspaceNameUpdateSchema.safeParse({ name: "x".repeat(WORKSPACE_LIMITS.nameCharacters + 1) }).success, false);
  assert.equal(workspaceNameUpdateSchema.safeParse({ name: "Valid", organizationId: "another-tenant" }).success, false);
});

test("workspace settings response requires the stable identifier and permission state", () => {
  const valid = { data: { id: "org_123", name: "Workspace", slug: "workspace-123" }, canManage: true };
  assert.equal(workspaceSettingsResponseSchema.safeParse(valid).success, true);
  assert.equal(workspaceSettingsResponseSchema.safeParse({ ...valid, data: { ...valid.data, slug: "" } }).success, false);
  assert.equal(workspaceSettingsResponseSchema.safeParse({ data: valid.data }).success, false);
});
