import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPanelRules,
  feeFor,
  hasClash,
  missingChecks,
  moneyTotals,
  rankUmpires,
  toMinor,
  travelFor,
  type AppointmentLike,
  type UmpireLike,
} from "../src/lib/umpires.ts";

const base: UmpireLike = {
  id: "u1",
  user_id: "p1",
  display_name: "Ada",
  grade: "club",
  status: "active",
  pay_basis: "paid",
  match_fee_minor: null,
  qualification: null,
  qualification_expires: null,
  safeguarding_expires: "2026-12-31",
  first_aid_expires: null,
  kit_ok: false,
};

const appt = (over: Partial<AppointmentLike>): AppointmentLike => ({
  id: "a",
  umpire_id: "u1",
  starts_at: "2026-12-05T10:00:00Z",
  status: "accepted",
  pay_basis: "paid",
  fee_minor: 0,
  expenses_minor: 0,
  payment_status: "not_due",
  currency: "GBP",
  ...over,
});

test("a safeguarding check that ends before match day blocks the appointment", () => {
  assert.deepEqual(missingChecks(base, defaultPanelRules, "2026-12-31"), []);
  assert.deepEqual(missingChecks(base, defaultPanelRules, "2027-01-01"), ["Safeguarding check"]);
});

test("only the checks the panel asks for are required", () => {
  const strict = { ...defaultPanelRules, requires_first_aid: true, requires_kit: true, requires_qualification: true };
  assert.deepEqual(missingChecks(base, strict, "2026-12-01"), ["Qualification", "First aid", "Kit check"]);
});

test("paused umpires can't be appointed", () => {
  assert.deepEqual(missingChecks({ ...base, status: "paused" }, defaultPanelRules, "2026-12-01"), ["Paused on the panel"]);
});

test("matches less than 8 hours apart clash; 8 hours apart don't", () => {
  const rows = [appt({ id: "x", starts_at: "2026-12-05T10:00:00Z" })];
  assert.equal(hasClash("u1", "2026-12-05T17:59:00Z", rows), true);
  assert.equal(hasClash("u1", "2026-12-05T18:00:00Z", rows), false);
  assert.equal(hasClash("u1", "2026-12-05T12:00:00Z", [appt({ status: "declined" })]), false);
});

test("voluntary umpires are offered no fee; paid ones get their own fee or the panel default", () => {
  const rules = { ...defaultPanelRules, default_fee_minor: 2500 };
  assert.equal(feeFor({ pay_basis: "voluntary", match_fee_minor: 4000 }, rules), 0);
  assert.equal(feeFor({ pay_basis: "paid", match_fee_minor: 4000 }, rules), 4000);
  assert.equal(feeFor({ pay_basis: "paid", match_fee_minor: null }, rules), 2500);
});

test("travel is distance times the panel rate per km", () => {
  assert.equal(travelFor(42, { travel_rate_minor: 45 }), 1890);
  assert.equal(travelFor(-3, { travel_rate_minor: 45 }), 0);
});

test("ranking puts available, fair-share umpires first and blocked ones last", () => {
  const umpires: UmpireLike[] = [
    { ...base, id: "busy", user_id: "pb", display_name: "Busy" },
    { ...base, id: "fresh", user_id: "pf", display_name: "Fresh" },
    { ...base, id: "away", user_id: "pa", display_name: "Away" },
    { ...base, id: "nocheck", user_id: null, display_name: "No check", safeguarding_expires: null },
  ];
  const ranked = rankUmpires({
    umpires,
    rules: defaultPanelRules,
    startsAt: "2026-12-12T10:00:00Z",
    appointments: [appt({ id: "1", umpire_id: "busy", starts_at: "2026-06-01T10:00:00Z" }), appt({ id: "2", umpire_id: "busy", starts_at: "2026-07-01T10:00:00Z" })],
    availability: [
      { user_id: "pb", day: "2026-12-12", status: "available" },
      { user_id: "pf", day: "2026-12-12", status: "available" },
      { user_id: "pa", day: "2026-12-12", status: "unavailable" },
    ],
  });
  assert.equal(ranked[0]!.umpire.id, "fresh");
  assert.equal(ranked[1]!.umpire.id, "busy");
  assert.ok(ranked.slice(2).every((row) => row.blockers.length > 0));
  assert.deepEqual(ranked.find((row) => row.umpire.id === "away")!.blockers, ["Unavailable that day"]);
});

test("money totals split owed, approved and paid and count voluntary matches", () => {
  const totals = moneyTotals([
    appt({ status: "completed", fee_minor: 2500, expenses_minor: 1000, payment_status: "due" }),
    appt({ status: "completed", fee_minor: 2500, payment_status: "approved" }),
    appt({ status: "completed", fee_minor: 2500, expenses_minor: 500, payment_status: "paid" }),
    appt({ status: "completed", pay_basis: "voluntary", payment_status: "not_applicable" }),
  ]);
  assert.deepEqual(totals["GBP"], { owed: 3500, approved: 2500, paid: 3000, voluntaryMatches: 1 });
});

test("typed amounts convert to minor units", () => {
  assert.equal(toMinor("25"), 2500);
  assert.equal(toMinor("1,250.5"), 125050);
  assert.equal(toMinor("abc"), null);
});

test("owners, club admins and league admins run the umpire panel; treasurers only pay", async () => {
  const { can } = await import("../src/lib/platform.ts");
  for (const role of ["owner", "club_admin", "league_admin"] as const) {
    assert.equal(can(role, "umpires.manage"), true, role);
    assert.equal(can(role, "umpires.pay"), true, role);
  }
  assert.equal(can("treasurer", "umpires.manage"), false);
  assert.equal(can("treasurer", "umpires.pay"), true);
  for (const role of ["team_manager", "scorer", "coach", "player", "viewer", "safeguarding_officer"] as const) {
    assert.equal(can(role, "umpires.pay"), false, role);
  }
});
