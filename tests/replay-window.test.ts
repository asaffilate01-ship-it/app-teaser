import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedReviewRows,
  makeReviewWindow,
  nextCueLimit,
  reviewClipLimit,
  reviewCuePageSize,
  reviewDeliveryLimit,
  validReviewWindow,
} from "../src/lib/replay-window.ts";

test("valid device-local times become bounded UTC review windows", () => {
  const window = makeReviewWindow("2026-11-25T10:00", 30);
  assert.ok(window);
  assert.equal(window.start, new Date("2026-11-25T10:00").toISOString());
  assert.equal(Date.parse(window.end) - Date.parse(window.start), 30 * 60_000);
  assert.equal(validReviewWindow(window), true);
});

test("invalid local dates and unsupported window sizes cannot create queries", () => {
  for (const date of ["", "2026-02-30T10:00", "2026-11-25T25:00", "2026-11-25"]) {
    assert.equal(makeReviewWindow(date, 30), null);
  }
  assert.equal(makeReviewWindow("2026-11-25T10:00", 0), null);
  assert.equal(makeReviewWindow("2026-11-25T10:00", 120), null);
  assert.equal(
    validReviewWindow({ start: "2026-11-25T10:00:00Z", end: "2026-11-25T09:00:00Z" }),
    false,
  );
});

test("fetching one extra row distinguishes complete and truncated recording windows", () => {
  for (const limit of [reviewClipLimit, reviewDeliveryLimit]) {
    const rows = Array.from({ length: limit + 1 }, (_, index) => index);
    assert.deepEqual(boundedReviewRows(rows.slice(0, limit), limit), {
      rows: rows.slice(0, limit),
      truncated: false,
    });
    assert.deepEqual(boundedReviewRows(rows, limit), {
      rows: rows.slice(0, limit),
      truncated: true,
    });
  }
});

test("delivery cue pages advance without exceeding the available cues", () => {
  assert.equal(nextCueLimit(reviewCuePageSize, 500), 200);
  assert.equal(nextCueLimit(200, 215), 215);
  assert.equal(nextCueLimit(215, 215), 215);
});
