import assert from "node:assert/strict";
import test from "node:test";
import { clashes, overlaps, validBookingWindow } from "../src/lib/club-office.ts";

const start = "2026-12-01T10:00:00Z";
const end = "2026-12-01T12:00:00Z";
const reserved = { startsAt: start, endsAt: end };

test("booking windows require finite dates and a strictly positive duration", () => {
  assert.equal(validBookingWindow(start, end), true);
  assert.equal(validBookingWindow(start, start), false);
  assert.equal(validBookingWindow(end, start), false);
  assert.equal(validBookingWindow(null, end), false);
  assert.equal(validBookingWindow("invalid", end), false);
});

test("venue overlap checks use absolute timestamps and allow adjacent bookings", () => {
  assert.equal(
    overlaps(reserved, {
      startsAt: "2026-12-01T15:00:00+05:00",
      endsAt: "2026-12-01T16:00:00+05:00",
    }),
    true,
  );
  assert.equal(overlaps(reserved, { startsAt: end, endsAt: "2026-12-01T14:00:00Z" }), false);
});

test("invalid or zero-length intervals cannot be treated as overlapping bookings", () => {
  assert.deepEqual(clashes({ startsAt: start, endsAt: start }, [reserved]), []);
  assert.deepEqual(clashes({ startsAt: end, endsAt: start }, [reserved]), []);
  assert.equal(overlaps(reserved, { startsAt: "invalid", endsAt: end }), false);
});
