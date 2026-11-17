import assert from "node:assert/strict";
import test from "node:test";
import { workspaceNotificationReadRequestSchema, workspaceNotificationResponseSchema } from "../../lib/validation/workspace-notifications";

test("notification history accepts tenant-scoped event records and nullable content details", () => {
  const parsed = workspaceNotificationResponseSchema.safeParse({
    data: [{
      id: "13db49b4-2ccd-4743-94ef-8ae5f99bb74a",
      eventType: "social_connection_failed",
      brandId: "e2f240af-219e-4c9b-9b3b-e56868a79a40",
      brandName: "3035TECH",
      contentItemId: null,
      contentTitle: null,
      plannedAt: null,
      platform: "instagram",
      occurredAt: "2026-11-17T18:00:00.000Z",
      readAt: null,
    }],
  });

  assert.equal(parsed.success, true);
});

test("notification history rejects unknown event types and malformed timestamps", () => {
  const parsed = workspaceNotificationResponseSchema.safeParse({
    data: [{
      id: "13db49b4-2ccd-4743-94ef-8ae5f99bb74a",
      eventType: "anything",
      brandId: null,
      brandName: null,
      contentItemId: null,
      contentTitle: null,
      plannedAt: null,
      platform: null,
      occurredAt: "yesterday",
      readAt: null,
    }],
  });

  assert.equal(parsed.success, false);
});

test("read state accepts only a boolean", () => {
  assert.equal(workspaceNotificationReadRequestSchema.safeParse({ read: true }).success, true);
  assert.equal(workspaceNotificationReadRequestSchema.safeParse({ read: "true" }).success, false);
  assert.equal(workspaceNotificationReadRequestSchema.safeParse({ read: true, userId: "attacker" }).success, false);
});
