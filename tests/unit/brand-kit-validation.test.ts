import assert from "node:assert/strict";
import { test } from "node:test";
import { brandKitContentSchema } from "@/lib/validation/brand-kits";

const VALID_BRAND_KIT = {
  audience: "School owners and sports program coordinators",
  toneOfVoice: "Clear, practical, and supportive",
  colors: ["#6A00FF", "#112233"],
  fontFamilies: ["Inter"],
  keyMessages: ["Simplify school operations"],
  products: ["Billing management"],
  verifiedFacts: [{ statement: "Supports recurring billing", sourceUrl: "https://example.com/product" }],
  restrictedClaims: ["Guaranteed growth"],
  callsToAction: ["Book a demo"],
};

test("Brand Kit content accepts valid colors and cited product facts", () => {
  assert.equal(brandKitContentSchema.safeParse(VALID_BRAND_KIT).success, true);
});

test("Brand Kit content rejects untraceable facts and invalid color tokens", () => {
  const invalidSource = {
    ...VALID_BRAND_KIT,
    verifiedFacts: [{ statement: "Unverified statement", sourceUrl: "javascript:alert(1)" }],
  };
  const invalidColor = { ...VALID_BRAND_KIT, colors: ["violet"] };

  assert.equal(brandKitContentSchema.safeParse(invalidSource).success, false);
  assert.equal(brandKitContentSchema.safeParse(invalidColor).success, false);
});
