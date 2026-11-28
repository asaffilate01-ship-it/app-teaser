import { can, type PlatformRole } from "./platform.ts";

/** Pure Club office rules. The database enforces the same limits; these give instant feedback. */

const zeroDecimal = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "RWF"]);

/** ISO 4217 minor-unit digits (fixed list so every device stores the same amounts). */
export function currencyDigits(currency: string): number {
  return zeroDecimal.has(currency) ? 0 : 2;
}

/** Parse major units exactly; never round a payment or silently strip malformed grouping. */
export function toMinor(amount: string, currency: string): number | null {
  const cleaned = amount.trim().replace(/[\u00a0\u202f]/g, " ");
  const [whole, fraction = "", ...extra] = cleaned.split(".");
  if (!whole || extra.length || (cleaned.includes(".") && !/^\d+$/.test(fraction))) return null;
  const grouped = /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3}|\d{1,3}(?: \d{3})+)$/;
  if (!grouped.test(whole)) return null;
  const digits = currencyDigits(currency);
  if (fraction.length > digits) return null;
  const value = Number(whole.replace(/[, ]/g, "") + fraction.padEnd(digits, "0"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function formatMoney(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: minor % 10 ** digits === 0 ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(minor / 10 ** digits);
  } catch {
    return `${currency} ${(minor / 10 ** digits).toFixed(digits)}`;
  }
}

/** An unavailable team never widens a fee schedule to the whole club. */
export function feeScheduleTargets(
  schedule: { active: boolean; team_id: string | null },
  teams: readonly { id: string; playerIds: readonly string[]; external?: boolean }[],
  playerIds: readonly string[],
): string[] {
  if (!schedule.active) return [];
  const eligible = new Set(playerIds);
  if (schedule.team_id === null) return [...eligible];
  const team = teams.find((item) => item.id === schedule.team_id && !item.external);
  if (!team) return [];
  return [...new Set(team.playerIds)].filter((id) => eligible.has(id));
}

export interface ChargeLike {
  amountMinor: number;
  paidMinor: number;
  currency: string;
  status: "due" | "part_paid" | "paid" | "waived";
  dueOn: string | null;
}

export interface FeeTotals {
  currency: string;
  billed: number;
  paid: number;
  outstanding: number;
  overdue: number;
}

export function isOverdue(charge: ChargeLike, today: string): boolean {
  return (
    (charge.status === "due" || charge.status === "part_paid") &&
    !!charge.dueOn &&
    charge.dueOn < today
  );
}

/** Totals per currency; waived charges are left out of what is owed. */
export function feeTotals(charges: ChargeLike[], today: string): FeeTotals[] {
  const map = new Map<string, FeeTotals>();
  for (const charge of charges) {
    if (charge.status === "waived") continue;
    const row = map.get(charge.currency) ?? {
      currency: charge.currency,
      billed: 0,
      paid: 0,
      outstanding: 0,
      overdue: 0,
    };
    row.billed += charge.amountMinor;
    row.paid += charge.paidMinor;
    row.outstanding += Math.max(0, charge.amountMinor - charge.paidMinor);
    if (isOverdue(charge, today)) row.overdue += Math.max(0, charge.amountMinor - charge.paidMinor);
    map.set(charge.currency, row);
  }
  return [...map.values()];
}

/** Largest payment the treasurer can record against a charge. */
export function maxPayment(charge: ChargeLike): number {
  if (charge.status !== "due" && charge.status !== "part_paid") return 0;
  if (
    !Number.isSafeInteger(charge.amountMinor) ||
    charge.amountMinor < 0 ||
    !Number.isSafeInteger(charge.paidMinor) ||
    charge.paidMinor < 0
  )
    return 0;
  return Math.max(0, charge.amountMinor - charge.paidMinor);
}

/** "waitlist" is set by the database when an event's places are full. */
export type Availability = "available" | "unavailable" | "maybe" | "waitlist";

/** A team-scoped event must never expand to the whole club when its team is absent. */
export function eventSquad(
  teamId: string | null,
  teams: readonly { id: string; playerIds: readonly string[]; external?: boolean }[],
  playerIds: readonly string[],
): string[] {
  return feeScheduleTargets({ active: true, team_id: teamId }, teams, playerIds);
}

export function availabilitySummary(playerIds: string[], answers: Map<string, Availability>) {
  const summary = { available: 0, maybe: 0, unavailable: 0, waitlist: 0, noReply: [] as string[] };
  for (const id of new Set(playerIds)) {
    const answer = answers.get(id);
    if (answer) summary[answer] += 1;
    else summary.noReply.push(id);
  }
  return summary;
}

export interface SelectionLike {
  playerId: string;
  slot: "playing" | "twelfth" | "reserve";
  captain: boolean;
  wicketkeeper: boolean;
}

/** Friendly warnings before a team sheet is published. */
export function selectionWarnings(
  picks: SelectionLike[],
  answers: Map<string, Availability>,
  sideSize = 11,
): string[] {
  const warnings: string[] = [];
  const playing = picks.filter((pick) => pick.slot === "playing");
  if (playing.length !== sideSize)
    warnings.push(`${playing.length} of ${sideSize} players picked to play.`);
  const captains = playing.filter((pick) => pick.captain);
  const keepers = playing.filter((pick) => pick.wicketkeeper);
  if (!captains.length) warnings.push("No captain chosen.");
  if (captains.length > 1) warnings.push("More than one playing captain chosen.");
  if (!keepers.length) warnings.push("No wicketkeeper chosen.");
  if (keepers.length > 1) warnings.push("More than one playing wicketkeeper chosen.");
  if (picks.some((pick) => pick.slot !== "playing" && (pick.captain || pick.wicketkeeper))) {
    warnings.push("Captain and wicketkeeper must be selected to play.");
  }
  if (new Set(picks.map((pick) => pick.playerId)).size !== picks.length) {
    warnings.push("The team sheet contains duplicate players.");
  }
  const unavailable = picks.filter((pick) => answers.get(pick.playerId) === "unavailable").length;
  if (unavailable)
    warnings.push(
      `${unavailable} picked player${unavailable === 1 ? " has" : "s have"} said they can't make it.`,
    );
  return warnings;
}

export type BookingStatus = "requested" | "confirmed" | "declined" | "cancelled";

export function seatsLeft(seats: number, bookings: { status: BookingStatus }[]): number {
  return Math.max(
    0,
    seats - bookings.filter((b) => b.status === "requested" || b.status === "confirmed").length,
  );
}

/** Why a child can't take this seat, or null when they can. Mirrors the database rule. */
export function rideBlocker(input: {
  isJunior: boolean;
  driverApproved: boolean;
  guardianConsent: boolean;
  seatsLeft: number;
  rideCancelled: boolean;
}): string | null {
  if (input.rideCancelled) return "This ride was cancelled.";
  if (input.seatsLeft <= 0) return "This car is full.";
  if (input.isJunior && !input.driverApproved)
    return "Junior players can only travel with a driver approved by the safeguarding officer.";
  if (input.isJunior && !input.guardianConsent) return "A parent or guardian must agree first.";
  return null;
}

export interface TimeSlot {
  startsAt: string;
  endsAt: string;
}

export function validBookingWindow(startsAt: string | null, endsAt: string | null): boolean {
  if (!startsAt || !endsAt) return false;
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  if (!validBookingWindow(a.startsAt, a.endsAt) || !validBookingWindow(b.startsAt, b.endsAt))
    return false;
  return new Date(a.startsAt) < new Date(b.endsAt) && new Date(b.startsAt) < new Date(a.endsAt);
}

export function clashes<T extends TimeSlot>(candidate: TimeSlot, taken: T[]): T[] {
  return taken.filter((slot) => overlaps(candidate, slot));
}

export function availableToLend(
  stock: number,
  loans: { quantity: number; returnedAt: string | null }[],
): number {
  return Math.max(
    0,
    stock - loans.filter((loan) => !loan.returnedAt).reduce((sum, loan) => sum + loan.quantity, 0),
  );
}

export const officeAreas = [
  ["fees", "Fees and subs", "fees.manage"],
  ["bookings", "Ground bookings", "bookings.manage"],
  ["events", "Events and availability", "events.manage"],
  ["selection", "Team selection", "events.manage"],
  ["travel", "Travel and lifts", "travel.manage"],
  ["store", "Kit and equipment", "store.manage"],
] as const;

export type OfficeArea = (typeof officeAreas)[number][0];
export type AccessLevel = "manage" | "request" | "own";

/** What a role can do in each Club office area (for the on-screen access table). */
export function officeAccess(role: PlatformRole): Record<OfficeArea, AccessLevel> {
  const result = {} as Record<OfficeArea, AccessLevel>;
  for (const [area, , permission] of officeAreas) {
    if (can(role, permission)) result[area] = "manage";
    else if (area === "bookings" && can(role, "bookings.request")) result[area] = "request";
    else result[area] = "own";
  }
  return result;
}

/** Transaction references are trimmed and must be 3–120 characters (same as the database). */
export function cleanReference(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length >= 3 && trimmed.length <= 120 ? trimmed : null;
}

/** Most a member can say they've paid: what's owed minus payments still waiting to be checked. */
export function claimableAmount(charge: ChargeLike, pendingClaims: number[]): number {
  if (pendingClaims.some((value) => !Number.isSafeInteger(value) || value <= 0)) return 0;
  const pending = pendingClaims.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(pending)) return 0;
  return Math.max(0, maxPayment(charge) - pending);
}

