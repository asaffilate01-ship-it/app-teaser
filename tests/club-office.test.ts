import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableToLend,
  clashes,
  feeScheduleTargets,
  feeTotals,
  maxPayment,
  officeAccess,
  rideBlocker,
  seatsLeft,
  selectionWarnings,
  toMinor,
} from "../src/lib/club-office.ts";
import { assignableRoles, can } from "../src/lib/platform.ts";

test("club admins can only hand out roles below them; owners can hand out any", () => {
  assert.deepEqual(assignableRoles("club_admin"), [
    "treasurer",
    "team_manager",
    "scorer",
    "coach",
    "player",
    "viewer",
  ]);
  assert.ok(!assignableRoles("club_admin").includes("owner"));
  assert.ok(!assignableRoles("club_admin").includes("safeguarding_officer"));
  assert.ok(assignableRoles("owner").includes("club_admin"));
  assert.deepEqual(assignableRoles("coach"), []);
  assert.deepEqual(assignableRoles("treasurer"), []);
});

test("treasurer manages fees and kit; coach does not manage fees", () => {
  assert.equal(can("treasurer", "fees.manage"), true);
  assert.equal(can("treasurer", "store.manage"), true);
  assert.equal(can("coach", "fees.manage"), false);
  assert.equal(can("team_manager", "events.manage"), true);
  assert.equal(can("team_manager", "fees.manage"), false);
});

test("only owners and safeguarding officers approve drivers", () => {
  assert.equal(can("owner", "drivers.approve"), true);
  assert.equal(can("safeguarding_officer", "drivers.approve"), true);
  assert.equal(can("club_admin", "drivers.approve"), false);
  assert.equal(can("team_manager", "drivers.approve"), false);
});

test("access table: coach requests bookings, players only see their own", () => {
  assert.equal(officeAccess("coach").bookings, "request");
  assert.equal(officeAccess("coach").events, "manage");
  assert.equal(officeAccess("player").fees, "own");
  assert.equal(officeAccess("viewer").store, "own");
});

test("fee totals skip waived charges and count overdue balances", () => {
  const totals = feeTotals(
    [
      {
        amountMinor: 2500000,
        paidMinor: 1000000,
        currency: "PKR",
        status: "part_paid",
        dueOn: "2026-01-01",
      },
      { amountMinor: 500000, paidMinor: 0, currency: "PKR", status: "waived", dueOn: "2026-01-01" },
      { amountMinor: 3000, paidMinor: 3000, currency: "GBP", status: "paid", dueOn: null },
    ],
    "2026-02-01",
  );
  const pkr = totals.find((row) => row.currency === "PKR");
  assert.deepEqual(pkr, {
    currency: "PKR",
    billed: 2500000,
    paid: 1000000,
    outstanding: 1500000,
    overdue: 1500000,
  });
  assert.equal(totals.find((row) => row.currency === "GBP")?.outstanding, 0);
});

test("payments can never be more than what is owed", () => {
  assert.equal(
    maxPayment({
      amountMinor: 2500000,
      paidMinor: 1000000,
      currency: "PKR",
      status: "part_paid",
      dueOn: null,
    }),
    1500000,
  );
  assert.equal(
    maxPayment({ amountMinor: 100, paidMinor: 0, currency: "PKR", status: "waived", dueOn: null }),
    0,
  );
});

test("amounts typed with commas become minor units", () => {
  assert.equal(toMinor("25,000", "PKR"), 2500000);
  assert.equal(toMinor("29.50", "GBP"), 2950);
  assert.equal(toMinor("-5", "GBP"), null);
  assert.equal(toMinor("", "GBP"), null);
});

test("junior players need an approved driver and a parent's yes", () => {
  const base = {
    isJunior: true,
    driverApproved: true,
    guardianConsent: true,
    seatsLeft: 2,
    rideCancelled: false,
  };
  assert.equal(rideBlocker(base), null);
  assert.match(rideBlocker({ ...base, driverApproved: false }) ?? "", /approved/);
  assert.match(rideBlocker({ ...base, guardianConsent: false }) ?? "", /parent/);
  assert.equal(
    rideBlocker({ ...base, isJunior: false, driverApproved: false, guardianConsent: false }),
    null,
  );
  assert.match(rideBlocker({ ...base, seatsLeft: 0 }) ?? "", /full/);
});

