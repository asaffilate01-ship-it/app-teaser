/**
 * Junior fast-bowling workload: overs per spell, overs per day and rest between spells.
 * Limits follow the ECB fast bowling match directives (England & Wales). They are warnings for the
 * scorer and coach; leagues elsewhere may use different numbers.
 */
import type { CricketMatch, DeliveryStyle, YouthBand } from "./cricket.ts";

export interface YouthLimit {
  /** Most overs in one spell. */
  spell: number;
  /** Most overs in one day. */
  day: number;
}

export const youthBands: readonly YouthBand[] = ["U13", "U14", "U15", "U16", "U17", "U18", "U19"];

export const youthBowlingLimits: Record<YouthBand, YouthLimit> = {
  U13: { spell: 4, day: 12 },
  U14: { spell: 5, day: 15 },
  U15: { spell: 5, day: 15 },
  U16: { spell: 6, day: 18 },
  U17: { spell: 6, day: 18 },
  U18: { spell: 7, day: 18 },
  U19: { spell: 7, day: 18 },
};

/** The age group a team name or age group points to, e.g. "Under 15s" or "U15 Girls" → "U15". */
export function youthBandFrom(text: string | null | undefined): YouthBand | null {
  const match = /\b(?:u|under)[\s-]?(\d{1,2})s?\b/i.exec(text ?? "");
  if (!match) return null;
  const age = Number(match[1]);
  if (age <= 13 && age >= 8) return "U13";
  const band = `U${age}` as YouthBand;
  return youthBands.includes(band) ? band : null;
}

const paceStyles: readonly DeliveryStyle[] = ["Fast", "Medium"];

export type LoadStatus = "ok" | "last-over" | "limit" | "resting";

export interface BowlerLoad {
  bowlerId: string;
  /** Pace bowler (most balls recorded as fast or medium). Limits apply to pace bowlers only. */
  pace: boolean;
  /** Overs started today across every innings of this match. */
  dayOvers: number;
  /** Overs in the current (or most recent) spell. */
  spellOvers: number;
  /** True while the bowler is still in that spell (bowling now, or due the next over from their end). */
  inSpell: boolean;
  /** Overs still to be bowled from their end before they may bowl again (0 = free to bowl). */
  restOversLeft: number;
  status: LoadStatus;
  message: string;
}

/** Over index being bowled now, or the next one when the last over finished. */
function currentOverIndex(legalBalls: number, ballsPerOver: number) {
  return Math.floor(legalBalls / ballsPerOver);
}

/** Every pace bowler's workload in the current innings, worst first. Empty when no limits are set. */
export function bowlingWorkload(
  match: CricketMatch,
  band: YouthBand | null | undefined = match.settings.rules?.youthBowling,
): BowlerLoad[] {
  if (!band) return [];
  const limit = youthBowlingLimits[band];
  const bpo = match.settings.ballsPerOver;
  const innings = match.innings.at(-1);
  if (!innings) return [];
  const legalBalls = innings.deliveries.filter((delivery) => delivery.legal).length;
  const now = currentOverIndex(legalBalls, bpo);
  const lastDate = innings.deliveries.at(-1)?.recordedAt.slice(0, 10);
  const loads: BowlerLoad[] = [];
  const bowlerIds = [...new Set(innings.deliveries.map((delivery) => delivery.bowlerId))];
  for (const bowlerId of bowlerIds) {
    const own = match.innings.flatMap((item) =>
      item.deliveries.filter((delivery) => delivery.bowlerId === bowlerId),
    );
    const pace =
      own.filter((delivery) => paceStyles.includes(delivery.deliveryStyle)).length * 2 >=
      own.length;
    // Overs today: distinct overs per innings, only balls on the same date as the latest ball.
    let dayOvers = 0;
    for (const item of match.innings) {
      const overs = new Set(
        item.deliveries
          .filter(
            (delivery) =>
              delivery.bowlerId === bowlerId &&
              (!lastDate || delivery.recordedAt.slice(0, 10) === lastDate),
          )
          .map((delivery) => delivery.over),
      );
      dayOvers += overs.size;
    }
    const overs = [
      ...new Set(
        innings.deliveries
          .filter((delivery) => delivery.bowlerId === bowlerId)
          .map((delivery) => delivery.over),
      ),
    ].sort((a, b) => a - b);
    // Spells: overs from alternate ends (gap of 2). A bigger gap starts a new spell.
    let spell: number[] = [];
    for (const over of overs) {
      if (spell.length && over - spell.at(-1)! !== 2) spell = [];
      spell.push(over);
    }
    const last = spell.at(-1) ?? -10;
    const bowlingNow = last === now;
    // The other end's over is on (gap 1) or just finished (gap 2): their next over continues the spell.
    // If someone else has already started that over from their end, the spell has ended.
    const nowStarted = innings.deliveries.some((delivery) => delivery.over === now);
    const dueNext = now - last === 1 || (now - last === 2 && !nowStarted);
    const inSpell = bowlingNow || dueNext;
    const served = inSpell ? 0 : Math.max(0, Math.floor((now - 1 - last) / 2));
    const restOversLeft = inSpell ? 0 : Math.max(0, spell.length - served);
    let status: LoadStatus = "ok";
    let message = "";
    if (pace) {
      if (!inSpell && restOversLeft > 0) {
        status = "resting";
        message = `Resting: ${restOversLeft} more over${restOversLeft === 1 ? "" : "s"} from that end before bowling again.`;
      } else if (
        bowlingNow
          ? spell.length > limit.spell || dayOvers > limit.day
          : spell.length >= limit.spell && dueNext
      ) {
        status = "limit";
        message =
          dayOvers > limit.day
            ? `Over the ${band} day limit of ${limit.day} overs.`
            : `Spell limit reached (${limit.spell} overs for ${band}). Needs a rest.`;
      } else if (!bowlingNow && dayOvers >= limit.day) {
        status = "limit";
        message = `Day limit reached (${limit.day} overs for ${band}).`;
      } else if (
        bowlingNow
          ? spell.length === limit.spell || dayOvers === limit.day
          : (dueNext ? spell.length + 1 : 1) === limit.spell || dayOvers + 1 === limit.day
      ) {
        status = "last-over";
        message = bowlingNow
          ? "Last over allowed in this spell or day."
          : "Next over would be the last one allowed.";
      }
    }
    loads.push({
      bowlerId,
      pace,
      dayOvers,
      spellOvers: spell.length,
      inSpell,
      restOversLeft,
      status,
      message,
    });
  }
  const order: Record<LoadStatus, number> = { limit: 0, resting: 1, "last-over": 2, ok: 3 };
  return loads.sort((a, b) => order[a.status] - order[b.status] || b.dayOvers - a.dayOvers);
}

/** Whether this bowler may start a new over now under the junior limits; null when there are no limits. */
export function canBowlNextOver(
  match: CricketMatch,
  bowlerId: string,
): { allowed: boolean; message: string } | null {
  const band = match.settings.rules?.youthBowling;
  if (!band) return null;
  const load = bowlingWorkload(match, band).find((item) => item.bowlerId === bowlerId);
  if (!load || !load.pace) return { allowed: true, message: "" };
  return { allowed: load.status !== "limit" && load.status !== "resting", message: load.message };
}
