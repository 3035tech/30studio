import assert from "node:assert/strict";
import test from "node:test";
import { countSocialCopyCharacters, exceedsSocialCopyLimit } from "@/lib/social-copy";

test("social copy limits count Unicode code points consistently", () => {
  assert.equal(countSocialCopyCharacters("a😀b"), 3);
  assert.equal(exceedsSocialCopyLimit("a😀b", 2), true);
  assert.equal(exceedsSocialCopyLimit("a😀b", 3), false);
});

test("a missing channel limit does not impose a platform-specific restriction", () => {
  assert.equal(exceedsSocialCopyLimit("x".repeat(5_000), null), false);
  assert.equal(exceedsSocialCopyLimit("x".repeat(5_000), undefined), false);
});
