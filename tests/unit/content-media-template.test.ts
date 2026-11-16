import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { CONTENT_MEDIA_TEMPLATE } from "@/lib/constants";
import { buildTextCardSvg, renderTextCard } from "@/lib/server/content-media-template";
import type { BrandKitContent } from "@/lib/validation/brand-kits";

const brandKit: BrandKitContent = {
  audience: "",
  toneOfVoice: "",
  colors: ["#1976D2"],
  fontFamilies: ["Arial"],
  keyMessages: [],
  products: [],
  verifiedFacts: [],
  restrictedClaims: [],
  callsToAction: [],
};

test("renders a square text card using an approved brand color and bounded copy excerpt", async () => {
  const png = await renderTextCard({ title: "A saved post title", copy: "A short channel-specific caption.", brandKit });
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, CONTENT_MEDIA_TEMPLATE.width);
  assert.equal(metadata.height, CONTENT_MEDIA_TEMPLATE.height);
  assert.equal(buildTextCardSvg({ title: "A saved post title", copy: "A short channel-specific caption.", brandKit }).includes("#1976D2"), true);
});

test("escapes untrusted copy before SVG rendering and rejects empty or oversized titles", () => {
  const svg = buildTextCardSvg({ title: "<script>unsafe</script>", copy: "Caption", brandKit });
  assert.equal(svg.includes("<script>"), false);
  assert.equal(svg.includes("&lt;script&gt;"), true);
  assert.throws(() => buildTextCardSvg({ title: "  ", copy: "Caption", brandKit }));
  assert.throws(() => buildTextCardSvg({ title: "x".repeat(CONTENT_MEDIA_TEMPLATE.maximumTitleCharacters + 1), copy: "Caption", brandKit }));
});

test("uses a neutral palette when a Brand Kit has no approved colors", () => {
  const svg = buildTextCardSvg({ title: "Neutral card", copy: "Caption", brandKit: { ...brandKit, colors: [] } });
  assert.equal(svg.includes(CONTENT_MEDIA_TEMPLATE.neutralAccent), true);
  assert.equal(svg.includes(CONTENT_MEDIA_TEMPLATE.neutralBackground), true);
});

test("adds a page position marker to carousel cards", () => {
  const svg = buildTextCardSvg({ title: "Carousel topic", copy: "First page copy", brandKit, pageNumber: 2, pageCount: 3 });
  assert.equal(svg.includes(">2 / 3</text>"), true);
});
