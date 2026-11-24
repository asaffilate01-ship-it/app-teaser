/**
 * Pure umpire rules shared by the Club office Umpires tab and the umpire dashboard.
 * The database enforces the same checks (`umpire_appointment_before`); these helpers
 * only explain them up front and rank who to pick.
 */

export type UmpireGrade = "trainee" | "club" | "league" | "senior" | "elite";
export type PayBasis = "paid" | "voluntary";
export type AppointmentStatus = "offered" | "accepted" | "declined" | "withdrawn" | "completed";
export type PaymentStatus = "not_due" | "due" | "approved" | "paid" | "not_applicable";
export type AvailabilityStatus = "available" | "unavailable" | "maybe";
export type UmpirePosition = "standing" | "square_leg" | "third" | "fourth" | "referee" | "reserve";

export const gradeLabels: Record<UmpireGrade, string> = {
  trainee: "Trainee",
  club: "Club",
  league: "League",
  senior: "Senior",
  elite: "Elite",
};
export const gradeOrder: UmpireGrade[] = ["trainee", "club", "league", "senior", "elite"];

export const positionLabels: Record<UmpirePosition, string> = {
  standing: "Standing umpire",
  square_leg: "Square-leg umpire",
  third: "Third umpire",
  fourth: "Fourth umpire",
  referee: "Match referee",
  reserve: "Reserve",
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  offered: "Waiting for reply",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Pulled out",
  completed: "Done",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  not_due: "After the match",
  due: "Owed",
  approved: "Approved",
  paid: "Paid",
  not_applicable: "Nothing to pay",
};

export interface PanelRules {
  requires_qualification: boolean;
  requires_safeguarding: boolean;
  requires_first_aid: boolean;
  requires_kit: boolean;
  default_pay_basis: PayBasis;
  default_fee_minor: number;
  travel_rate_minor: number;
  currency: string;
  guidance?: string | null;
}

export const defaultPanelRules: PanelRules = {
  requires_qualification: false,
  requires_safeguarding: true,
  requires_first_aid: false,
  requires_kit: false,
  default_pay_basis: "paid",
  default_fee_minor: 0,
  travel_rate_minor: 0,
  currency: "GBP",
  guidance: null,
};

export interface UmpireLike {
  id: string;
  user_id: string | null;
  display_name: string;
  grade: string;
  status: string;
  pay_basis: string;
  match_fee_minor: number | null;
  qualification: string | null;
  qualification_expires: string | null;
  safeguarding_expires: string | null;
  first_aid_expires: string | null;
  kit_ok: boolean;
  max_travel_km?: number | null;
}

export interface AppointmentLike {
  id: string;
  umpire_id: string;
  starts_at: string;
  status: string;
  pay_basis: string;
  fee_minor: number;
  expenses_minor: number;
  payment_status: string;
  currency: string;
}

export interface AvailabilityLike {
  user_id: string;
  day: string;
  status: string;
}

/** True when an ISO date (YYYY-MM-DD) is on or after `day`. Missing dates count as not valid. */
function validOn(expires: string | null | undefined, day: string): boolean {
  return Boolean(expires) && String(expires) >= day;
}

/** Plain reasons an umpire can't be appointed on `day` (YYYY-MM-DD), matching the database checks. */
export function missingChecks(umpire: UmpireLike, rules: PanelRules, day: string): string[] {
  const missing: string[] = [];
  if (umpire.status !== "active")
    missing.push(umpire.status === "paused" ? "Paused on the panel" : "Left the panel");
  if (
    rules.requires_qualification &&
    (!umpire.qualification ||
      (umpire.qualification_expires !== null && umpire.qualification_expires < day))
  )
    missing.push("Qualification");
  if (rules.requires_safeguarding && !validOn(umpire.safeguarding_expires, day))
    missing.push("Safeguarding check");
  if (rules.requires_first_aid && !validOn(umpire.first_aid_expires, day))
    missing.push("First aid");
  if (rules.requires_kit && !umpire.kit_ok) missing.push("Kit check");
  return missing;
}

