import assert from "node:assert/strict";
import test from "node:test";
import { countSocialCopyCharacters, exceedsSocialCopyLimit } from "@/lib/social-copy";
import { getInteractionsChange } from "@/lib/server/social-analytics/metrics";

test("social copy limits count Unicode code points consistently", () => {
  assert.equal(countSocialCopyCharacters("a😀b"), 3);
  assert.equal(exceedsSocialCopyLimit("a😀b", 2), true);
  assert.equal(exceedsSocialCopyLimit("a😀b", 3), false);
});

test("a missing channel limit does not impose a platform-specific restriction", () => {
  assert.equal(exceedsSocialCopyLimit("x".repeat(5_000), null), false);
  assert.equal(exceedsSocialCopyLimit("x".repeat(5_000), undefined), false);
});

test("engagement changes compare only metrics available in both snapshots", () => {
  assert.equal(getInteractionsChange({ likes: 18, comments: 4, shares: null }, { likes: 12, comments: 5, shares: null }), 5);
  assert.equal(getInteractionsChange({ likes: 18, comments: 4, shares: null }, { likes: 12, comments: 5, shares: 2 }), null);
  assert.equal(getInteractionsChange({ likes: null, comments: null, shares: null }, { likes: 0, comments: 0, shares: 0 }), null);
});
