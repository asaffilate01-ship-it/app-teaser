import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTicketCode, isTicketGate, isTicketManager, listingTotals, mostCanBuy, normaliseTicketCode, ticketsLeft } from "../src/lib/tickets.ts";

test("payments still being checked hold seats; rejected and cancelled don't", () => {
  assert.equal(ticketsLeft(100, [
    { quantity: 4, status: "confirmed" },
    { quantity: 3, status: "pending" },
    { quantity: 10, status: "rejected" },
    { quantity: 2, status: "cancelled" },
  ]), 93);
  assert.equal(ticketsLeft(2, [{ quantity: 5, status: "confirmed" }]), 0);
});

test("a buyer can't go past the per-order maximum, counting tickets they already hold", () => {
  assert.equal(mostCanBuy({ remaining: 50, maxPerOrder: 6, alreadyHeld: 4 }), 2);
  assert.equal(mostCanBuy({ remaining: 1, maxPerOrder: 6 }), 1);
  assert.equal(mostCanBuy({ remaining: 50, maxPerOrder: 6, alreadyHeld: 6 }), 0);
});

test("takings count only confirmed money; admitted counts only checked-in fans", () => {
  assert.deepEqual(listingTotals(20, [
    { quantity: 2, status: "confirmed", amount_minor: 1000, checked_in_at: "2026-11-23T10:00:00Z" },
    { quantity: 3, status: "confirmed", amount_minor: 1500, checked_in_at: null },
    { quantity: 1, status: "pending", amount_minor: 500 },
  ]), { sold: 5, waiting: 1, admitted: 2, takenMinor: 2500, left: 14 });
});

test("ticket codes typed with spaces, dashes or lower case still match", () => {
  assert.equal(normaliseTicketCode("ab12c-d34 ef"), "AB12CD34EF");
  assert.equal(formatTicketCode("ab12cd34ef"), "AB12C-D34EF");
});

test("owner, admins and treasurer manage tickets; gate check-in adds team managers and coaches", () => {
  assert.equal(isTicketManager("treasurer"), true);
  assert.equal(isTicketManager("team_manager"), false);
  assert.equal(isTicketGate("team_manager"), true);
  assert.equal(isTicketGate("player"), false);
});
