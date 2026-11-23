import { can, type PlatformRole } from "./platform.ts";

/** Pure Club office rules. The database enforces the same limits; these give instant feedback. */

const zeroDecimal = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "RWF"]);

/** ISO 4217 minor-unit digits (fixed list so every device stores the same amounts). */
export function currencyDigits(currency: string): number {
  return zeroDecimal.has(currency) ? 0 : 2;
}

/** "2,500.50" → minor units. Returns null for empty, negative or non-numeric input. */
export function toMinor(amount: string, currency: string): number | null {
  const cleaned = amount.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const digits = currencyDigits(currency);
  const value = Math.round(Number(cleaned) * 10 ** digits);
  return value > 0 ? value : null;
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
  return (charge.status === "due" || charge.status === "part_paid") && !!charge.dueOn && charge.dueOn < today;
}

/** Totals per currency; waived charges are left out of what is owed. */
export function feeTotals(charges: ChargeLike[], today: string): FeeTotals[] {
  const map = new Map<string, FeeTotals>();
  for (const charge of charges) {
    if (charge.status === "waived") continue;
    const row = map.get(charge.currency) ?? { currency: charge.currency, billed: 0, paid: 0, outstanding: 0, overdue: 0 };
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
  return charge.status === "waived" ? 0 : Math.max(0, charge.amountMinor - charge.paidMinor);
}

export type Availability = "available" | "unavailable" | "maybe";

export function availabilitySummary(playerIds: string[], answers: Map<string, Availability>) {
  const summary = { available: 0, maybe: 0, unavailable: 0, noReply: [] as string[] };
  for (const id of playerIds) {
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
  if (playing.length !== sideSize) warnings.push(`${playing.length} of ${sideSize} players picked to play.`);
  if (!picks.some((pick) => pick.captain)) warnings.push("No captain chosen.");
  if (!picks.some((pick) => pick.wicketkeeper)) warnings.push("No wicketkeeper chosen.");
  const unavailable = picks.filter((pick) => answers.get(pick.playerId) === "unavailable").length;
  if (unavailable) warnings.push(`${unavailable} picked player${unavailable === 1 ? " has" : "s have"} said they can't make it.`);
  return warnings;
}

export type BookingStatus = "requested" | "confirmed" | "declined" | "cancelled";

export function seatsLeft(seats: number, bookings: { status: BookingStatus }[]): number {
  return Math.max(0, seats - bookings.filter((b) => b.status === "requested" || b.status === "confirmed").length);
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

export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return new Date(a.startsAt) < new Date(b.endsAt) && new Date(b.startsAt) < new Date(a.endsAt);
}

export function clashes<T extends TimeSlot>(candidate: TimeSlot, taken: T[]): T[] {
  return taken.filter((slot) => overlaps(candidate, slot));
}

export function availableToLend(stock: number, loans: { quantity: number; returnedAt: string | null }[]): number {
  return Math.max(0, stock - loans.filter((loan) => !loan.returnedAt).reduce((sum, loan) => sum + loan.quantity, 0));
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
