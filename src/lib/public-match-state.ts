import type { BatterRow, BowlerRow, CricketMatch, Delivery, Innings } from "./cricket.ts";
import { playerScreenRef } from "./sha256.ts";
import { commentaryFeed } from "./commentary.ts";
import {
  battingCard,
  bowlingCard,
  currentInnings,
  deliveryRuns,
  findPlayer,
  findTeam,
  inningsOversLimit,
  isSuperOver,
  liveParScore,
  matchResult,
  nextBallIsFreeHit,
  retiredHurtWaiting,
  summarizeInnings,
  targetForCurrentInnings,
} from "./cricket.ts";

/**
 * Only aggregate totals and neutral player roles may be sent in public liveState.
 * Scoring models do not carry independently verified guardian/public-profile
 * consent, so publishing actual player names could expose junior details.
 * Server-side public scoreboard responses must also remove legacy names.
 */
export interface PublicStateOptions {
  /**
   * Cloud match id. When given, card rows carry a per-match pseudonym (never the player id or name)
   * so a club that switches names on for its ground screen can show permitted names.
   */
  screenRefSalt?: string | undefined;
}

/** Order batters walked out: first time each id is seen at the crease. */
function battingOrder(innings: Innings): string[] {
  const order = new Set<string>();
  const add = (id: string | undefined) => {
    if (id) order.add(id);
  };
  for (const delivery of innings.deliveries) {
    add(delivery.strikerId);
    add(delivery.nonStrikerId);
  }
  for (const item of innings.retirements ?? []) add(item.batterId);
  if (innings.status === "live") {
    add(innings.strikerId);
    add(innings.nonStrikerId);
  }
  return [...order];
}

/** Name-free batting and bowling cards for public screens: batting position or bowling order plus figures. */
function publicCard(
  innings: Innings,
  batters: ReadonlyMap<string, BatterRow>,
  bowlers: ReadonlyMap<string, BowlerRow>,
  extras: number,
  active: boolean,
  salt: string | undefined,
) {
  const retirements = new Map((innings.retirements ?? []).map((item) => [item.batterId, item]));
  const waiting = new Set(retiredHurtWaiting(innings));
  const dismissals = new Map<string, NonNullable<Delivery["dismissal"]>["type"]>();
  const bowlingOrder = new Set<string>();
  for (const delivery of innings.deliveries) {
    bowlingOrder.add(delivery.bowlerId);
    if (delivery.dismissal && !dismissals.has(delivery.dismissal.batterId)) {
      dismissals.set(delivery.dismissal.batterId, delivery.dismissal.type);
    }
  }
  const ref = (id: string) => (salt ? { ref: playerScreenRef(salt, id) } : {});
  const batting = battingOrder(innings).map((id, index) => {
    const row = batters.get(id);
    const retired = retirements.get(id);
    const out =
      dismissals.get(id) ??
      (retired?.kind === "out"
        ? "retired-out"
        : retired?.kind === "timed-out"
          ? "timed-out"
          : null) ??
      (retired?.kind === "hurt" && waiting.has(id)
        ? "retired-hurt"
        : null);
    return {
      no: index + 1,
      ...ref(id),
      runs: row?.runs ?? 0,
      balls: row?.balls ?? 0,
      fours: row?.fours ?? 0,
      sixes: row?.sixes ?? 0,
      how: out,
      atCrease: active && !out && (id === innings.strikerId || id === innings.nonStrikerId),
      onStrike: active && !out && id === innings.strikerId,
    };
  });
  const bowling = [...bowlingOrder].map((id, index) => {
    const row = bowlers.get(id);
    return {
      no: index + 1,
      ...ref(id),
      overs: row?.overs ?? "0.0",
      maidens: row?.maidens ?? 0,
      runs: row?.runs ?? 0,
      wickets: row?.wickets ?? 0,
      economy: Math.round((row?.economy ?? 0) * 100) / 100,
      current: active && id === innings.bowlerId,
    };
  });
  return { batting, bowling, extras };
}