/** Calendar day in the member's local timezone, rather than the UTC day. */
export function localPaymentDay(date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A payment already sent must have a real calendar date, not a future date. */
export function validPaidOn(value: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const transferMethods = [
  ["raast", "Raast"],
  ["easypaisa", "Easypaisa"],
  ["jazzcash", "JazzCash"],
  ["bank_transfer", "Bank transfer"],
  ["mpesa", "M-Pesa"],
  ["upi", "UPI"],
  ["bkash", "bKash"],
  ["other", "Other"],
] as const;

/** A calendar file (.ics) for one event, so players can add it to their phone's calendar. */
export function eventIcs(
  event: {
    id: string;
    title: string;
    starts_at: string;
    ends_at?: string | null;
    location?: string | null;
    notes?: string | null;
  },
  now = new Date(),
): string {
  const stamp = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escape = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
  const end =
    event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 3 * 3_600_000).toISOString();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CricLume//Club events//EN",
    "BEGIN:VEVENT",
    `UID:${encodeURIComponent(event.id)}@criclume.com`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(event.title)}`,
    ...(event.location ? [`LOCATION:${escape(event.location)}`] : []),
    ...(event.notes ? [`DESCRIPTION:${escape(event.notes)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map((line) => {
      const encoder = new TextEncoder();
      let folded = "";
      let bytes = 0;
      for (const character of line) {
        const length = encoder.encode(character).length;
        if (bytes + length > 75) {
          folded += "\r\n ";
          bytes = 1;
        }
        folded += character;
        bytes += length;
      }
      return folded;
    })
    .join("\r\n") + "\r\n";
}

/** Replies close at the deadline (managers can still change them). */
export const repliesClosed = (replyBy: string | null | undefined, now = Date.now()) =>
  Boolean(replyBy && new Date(replyBy).getTime() < now);