/** Checks that run out within `days` of `today` — shown as reminders. */
export function expiringSoon(umpire: UmpireLike, today: string, days = 30): string[] {
  const limit = addDays(today, days);
  const soon: string[] = [];
  const check = (label: string, value: string | null) => {
    if (value && value >= today && value <= limit) soon.push(label);
  };
  check("Qualification", umpire.qualification_expires);
  check("Safeguarding check", umpire.safeguarding_expires);
  check("First aid", umpire.first_aid_expires);
  return soon;
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The calendar day of an instant in a time zone (YYYY-MM-DD). */
export function dayIn(iso: string, timeZone = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

const CLASH_MS = 8 * 3_600_000;
const activeStatuses = new Set(["offered", "accepted"]);

/** Another live appointment within 8 hours — the same window the database uses. */
export function hasClash(
  umpireId: string,
  startsAt: string,
  appointments: AppointmentLike[],
  ignoreId?: string,
): boolean {
  const at = new Date(startsAt).getTime();
  return appointments.some(
    (row) =>
      row.id !== ignoreId &&
      row.umpire_id === umpireId &&
      activeStatuses.has(row.status) &&
      Math.abs(new Date(row.starts_at).getTime() - at) < CLASH_MS,
  );
}

export interface RankedUmpire<U extends UmpireLike> {
  umpire: U;
  blockers: string[];
  availability: AvailabilityStatus | "unknown";
  seasonCount: number;
  score: number;
}

/**
 * Order the panel for one match: anyone who can't be appointed goes last with the reason;
 * then said "available", then "maybe" / not answered; fewer matches this season first (fair share);
 * then higher grade.
 */
export function rankUmpires<U extends UmpireLike>(input: {
  umpires: U[];
  rules: PanelRules;
  startsAt: string;
  timeZone?: string;
  appointments: AppointmentLike[];
  availability: AvailabilityLike[];
  seasonStart?: string;
}): RankedUmpire<U>[] {
  const day = dayIn(input.startsAt, input.timeZone);
  const seasonStart = input.seasonStart ?? `${day.slice(0, 4)}-01-01`;
  return input.umpires
    .filter((umpire) => umpire.status !== "left")
    .map((umpire): RankedUmpire<U> => {
      const blockers = missingChecks(umpire, input.rules, day);
      const said = umpire.user_id
        ? (input.availability.find((row) => row.user_id === umpire.user_id && row.day === day)
            ?.status as AvailabilityStatus | undefined)
        : undefined;
      if (said === "unavailable") blockers.push("Unavailable that day");
      if (hasClash(umpire.id, input.startsAt, input.appointments))
        blockers.push("Another match at that time");
      const seasonCount = input.appointments.filter(
        (row) =>
          row.umpire_id === umpire.id &&
          row.starts_at.slice(0, 10) >= seasonStart &&
          (row.status === "accepted" || row.status === "completed"),
      ).length;
      const availabilityScore = said === "available" ? 2 : said === "maybe" ? 1 : 0;
      const score =
        (blockers.length ? -1000 : 0) +
        availabilityScore * 100 -
        seasonCount * 5 +
        gradeOrder.indexOf(umpire.grade as UmpireGrade);
      return { umpire, blockers, availability: said ?? "unknown", seasonCount, score };
    })
    .sort(
      (a, b) => b.score - a.score || a.umpire.display_name.localeCompare(b.umpire.display_name),
    );
}

/** Fee for a new appointment: voluntary umpires get nothing; otherwise their own fee, else the panel default. */
export function feeFor(
  umpire: Pick<UmpireLike, "pay_basis" | "match_fee_minor">,
  rules: PanelRules,
): number {
  if (umpire.pay_basis === "voluntary") return 0;
  return umpire.match_fee_minor ?? rules.default_fee_minor;
}

/** Travel expenses from distance at the panel's rate per km (minor units). */
export function travelFor(km: number, rules: Pick<PanelRules, "travel_rate_minor">): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  return Math.round(km * rules.travel_rate_minor);
}

export interface MoneyTotals {
  owed: number;
  approved: number;
  paid: number;
  voluntaryMatches: number;
}

/** Totals per currency for a set of appointments. "Owed" is done matches not yet approved or paid. */
export function moneyTotals(appointments: AppointmentLike[]): Record<string, MoneyTotals> {
  const totals: Record<string, MoneyTotals> = {};
  for (const row of appointments) {
    const bucket = (totals[row.currency] ??= {
      owed: 0,
      approved: 0,
      paid: 0,
      voluntaryMatches: 0,
    });
    const amount = row.fee_minor + row.expenses_minor;
    if (row.status === "completed" && row.pay_basis === "voluntary") bucket.voluntaryMatches += 1;
    if (row.payment_status === "due") bucket.owed += amount;
    else if (row.payment_status === "approved") bucket.approved += amount;
    else if (row.payment_status === "paid") bucket.paid += amount;
  }
  return totals;
}

export function formatMinor(minor: number, currency: string): string {
  const amount = minor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Whole money amount typed by a person ("25" or "25.50") → minor units, or null. */
export function toMinor(value: string): number | null {
  const clean = value.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export const nextAvailability: Record<AvailabilityStatus | "unknown", AvailabilityStatus | null> = {
  unknown: "available",
  available: "maybe",
  maybe: "unavailable",
  unavailable: null,
};