/** Runs and wickets per over for every innings (Manhattan and worm charts); totals only. */
function publicProgress(match: CricketMatch) {
  return match.innings.map((innings) => {
    const byOver = new Map<number, [number, number]>();
    for (const delivery of innings.deliveries) {
      const entry = byOver.get(delivery.over) ?? [0, 0];
      entry[0] += deliveryRuns(delivery) - (delivery.wicketPenalty ?? 0);
      if (delivery.dismissal) entry[1] += 1;
      byOver.set(delivery.over, entry);
    }
    for (const retirement of innings.retirements ?? []) {
      if (retirement.kind === "hurt") continue;
      // A retirement is not a delivery; attribute it to the preceding over, or the first over.
      const over = innings.deliveries[retirement.afterBall - 1]?.over ?? 0;
      const entry = byOver.get(over) ?? [0, 0];
      entry[1] += 1;
      byOver.set(over, entry);
    }
    const last = Math.max(-1, ...byOver.keys());
    return {
      battingTeamId: innings.battingTeamId,
      superOver: isSuperOver(innings),
      overs: Array.from({ length: last + 1 }, (_, over) => byOver.get(over) ?? [0, 0]),
    };
  });
}

/** Current stand: net runs and legal balls since a dismissal or retirement. */
function publicPartnership(innings: Innings) {
  let runs = 0;
  let balls = 0;
  const retirements = new Set((innings.retirements ?? []).map((item) => item.afterBall));
  for (const [index, delivery] of innings.deliveries.entries()) {
    runs += deliveryRuns(delivery) - (delivery.wicketPenalty ?? 0);
    if (delivery.legal) balls += 1;
    if (delivery.dismissal || retirements.has(index + 1)) {
      runs = 0;
      balls = 0;
    }
  }
  return { runs, balls };
}

/** Short, identity-free event labels. Wickets retain priority over runs. */
export function publicDeliveryChip(delivery: Delivery) {
  if (delivery.dismissal) return { label: "W", kind: "wicket" };
  const { wide, noBall, bye, legBye, penalty } = delivery.extras;
  const parts: string[] = [];
  if (delivery.batterRuns > 0) parts.push(String(delivery.batterRuns));
  if (wide) parts.push(wide === 1 ? "Wd" : `${wide}Wd`);
  if (noBall) parts.push(noBall === 1 ? "Nb" : `${noBall}Nb`);
  if (bye) parts.push(`${bye}B`);
  if (legBye) parts.push(`${legBye}Lb`);
  if (penalty) parts.push(`${penalty}P`);
  return {
    label: parts.join("+") || "·",
    kind:
      wide || noBall || bye || legBye || penalty
        ? "extra"
        : delivery.batterRuns === 4 || delivery.batterRuns === 6
          ? "boundary"
          : "normal",
  };
}