test("cars cannot be overbooked; declined and cancelled seats are freed", () => {
  assert.equal(
    seatsLeft(3, [
      { status: "confirmed" },
      { status: "requested" },
      { status: "declined" },
      { status: "cancelled" },
    ]),
    1,
  );
  assert.equal(seatsLeft(1, [{ status: "confirmed" }, { status: "requested" }]), 0);
});

test("ground bookings that overlap are flagged", () => {
  const taken = [{ startsAt: "2026-05-02T10:00:00Z", endsAt: "2026-05-02T16:00:00Z" }];
  assert.equal(
    clashes({ startsAt: "2026-05-02T12:00:00Z", endsAt: "2026-05-02T14:00:00Z" }, taken).length,
    1,
  );
  assert.equal(
    clashes({ startsAt: "2026-05-02T16:00:00Z", endsAt: "2026-05-02T18:00:00Z" }, taken).length,
    0,
  );
});

test("equipment cannot be lent beyond stock", () => {
  assert.equal(availableToLend(2, [{ quantity: 2, returnedAt: null }]), 0);
  assert.equal(
    availableToLend(3, [
      { quantity: 2, returnedAt: "2026-01-01" },
      { quantity: 1, returnedAt: null },
    ]),
    2,
  );
});

test("team sheet warnings: wrong side size, no captain, unavailable pick", () => {
  const answers = new Map([["p1", "unavailable" as const]]);
  const warnings = selectionWarnings(
    [{ playerId: "p1", slot: "playing", captain: false, wicketkeeper: true }],
    answers,
    11,
  );
  assert.ok(warnings.includes("1 of 11 players picked to play."));
  assert.ok(warnings.includes("No captain chosen."));
  assert.ok(warnings.some((w) => w.includes("can't make it")));
});

import { claimableAmount, cleanReference } from "../src/lib/club-office.ts";

test("members can't claim more than is owed, counting payments waiting to be checked", () => {
  const charge = {
    amountMinor: 2500000,
    paidMinor: 1000000,
    currency: "PKR",
    status: "part_paid" as const,
    dueOn: null,
  };
  assert.equal(claimableAmount(charge, []), 1500000);
  assert.equal(claimableAmount(charge, [1000000]), 500000);
  assert.equal(claimableAmount(charge, [1500000]), 0);
});

test("a transfer reference is required and trimmed", () => {
  assert.equal(cleanReference("  RAAST 123456  "), "RAAST 123456");
  assert.equal(cleanReference("ab"), null);
  assert.equal(cleanReference("   "), null);
});

test("fee amounts reject malformed grouping, excess precision and unsafe integers", () => {
  for (const input of ["1,2", "1 2", "1.001", "0.001", "1.", "9007199254740992"]) {
    assert.equal(toMinor(input, "GBP"), null, input);
  }
  assert.equal(toMinor("2,500.50", "GBP"), 250050);
  assert.equal(toMinor("1,25,000.50", "INR"), 12500050);
  assert.equal(toMinor("1 250.5", "GBP"), 125050);
  assert.equal(toMinor("100.50", "JPY"), null);
});

test("fee targets never expand a missing or external team into a whole-club charge", () => {
  const players = ["p1", "p2", "p2"];
  const teams = [
    { id: "own", playerIds: ["p1", "p1", "other"] },
    { id: "external", playerIds: ["p2"], external: true },
  ];
  assert.deepEqual(feeScheduleTargets({ active: true, team_id: "own" }, teams, players), ["p1"]);
  assert.deepEqual(feeScheduleTargets({ active: true, team_id: "missing" }, teams, players), []);
  assert.deepEqual(feeScheduleTargets({ active: true, team_id: "external" }, teams, players), []);
  assert.deepEqual(feeScheduleTargets({ active: false, team_id: null }, teams, players), []);
  assert.deepEqual(feeScheduleTargets({ active: true, team_id: null }, teams, players), ["p1", "p2"]);
});
