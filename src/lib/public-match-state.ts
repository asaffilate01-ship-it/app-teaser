import type { CricketMatch, Innings } from "./cricket.ts";
import { playerScreenRef } from "./sha256.ts";
import { commentaryFeed } from "./commentary.ts";
import {
  battingCard,
  bowlingCard,
  currentInnings,
  findPlayer,
  findTeam,
  inningsOversLimit,
  isSuperOver,
  liveParScore,
  matchResult,
  nextBallIsFreeHit,
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
  const order: string[] = [];
  const add = (id: string | undefined) => {
    if (id && !order.includes(id)) order.push(id);
  };
  for (const delivery of innings.deliveries) {
    add(delivery.strikerId);
    add(delivery.nonStrikerId);
  }
  add(innings.strikerId);
  if (innings.nonStrikerId !== innings.strikerId) add(innings.nonStrikerId);
  return order;
}

/** Name-free batting and bowling cards for public screens: batting position or bowling order plus figures. */
function publicCard(match: CricketMatch, innings: Innings, salt: string | undefined) {
  const batters = battingCard(match, innings);
  const bowlers = bowlingCard(match, innings);
  const ref = (id: string) => (salt ? { ref: playerScreenRef(salt, id) } : {});
  const batting = battingOrder(innings).map((id, index) => {
    const row = batters.find((item) => item.playerId === id);
    const out = innings.deliveries.find((delivery) => delivery.dismissal?.batterId === id)?.dismissal?.type ?? null;
    return {
      no: index + 1,
      ...ref(id),
      runs: row?.runs ?? 0,
      balls: row?.balls ?? 0,
      fours: row?.fours ?? 0,
      sixes: row?.sixes ?? 0,
      how: out,
      atCrease: !out && (id === innings.strikerId || id === innings.nonStrikerId),
      onStrike: !out && id === innings.strikerId,
    };
  });
  const bowlingOrder: string[] = [];
  for (const delivery of innings.deliveries) if (!bowlingOrder.includes(delivery.bowlerId)) bowlingOrder.push(delivery.bowlerId);
  const bowling = bowlingOrder.map((id, index) => {
    const row = bowlers.find((item) => item.playerId === id);
    return {
      no: index + 1,
      ...ref(id),
      overs: row?.overs ?? "0.0",
      maidens: row?.maidens ?? 0,
      runs: row?.runs ?? 0,
      wickets: row?.wickets ?? 0,
      economy: Math.round((row?.economy ?? 0) * 100) / 100,
      current: id === innings.bowlerId,
    };
  });
  const extras = innings.deliveries.reduce(
    (sum, delivery) =>
      sum + delivery.extras.wide + delivery.extras.noBall + delivery.extras.bye + delivery.extras.legBye + delivery.extras.penalty,
    0,
  );
  return { batting, bowling, extras };
}

/** Runs and wickets per over for every innings (Manhattan and worm charts); totals only. */
function publicProgress(match: CricketMatch) {
  return match.innings.map((innings) => {
    const byOver = new Map<number, [number, number]>();
    for (const delivery of innings.deliveries) {
      const entry = byOver.get(delivery.over) ?? [0, 0];
      entry[0] +=
        delivery.batterRuns + delivery.extras.wide + delivery.extras.noBall + delivery.extras.bye + delivery.extras.legBye + delivery.extras.penalty;
      if (delivery.dismissal) entry[1] += 1;
      byOver.set(delivery.over, entry);
    }
    const last = Math.max(-1, ...byOver.keys());
    return {
      battingTeamId: innings.battingTeamId,
      superOver: isSuperOver(innings),
      overs: Array.from({ length: last + 1 }, (_, over) => byOver.get(over) ?? [0, 0]),
    };
  });
}

/** Current stand: runs (extras included) and balls since the last wicket. */
function publicPartnership(innings: Innings) {
  let runs = 0;
  let balls = 0;
  for (const delivery of innings.deliveries) {
    runs +=
      delivery.batterRuns + delivery.extras.wide + delivery.extras.noBall + delivery.extras.bye + delivery.extras.legBye + delivery.extras.penalty;
    if (delivery.legal) balls += 1;
    if (delivery.dismissal) {
      runs = 0;
      balls = 0;
    }
  }
  return { runs, balls };
}

export function publicLiveState(match: CricketMatch, options: PublicStateOptions = {}): Record<string, unknown> {
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  const striker = findPlayer(match, innings.strikerId);
  const nonStriker = findPlayer(match, innings.nonStrikerId);
  const bowler = findPlayer(match, innings.bowlerId);
  const batters = battingCard(match, innings);
  const bowlers = bowlingCard(match, innings);
  const strikerFigures = batters.find((row) => row.playerId === striker?.id);
  const nonStrikerFigures = batters.find((row) => row.playerId === nonStriker?.id);
  const bowlerFigures = bowlers.find((row) => row.playerId === bowler?.id);
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
    // Overs allowed in this innings after Super Over / rain changes, so chases read right everywhere.
    oversLimit: inningsOversLimit(match, innings),
    par: liveParScore(match),
    superOver: isSuperOver(innings),
    freeHit: match.status === "live" && nextBallIsFreeHit(match),
    declared: Boolean(innings.declared),
    followOn: Boolean(innings.followOn),
    result: result?.text ?? null,
    striker: striker
      ? { name: "Striker", runs: strikerFigures?.runs ?? 0, balls: strikerFigures?.balls ?? 0 }
      : null,
    nonStriker: nonStriker && !batterAlone
      ? {
          name: "Non-striker",
          runs: nonStrikerFigures?.runs ?? 0,
          balls: nonStrikerFigures?.balls ?? 0,
        }
      : null,
    bowler: bowler
      ? {
          name: "Bowler",
          wickets: bowlerFigures?.wickets ?? 0,
          runs: bowlerFigures?.runs ?? 0,
          overs: bowlerFigures?.overs ?? "0.0",
        }
      : null,
    recent: innings.deliveries.slice(-6).map((delivery) => ({
      label: delivery.dismissal
        ? "W"
        : delivery.batterRuns > 0
          ? String(delivery.batterRuns)
          : delivery.extras?.wide
            ? "Wd"
            : delivery.extras?.noBall
              ? "Nb"
              : "·",
      kind: delivery.dismissal ? "wicket" : delivery.batterRuns >= 4 ? "boundary" : "normal",
    })),
    // Ground screen pages: name-free cards, per-over totals and the current stand.
    card: publicCard(match, innings, options.screenRefSalt),
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
        : isSuperOver(innings)
          ? `Super Over: ${batting?.name ?? "Batting side"} batting`
          : `${batting?.name ?? "Batting side"} innings in progress`,
  };
}