export function publicLiveState(
  match: CricketMatch,
  options: PublicStateOptions = {},
): Record<string, unknown> {
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  const striker = findPlayer(match, innings.strikerId);
  const nonStriker = findPlayer(match, innings.nonStrikerId);
  const bowler = findPlayer(match, innings.bowlerId);
  const batters = new Map(battingCard(match, innings).map((row) => [row.playerId, row]));
  const bowlers = new Map(bowlingCard(match, innings).map((row) => [row.playerId, row]));
  const strikerFigures = striker ? batters.get(striker.id) : undefined;
  const nonStrikerFigures = nonStriker ? batters.get(nonStriker.id) : undefined;
  const bowlerFigures = bowler ? bowlers.get(bowler.id) : undefined;
  const active = match.status === "live" && innings.status === "live";
  const batting = findTeam(match, innings.battingTeamId);
  const target = targetForCurrentInnings(match);
  const result = matchResult(match);
  const batterAlone = innings.strikerId === innings.nonStrikerId;
  return {
    battingTeamId: batting?.id,
    runs: summary.runs,
    wickets: summary.wickets,
    overs: summary.overs,
    target,
    // Match length is not personal data and keeps chase/projection maths right on other devices.
    settings: {
      oversPerInnings: match.settings.oversPerInnings,
      inningsPerSide: match.settings.inningsPerSide,
      ballsPerOver: match.settings.ballsPerOver,
      // Rules are not personal; the database reads superOver to allow tie-break innings.
      freeHit: Boolean(match.settings.rules?.freeHit),
      superOver: Boolean(match.settings.rules?.superOver),
      lastManStands: Boolean(match.settings.rules?.lastManStands),
      followOnLead: match.settings.rules?.followOnLead ?? null,
      rainMethod: match.settings.rules?.rainMethod ?? null,
      days: match.settings.rules?.days ?? null,
    },
    // Multi-day: day number, stumps and close-of-play scores (team names and totals only).
    days: match.days ?? null,
    // Rain interruption figures (no names): restores the scorer on other devices and shows the par publicly.
    rain: match.rain ?? null,
    // Rain delay / bad light: reason and start time only, so viewers know play has stopped.
    stoppage: match.status === "completed" ? null : (match.stoppage ?? null),
    // Overs allowed in this innings after Super Over / rain changes, so chases read right everywhere.
    oversLimit: inningsOversLimit(match, innings),
    par: liveParScore(match),
    superOver: isSuperOver(innings),
    freeHit: active && !match.stoppage && !match.days?.atStumps && nextBallIsFreeHit(match),
    declared: Boolean(innings.declared),
    followOn: Boolean(innings.followOn),
    result: result?.text ?? null,
    // Toss: team names only.
    toss: match.toss
      ? {
          winnerIsHome: match.toss.winnerTeamId === match.teams[0].id,
          decision: match.toss.decision,
        }
      : null,
    striker: active && striker
      ? { name: "Striker", runs: strikerFigures?.runs ?? 0, balls: strikerFigures?.balls ?? 0 }
      : null,
    nonStriker:
      active && nonStriker && !batterAlone
        ? {
            name: "Non-striker",
            runs: nonStrikerFigures?.runs ?? 0,
            balls: nonStrikerFigures?.balls ?? 0,
          }
        : null,
    bowler: active && bowler
      ? {
          name: "Bowler",
          wickets: bowlerFigures?.wickets ?? 0,
          runs: bowlerFigures?.runs ?? 0,
          overs: bowlerFigures?.overs ?? "0.0",
        }
      : null,
    recent: innings.deliveries.slice(-6).map(publicDeliveryChip),
    // Ground screen pages: name-free cards, per-over totals and the current stand.
    card: publicCard(innings, batters, bowlers, summary.extras.total, active, options.screenRefSalt),
    progress: publicProgress(match),
    partnership: publicPartnership(innings),
    // Win predictor inputs: conditions and match shape only, nothing personal.
    inningsNumber: match.innings.length,
    maxWickets: Math.min(10, Math.max(1, (batting?.players.length ?? 11) - 1)),
    battingIsHome: innings.battingTeamId === match.teams[0].id,
    conditions: match.conditions ?? null,
    // Ball-by-ball text only when the scorer switches it on; built without a name resolver, so roles only.
    commentary: match.audience?.commentary
      ? commentaryFeed(
          innings,
          match.settings.ballsPerOver,
          { battingTeam: batting?.name, freeHits: Boolean(match.settings.rules?.freeHit) },
          24,
        )
      : null,
    message:
      match.status === "completed"
        ? (result?.text ?? "Match completed")
        : !active
          ? "Innings break"
          : isSuperOver(innings)
            ? `Super Over: ${batting?.name ?? "Batting side"} batting`
            : `${batting?.name ?? "Batting side"} innings in progress`,
  };
}
