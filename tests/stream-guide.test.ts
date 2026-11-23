import assert from "node:assert/strict";
import test from "node:test";
import { overlayUrl, presetForUpload, streamPlatforms } from "../src/lib/stream-guide.ts";

test("TikTok is portrait and uses the corner overlay; YouTube and Facebook are landscape bars", () => {
  const tiktok = streamPlatforms.find((item) => item.id === "tiktok")!;
  assert.deepEqual(tiktok.canvas, { width: 1080, height: 1920 });
  assert.equal(overlayUrl("https://criclume.com/", "lions-v-tigers", "tiktok"), "https://criclume.com/overlay/lions-v-tigers?layout=corner");
  assert.equal(overlayUrl("https://criclume.com", "lions-v-tigers", "youtube"), "https://criclume.com/overlay/lions-v-tigers");
});

test("upload speed picks the quality: 8+ Mbps → 1080p, 5+ → 720p, below 5 → too slow", () => {
  assert.equal(presetForUpload(10)?.label, "1080p, 30 fps");
  assert.equal(presetForUpload(6)?.label, "720p, 30 fps");
  assert.equal(presetForUpload(3), null);
});
