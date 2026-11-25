import {
  abandonedOutcome,
  defaultMinOversForResult,
  parScore,
  rainMethodShort,
  revisedTarget,
  type ChaseInputs,
  type RainMethod,
  type RainState,
} from "./rain-rules.ts";
import { validateVideoSpeedEvidence, type VideoSpeedEvidence } from "./speed-evidence.ts";
export type MatchFormat =
  | "T10"
  | "T20"
  | "ODI"
  | "The Hundred"
  | "Tape-ball"
  | "Indoor"
  | "School"
  | "Club"
  | "Multi-day"
  | "Custom";

export type MatchStatus = "live" | "innings-break" | "completed";
export type InningsStatus = "live" | "completed";
export type DeliveryEnd = "Pavilion" | "Far";
export type DeliveryStyle = "Fast" | "Medium" | "Off spin" | "Leg spin" | "Left-arm spin" | "Other";
export type ShotOutcome = "hit" | "hit-no-run" | "left" | "missed" | "wicket";
export type { FieldZone } from "./field-positions.ts";
import type { FieldZone } from "./field-positions.ts";
import type { MatchConditions } from "./win-predictor.ts";

export type DismissalType =
  "bowled" | "caught" | "lbw" | "stumped" | "run-out" | "hit-wicket" | "obstructing-the-field";

export interface Player {
  id: string;
  name: string;
  /** Bats left-handed: wagon wheels and shot maps flip for this batter. */
  leftHanded?: boolean | undefined;
  /** Joined as a substitute: fielding-only, a concussion replacement or an impact-player swap. */
  substitute?: "fielding" | "concussion" | "impact" | undefined;
  /** Replaced by this player (concussion / impact swap): can no longer bat or bowl. */
  replacedBy?: string | undefined;
  /** The player this one replaced. */
  replaces?: string | undefined;
}

/** A tap on the pitch map or beehive: x across (0 = off-side edge for a right-hander, 0.5 = middle stump, 1 = leg side), y 0–1. */
export interface BallPoint {
  x: number;
  y: number;
}

/** Junior age bands that have fast-bowling limits (see bowling-workload.ts). */
export type YouthBand = "U13" | "U14" | "U15" | "U16" | "U17" | "U18" | "U19";

export interface Toss {
  winnerTeamId: string;
  decision: "bat" | "bowl";
}

/** Leaving the crease without a dismissal on a ball: retired hurt (can come back), retired out, or timed out. */
export type RetirementKind = "hurt" | "out" | "timed-out";
export interface Retirement {
  batterId: string;
  kind: RetirementKind;
  /** Balls in the innings when it happened (the retirement sits after that ball). */
  afterBall: number;
  /** Who was at the crease before, so the retirement can be undone exactly. */
  prevStrikerId: string;
  prevNonStrikerId: string;
  replacementId?: string | undefined;
  at: string;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
}

/** Optional playing regulations. Absent rules are off, so older saved matches behave as before. */
export interface MatchRules {
  /** The ball after a no-ball is a free hit: the batter can only be out run out or obstructing the field. */
  freeHit?: boolean | undefined;
  /** A tied one-innings, limited-overs match is decided by a Super Over (one over, two wickets). */
  superOver?: boolean | undefined;
  /** The last batter may carry on alone after the second-last wicket falls. */
  lastManStands?: boolean | undefined;
  /** Two-innings matches: first-innings lead (runs) that lets the side batting first enforce the follow-on. */
  followOnLead?: number | null | undefined;
  /** Rain method for a shortened chase; leagues can set the default for all their matches. */
  rainMethod?: RainMethod | undefined;
  /** Two-innings matches: scheduled number of days (the match is drawn if time runs out). */
  days?: number | undefined;
  /** Junior fast-bowling limits for this match (warnings only), or null/absent for none. */
  youthBowling?: YouthBand | null | undefined;
  /** Pairs cricket (indoor, junior): batters bat in pairs for a set number of overs; a wicket costs runs instead of ending their stay. */
  pairs?: { oversPerPair: number; runsPerWicket: number } | null | undefined;
  /** Legal balls between end changes (The Hundred: 10). Defaults to the balls in an over. */
  endsChangeEvery?: number | null | undefined;
}

export interface MatchSettings {
  format: MatchFormat;
  oversPerInnings: number | null;
  inningsPerSide: 1 | 2;
  ballsPerOver: number;
  ground: string;
  weather: string;
  startTime: string;
  rules?: MatchRules | undefined;
}

export interface Extras {
  wide: number;
  noBall: number;
  bye: number;
  legBye: number;
  penalty: number;
}

export interface Dismissal {
  type: DismissalType;
  batterId: string;
  fielderId?: string | undefined;
  catchZone?: FieldZone | undefined;
}

export interface Delivery {
  id: string;
  sequence: number;
  recordedAt: string;
  over: number;
  ball: number;
  legal: boolean;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  end: DeliveryEnd;
  deliveryStyle: DeliveryStyle;
  outcome: ShotOutcome;
  batterRuns: number;
  extras: Extras;
  fieldZone: FieldZone;
  fielderId?: string | undefined;
  dismissal?: Dismissal | undefined;
  note?: string | undefined;
  /** This ball was a free hit (only run out or obstructing the field can dismiss the batter). */
  freeHit?: boolean | undefined;
  /** Average speed down the pitch, measured from a video clip (km/h). */
  speedKph?: number | undefined;
  /** Reviewed segment-average measurement evidence, not radar-certified release speed. */
  speedEvidence?: VideoSpeedEvidence | undefined;
  /** Pairs cricket: runs taken off the batting side for this wicket. */
  wicketPenalty?: number | undefined;
  /** Where the ball pitched (y: 0 at the batter's stumps, 1 = halfway down the pitch). */
  pitch?: BallPoint | undefined;
  /** Where the ball passed the batter (y: 0 ground, 1 = head height). */
  beehive?: BallPoint | undefined;
}

export interface Innings {
  id: string;
  number: number;
  battingTeamId: string;
  bowlingTeamId: string;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  end: DeliveryEnd;
  status: InningsStatus;
  deliveries: Delivery[];
  /** "super-over" innings decide a tie; they never count towards career statistics. */
  kind?: "regular" | "super-over" | undefined;
  /** The batting captain declared this innings closed. */
  declared?: boolean | undefined;
  /** Play ran out of time (multi-day) with this innings unfinished. */
  unfinished?: boolean | undefined;
  /** This innings was batted as an enforced follow-on. */
  followOn?: boolean | undefined;
  /** Retired hurt / retired out / timed out, in the order they happened. */
  retirements?: Retirement[] | undefined;
}

export interface CricketMatch {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: MatchStatus;
  settings: MatchSettings;
  teams: [Team, Team];
  innings: Innings[];
  /** Pitch, outfield and weather used by the win predictor. */
  conditions?: MatchConditions | undefined;
  /** What viewers of the public scoreboard may see beyond the score. */
  audience?: { commentary?: boolean } | undefined;
  /** Rain interruption for the chase (one-innings, limited-overs matches only). */
  rain?: RainState | undefined;
  /** Multi-day play: which day it is, whether stumps have been drawn, and each day's close-of-play score. */
  days?: MatchDays | undefined;
  /** Play stopped for rain, bad light or another reason (scoring paused until it resumes). */
  stoppage?: PlayStoppage | null | undefined;
  /** Who won the toss and what they chose. */
  toss?: Toss | undefined;
}

export type StoppageReason = "rain" | "bad-light" | "wet-outfield" | "other";
export interface PlayStoppage {
  reason: StoppageReason;
  since: string;
}

export interface CloseOfPlay {
  day: number;
  inningsIndex: number;
  battingTeamId: string;
  runs: number;
  wickets: number;
  overs: string;
  /** First-innings lead or runs still needed at the close, for the scorecard line. */
  note?: string | undefined;
  at: string;
}

export interface MatchDays {
  /** The day being played (1-based). */
  current: number;
  /** True between "Stumps" and the start of the next day's play. */
  atStumps: boolean;
  closes: CloseOfPlay[];
  /** The match was ended because time ran out. */
  timeUp?: boolean | undefined;
}

export interface CreateMatchInput {
  homeTeamName: string;
  awayTeamName: string;
  homePlayers: string[];
  awayPlayers: string[];
  battingFirst: "home" | "away";
  settings: MatchSettings;
  /** When given, the toss decides who bats first (battingFirst is ignored). */
  toss?: { winner: "home" | "away"; decision: "bat" | "bowl" } | undefined;
}

export interface RecordDeliveryInput {
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  end: DeliveryEnd;
  deliveryStyle: DeliveryStyle;
  outcome: ShotOutcome;
  batterRuns: number;
  extras?: Partial<Extras> | undefined;
  fieldZone?: FieldZone | undefined;
  fielderId?: string | undefined;
  dismissal?: Dismissal | undefined;
  note?: string | undefined;
  pitch?: BallPoint | undefined;
  beehive?: BallPoint | undefined;
}

export interface InningsSummary {
  runs: number;
  wickets: number;
  legalBalls: number;
  overs: string;
  runRate: number;
  extras: Extras & { total: number };
}

export interface BatterRow {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dismissal: string;
}

export interface BowlerRow {
  playerId: string;
  name: string;
  balls: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
}

export const emptyExtras = (): Extras => ({ wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 });

const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const makePlayers = (teamPrefix: string, names: string[]): Player[] =>
  names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({ id: `${teamPrefix}-p${index + 1}-${makeId("player")}`, name }));

const createInnings = (
  number: number,
  battingTeam: Team,
  bowlingTeam: Team,
  extra: Pick<Innings, "kind" | "followOn"> = {},
): Innings => ({
  ...extra,
  id: makeId("innings"),
  number,
  battingTeamId: battingTeam.id,
  bowlingTeamId: bowlingTeam.id,
  strikerId: battingTeam.players[0]?.id ?? "",
  nonStrikerId: battingTeam.players[1]?.id ?? battingTeam.players[0]?.id ?? "",
  bowlerId: bowlingTeam.players[0]?.id ?? "",
  end: "Pavilion",
  status: "live",
  deliveries: [],
});

export function createMatch(input: CreateMatchInput): CricketMatch {
  const home: Team = {
    id: makeId("home"),
    name: input.homeTeamName.trim(),
    players: makePlayers("home", input.homePlayers),
  };
  const away: Team = {
    id: makeId("away"),
    name: input.awayTeamName.trim(),
    players: makePlayers("away", input.awayPlayers),
  };
  const battingFirst = input.toss
    ? battingFirstFromToss(input.toss.winner, input.toss.decision)
    : input.battingFirst;
  const battingTeam = battingFirst === "home" ? home : away;
  const bowlingTeam = battingFirst === "home" ? away : home;
  const now = new Date().toISOString();

  return {
    id: makeId("match"),
    createdAt: now,
    updatedAt: now,
    status: "live",
    settings: input.settings,
    teams: [home, away],
    innings: [createInnings(1, battingTeam, bowlingTeam)],
    ...(input.toss
      ? {
          toss: {
            winnerTeamId: input.toss.winner === "home" ? home.id : away.id,
            decision: input.toss.decision,
          },
        }
      : {}),
  };
}

export const currentInnings = (match: CricketMatch) => match.innings.at(-1)!;
export const findTeam = (match: CricketMatch, id: string) =>
  match.teams.find((team) => team.id === id)!;
export const findPlayer = (match: CricketMatch, id: string) =>
  match.teams.flatMap((team) => team.players).find((player) => player.id === id);

const extraRuns = (extras: Extras) =>
  extras.wide + extras.noBall + extras.bye + extras.legBye + extras.penalty;

export const deliveryRuns = (delivery: Delivery) =>
  delivery.batterRuns + extraRuns(delivery.extras);

export const isBowlerWicket = (type: DismissalType) =>
  !["run-out", "obstructing-the-field"].includes(type);

export function summarizeInnings(innings: Innings, ballsPerOver = 6): InningsSummary {
  const extras = emptyExtras();
  let runs = 0;
  let legalBalls = 0;
  let wickets = 0;
  for (const delivery of innings.deliveries) {
    extras.wide += delivery.extras.wide;
    extras.noBall += delivery.extras.noBall;
    extras.bye += delivery.extras.bye;
    extras.legBye += delivery.extras.legBye;
    extras.penalty += delivery.extras.penalty;
    runs += deliveryRuns(delivery) - (delivery.wicketPenalty ?? 0);
    if (delivery.legal) legalBalls += 1;
    if (delivery.dismissal) wickets += 1;
  }
  for (const retirement of innings.retirements ?? []) {
    if (retirement.kind !== "hurt") wickets += 1;
  }

  return {
    runs,
    wickets,
    legalBalls,
    overs: `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`,
    runRate: legalBalls ? (runs * ballsPerOver) / legalBalls : 0,
    extras: { ...extras, total: extraRuns(extras) },
  };
}

const dismissedPlayerIds = (innings: Innings) =>
  new Set([
    ...innings.deliveries.flatMap((delivery) =>
      delivery.dismissal ? [delivery.dismissal.batterId] : [],
    ),
    ...(innings.retirements ?? [])
      .filter((item) => item.kind !== "hurt")
      .map((item) => item.batterId),
  ]);

/** Retired-hurt batters who have not come back to the crease yet (they may resume later). */
export function retiredHurtWaiting(innings: Innings): string[] {
  const waiting: string[] = [];
  const dismissed = dismissedPlayerIds(innings);
  for (const item of innings.retirements ?? []) {
    if (item.kind !== "hurt" || dismissed.has(item.batterId) || waiting.includes(item.batterId))
      continue;
    const later = innings.deliveries.slice(item.afterBall);
    const lastForBatter = [...(innings.retirements ?? [])]
      .reverse()
      .find((entry) => entry.batterId === item.batterId);
    if (lastForBatter !== item) continue;
    const resumed =
      later.some(
        (delivery) =>
          delivery.strikerId === item.batterId || delivery.nonStrikerId === item.batterId,
      ) ||
      innings.strikerId === item.batterId ||
      innings.nonStrikerId === item.batterId;
    if (!resumed) waiting.push(item.batterId);
  }
  return waiting;
}

/** Batters who can walk in next, in batting order: fresh batters first, then retired-hurt batters returning. */
export function availableBatters(team: Team, innings: Innings, activeIds: string[]): string[] {
  const dismissed = dismissedPlayerIds(innings);
  const hurt = new Set(retiredHurtWaiting(innings));
  const free = team.players.filter(
    (player) => canBat(player) && !dismissed.has(player.id) && !activeIds.includes(player.id),
  );
  return [
    ...free.filter((player) => !hurt.has(player.id)).map((player) => player.id),
    ...free.filter((player) => hurt.has(player.id)).map((player) => player.id),
  ];
}

const nextBatter = (team: Team, innings: Innings, activeIds: string[]) =>
  availableBatters(team, innings, activeIds)[0];

/** Fielding substitutes and replaced players cannot bat. */
export const canBat = (player: Player) => player.substitute !== "fielding" && !player.replacedBy;
/** Fielding substitutes and replaced players cannot bowl. */
export const canBowl = (player: Player) => player.substitute !== "fielding" && !player.replacedBy;

const pairsRule = (match: CricketMatch, innings: Innings) =>
  isSuperOver(innings) ? null : (match.settings.rules?.pairs ?? null);

export function recordDelivery(match: CricketMatch, input: RecordDeliveryInput): CricketMatch {
  if (match.status !== "live" || match.days?.atStumps || match.stoppage) return match;
  const innings = currentInnings(match);
  if (innings.status !== "live") return match;
  const freeHit = nextBallIsFreeHit(match);
  // On a free hit the batter cannot be bowled, caught, lbw, stumped or out hit wicket.
  if (freeHit && input.dismissal && !freeHitDismissals.includes(input.dismissal.type)) return match;
  const extras = { ...emptyExtras(), ...input.extras };
  const counts = [
    input.batterRuns,
    extras.wide,
    extras.noBall,
    extras.bye,
    extras.legBye,
    extras.penalty,
  ];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0)) return match;
  const summaryBefore = summarizeInnings(innings, match.settings.ballsPerOver);
  const legal = extras.wide === 0 && extras.noBall === 0;
  const delivery: Delivery = {
    id: makeId("delivery"),
    sequence: innings.deliveries.length + 1,
    recordedAt: new Date().toISOString(),
    over: Math.floor(summaryBefore.legalBalls / match.settings.ballsPerOver),
    ball: (summaryBefore.legalBalls % match.settings.ballsPerOver) + 1,
    legal,
    strikerId: input.strikerId,
    nonStrikerId: input.nonStrikerId,
    bowlerId: input.bowlerId,
    end: input.end,
    deliveryStyle: input.deliveryStyle,
    outcome: input.outcome,
    batterRuns: input.batterRuns,
    extras,
    fieldZone: input.fieldZone ?? "Not recorded",
    fielderId: input.fielderId || undefined,
    dismissal: input.dismissal,
    note: input.note?.trim() || undefined,
    ...(freeHit ? { freeHit: true } : {}),
    ...(input.pitch ? { pitch: input.pitch } : {}),
    ...(input.beehive ? { beehive: input.beehive } : {}),
  };
  const pairs = pairsRule(match, innings);
  if (pairs && input.dismissal) delivery.wicketPenalty = pairs.runsPerWicket;

  const deliveries = [...innings.deliveries, delivery];
  const battingTeam = findTeam(match, innings.battingTeamId);
  let strikerId = input.strikerId;
  let nonStrikerId = input.nonStrikerId;

  let noBatterLeft = false;
  // Pairs cricket: the batter stays in; the wicket costs runs instead.
  if (input.dismissal && !pairs) {
    const replacement = nextBatter(battingTeam, { ...innings, deliveries }, [
      strikerId,
      nonStrikerId,
    ]);
    if (replacement) {
      if (input.dismissal.batterId === nonStrikerId) nonStrikerId = replacement;
      else strikerId = replacement;
    } else if (lastManStandsApplies(match, innings) && strikerId !== nonStrikerId) {
      // Last man stands: the survivor carries on alone and keeps the strike.
      const survivor = input.dismissal.batterId === strikerId ? nonStrikerId : strikerId;
      strikerId = survivor;
      nonStrikerId = survivor;
    } else {
      // Nobody left to come in (for example a batter retired hurt and cannot return).
      noBatterLeft = true;
    }
  }

  const batterAlone = strikerId === nonStrikerId;
  const completedRunningRuns =
    delivery.batterRuns +
    delivery.extras.bye +
    delivery.extras.legBye +
    Math.max(0, delivery.extras.wide - 1);
  if (!batterAlone && completedRunningRuns % 2 === 1)
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];

  const legalBallsAfter = summaryBefore.legalBalls + (legal ? 1 : 0);
  const endEvery =
    (!isSuperOver(innings) && match.settings.rules?.endsChangeEvery) || match.settings.ballsPerOver;
  if (!batterAlone && legal && legalBallsAfter % endEvery === 0) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }
  // Pairs cricket: a new pair comes in after each set of overs.
  if (
    pairs &&
    legal &&
    legalBallsAfter % (pairs.oversPerPair * match.settings.ballsPerOver) === 0
  ) {
    const batted = new Set(deliveries.flatMap((item) => [item.strikerId, item.nonStrikerId]));
    const fresh = battingTeam.players
      .filter((player) => canBat(player) && !batted.has(player.id))
      .map((player) => player.id);
    if (fresh.length >= 2) [strikerId, nonStrikerId] = [fresh[0]!, fresh[1]!];
  }

  const updatedInnings: Innings = {
    ...innings,
    strikerId,
    nonStrikerId,
    bowlerId: input.bowlerId,
    end: input.end,
    deliveries,
  };
  const wicketsAfter = summaryBefore.wickets + (delivery.dismissal ? 1 : 0);
  const runsAfter = summaryBefore.runs + deliveryRuns(delivery) - (delivery.wicketPenalty ?? 0);
  const maximumBalls = inningsBallLimit(match, innings);
  const allOut = !pairs && wicketsAfter >= inningsWicketLimit(match, innings);
  const oversComplete = maximumBalls !== null && legalBallsAfter >= maximumBalls;
  // A chase (one-innings second innings, fourth innings, or second half of a Super Over)
  // finishes as soon as the target is reached.
  const target = targetForCurrentInnings(match);
  const chaseWon = target !== null && runsAfter >= target;
  const inningsComplete = allOut || oversComplete || chaseWon || noBatterLeft;
  updatedInnings.status = inningsComplete ? "completed" : "live";

  return {
    ...match,
    updatedAt: new Date().toISOString(),
    status: inningsComplete ? "innings-break" : "live",
    innings: [...match.innings.slice(0, -1), updatedInnings],
  };
}

export function endCurrentInnings(
  match: CricketMatch,
  options: { declared?: boolean } = {},
): CricketMatch {
  if (match.status === "completed") return match;
  const innings = currentInnings(match);
  return {
    ...match,
    updatedAt: new Date().toISOString(),
    status: "innings-break",
    innings: [
      ...match.innings.slice(0, -1),
      { ...innings, status: "completed", ...(options.declared ? { declared: true } : {}) },
    ],
  };
}

/** Declarations are only part of two-innings (multi-day style) cricket. */
export const canDeclare = (match: CricketMatch) =>
  match.status === "live" &&
  match.settings.inningsPerSide === 2 &&
  !isSuperOver(currentInnings(match));

export function declareInnings(match: CricketMatch): CricketMatch {
  return canDeclare(match) ? endCurrentInnings(match, { declared: true }) : match;
}

export function startNextInnings(
  match: CricketMatch,
  options: { followOn?: boolean } = {},
): CricketMatch {
  // Prevent creating another innings while the current one is still in progress.
  if (match.status !== "innings-break") return match;
  const plan = nextInningsPlan(match);
  if (plan.kind === "complete") {
    return { ...match, status: "completed", updatedAt: new Date().toISOString() };
  }
  const followOn =
    plan.kind === "regular" && options.followOn === true && plan.followOnTeamId !== null;
  const battingTeamId = followOn ? plan.followOnTeamId! : plan.battingTeamId;
  const battingTeam = findTeam(match, battingTeamId);
  const bowlingTeam = match.teams.find((team) => team.id !== battingTeamId)!;
  const extra: Pick<Innings, "kind" | "followOn"> =
    plan.kind === "super-over" ? { kind: "super-over" } : followOn ? { followOn: true } : {};
  return {
    ...match,
    status: "live",
    updatedAt: new Date().toISOString(),
    innings: [
      ...match.innings,
      createInnings(match.innings.length + 1, battingTeam, bowlingTeam, extra),
    ],
  };
}

export function undoLastDelivery(match: CricketMatch): CricketMatch {
  const innings = currentInnings(match);
  if (!innings.deliveries.length) return match;
  const removed = innings.deliveries.at(-1)!;
  const deliveries = innings.deliveries.slice(0, -1);
  // Anything recorded after the removed ball (a retirement) goes with it.
  const retirements = (innings.retirements ?? []).filter(
    (item) => item.afterBall <= deliveries.length,
  );
  return {
    ...match,
    status: "live",
    updatedAt: new Date().toISOString(),
    innings: [
      ...match.innings.slice(0, -1),
      {
        ...innings,
        status: "live",
        deliveries,
        ...(innings.retirements ? { retirements } : {}),
        strikerId: removed.strikerId,
        nonStrikerId: removed.nonStrikerId,
        bowlerId: removed.bowlerId,
        end: removed.end,
      },
    ],
  };
}

const dismissalLabel = (delivery: Delivery, match: CricketMatch) => {
  if (!delivery.dismissal) return "not out";
  const fielder = delivery.dismissal.fielderId
    ? findPlayer(match, delivery.dismissal.fielderId)?.name
    : undefined;
  switch (delivery.dismissal.type) {
    case "caught":
      return `c ${fielder ?? "fielder"} b ${findPlayer(match, delivery.bowlerId)?.name ?? "bowler"}`;
    case "bowled":
      return `b ${findPlayer(match, delivery.bowlerId)?.name ?? "bowler"}`;
    case "lbw":
      return `lbw b ${findPlayer(match, delivery.bowlerId)?.name ?? "bowler"}`;
    case "stumped":
      return `st ${fielder ?? "keeper"} b ${findPlayer(match, delivery.bowlerId)?.name ?? "bowler"}`;
    case "run-out":
      return `run out (${fielder ?? "fielder"})`;
    case "hit-wicket":
      return `hit wicket b ${findPlayer(match, delivery.bowlerId)?.name ?? "bowler"}`;
    case "obstructing-the-field":
      return "obstructing the field";
  }
};

export function battingCard(match: CricketMatch, innings: Innings): BatterRow[] {
  const team = findTeam(match, innings.battingTeamId);
  return team.players.map((player) => {
    const faced = innings.deliveries.filter((delivery) => delivery.strikerId === player.id);
    const runs = faced.reduce((sum, delivery) => sum + delivery.batterRuns, 0);
    // A no-ball is faced by the batter, although it does not count towards the over.
    // A wide is not a ball faced; byes and leg-byes on legal balls still are.
    const balls = faced.filter((delivery) => delivery.extras.wide === 0).length;
    const dismissalDelivery = innings.deliveries.find(
      (delivery) => delivery.dismissal?.batterId === player.id,
    );
    const retirement = [...(innings.retirements ?? [])]
      .reverse()
      .find((item) => item.batterId === player.id);
    const retiredLabel =
      retirement?.kind === "out"
        ? "retired out"
        : retirement?.kind === "timed-out"
          ? "timed out"
          : retirement?.kind === "hurt" && retiredHurtWaiting(innings).includes(player.id)
            ? "retired hurt"
            : null;
    return {
      playerId: player.id,
      name: player.name,
      runs,
      balls,
      fours: faced.filter((delivery) => delivery.batterRuns === 4).length,
      sixes: faced.filter((delivery) => delivery.batterRuns === 6).length,
      strikeRate: balls ? (runs * 100) / balls : 0,
      dismissal: dismissalDelivery
        ? dismissalLabel(dismissalDelivery, match)
        : (retiredLabel ?? "not out"),
    };
  });
}

export function bowlingCard(match: CricketMatch, innings: Innings): BowlerRow[] {
  const team = findTeam(match, innings.bowlingTeamId);
  return team.players
    .map((player) => {
      const deliveries = innings.deliveries.filter((delivery) => delivery.bowlerId === player.id);
      const balls = deliveries.filter((delivery) => delivery.legal).length;
      const runs = deliveries.reduce(
        (sum, delivery) =>
          sum + delivery.batterRuns + delivery.extras.wide + delivery.extras.noBall,
        0,
      );
      const wickets = deliveries.filter(
        (delivery) => delivery.dismissal && isBowlerWicket(delivery.dismissal.type),
      ).length;
      // Byes/leg-byes do not stop an otherwise complete over from being a maiden.
      // The bowler must have completed every legal delivery in that over.
      const overs = new Map<number, { legalBalls: number; chargedRuns: number }>();
      for (const delivery of deliveries) {
        const over = overs.get(delivery.over) ?? { legalBalls: 0, chargedRuns: 0 };
        if (delivery.legal) over.legalBalls += 1;
        over.chargedRuns += delivery.batterRuns + delivery.extras.wide + delivery.extras.noBall;
        overs.set(delivery.over, over);
      }
      const maidens = [...overs.values()].filter(
        (over) => over.legalBalls === match.settings.ballsPerOver && over.chargedRuns === 0,
      ).length;
      return {
        playerId: player.id,
        name: player.name,
        balls,
        overs: `${Math.floor(balls / match.settings.ballsPerOver)}.${balls % match.settings.ballsPerOver}`,
        maidens,
        runs,
        wickets,
        economy: balls ? (runs * match.settings.ballsPerOver) / balls : 0,
        wides: deliveries.reduce((sum, delivery) => sum + delivery.extras.wide, 0),
        noBalls: deliveries.reduce((sum, delivery) => sum + delivery.extras.noBall, 0),
      };
    })
    .filter((row) => row.balls || row.runs || row.wickets);
}

export function targetForCurrentInnings(match: CricketMatch): number | null {
  return inningsTarget(match, match.innings.length - 1);
}

// ---------------------------------------------------------------------------
// Playing regulations: free hit, last man stands, Super Over, follow-on, results.
// ---------------------------------------------------------------------------

export const SUPER_OVER_WICKETS = 2;
/** Repeated Super Overs stop after this many; a tie then stands. */
export const MAX_SUPER_OVERS = 3;
export const freeHitDismissals: readonly DismissalType[] = ["run-out", "obstructing-the-field"];

export const isSuperOver = (innings: Innings) => innings.kind === "super-over";

const regularInnings = (match: CricketMatch) => match.innings.filter((item) => !isSuperOver(item));
const superOvers = (match: CricketMatch) => match.innings.filter(isSuperOver);
const runsOf = (match: CricketMatch, innings: Innings) =>
  summarizeInnings(innings, match.settings.ballsPerOver).runs;

/** Law 21.19-style free hit: true when the previous ball was a no-ball (a wide on a free hit carries it on). */
export function nextBallIsFreeHit(match: CricketMatch): boolean {
  if (!match.settings.rules?.freeHit) return false;
  const deliveries = currentInnings(match).deliveries;
  for (let index = deliveries.length - 1; index >= 0; index--) {
    const delivery = deliveries[index]!;
    if (delivery.extras.noBall > 0) return true;
    if (delivery.extras.wide === 0) return false;
  }
  return false;
}

/** Dismissals the scorer may record on the next ball. */
export function allowedDismissals(match: CricketMatch): readonly DismissalType[] {
  return nextBallIsFreeHit(match)
    ? freeHitDismissals
    : ["bowled", "caught", "lbw", "stumped", "run-out", "hit-wicket", "obstructing-the-field"];
}

const lastManStandsApplies = (match: CricketMatch, innings: Innings) =>
  Boolean(match.settings.rules?.lastManStands) && !isSuperOver(innings);

/** Wickets that end this innings: 2 in a Super Over, every batter with last man stands, otherwise all but one. */
export function inningsWicketLimit(match: CricketMatch, innings: Innings): number {
  const players = findTeam(match, innings.battingTeamId).players.length;
  if (isSuperOver(innings)) return Math.max(1, Math.min(SUPER_OVER_WICKETS, players - 1));
  if (lastManStandsApplies(match, innings)) return Math.max(1, players);
  return Math.max(1, players - 1);
}

/** Legal balls allowed in this innings, or null when unlimited. A Super Over is one over. */
export function inningsBallLimit(match: CricketMatch, innings: Innings): number | null {
  if (isSuperOver(innings)) return match.settings.ballsPerOver;
  const revised = match.rain?.revisedOvers;
  if (revised != null && isRainChase(match, innings))
    return Math.round(revised * match.settings.ballsPerOver);
  return match.settings.oversPerInnings
    ? match.settings.oversPerInnings * match.settings.ballsPerOver
    : null;
}

/** Overs allowed in this innings (Super Over: 1; rain-shortened chase: the revised overs), or null when unlimited. */
export function inningsOversLimit(match: CricketMatch, innings: Innings): number | null {
  const balls = inningsBallLimit(match, innings);
  return balls === null ? null : balls / match.settings.ballsPerOver;
}

/** Total runs per team across its regular (non Super Over) innings. */
export function teamTotals(match: CricketMatch): Map<string, number> {
  const totals = new Map<string, number>(match.teams.map((team) => [team.id, 0]));
  for (const innings of regularInnings(match)) {
    totals.set(
      innings.battingTeamId,
      (totals.get(innings.battingTeamId) ?? 0) + runsOf(match, innings),
    );
  }
  return totals;
}

/** Runs needed to win for the innings at `index`, or null when it is not a chase. */
export function inningsTarget(match: CricketMatch, index: number): number | null {
  const innings = match.innings[index];
  if (!innings) return null;
  if (isSuperOver(innings)) {
    const position = match.innings.slice(0, index).filter(isSuperOver).length;
    if (position % 2 === 0) return null;
    return runsOf(match, match.innings[index - 1]!) + 1;
  }
  if (match.settings.inningsPerSide === 1) {
    if (index !== 1) return null;
    const inputs = match.rain ? rainChaseInputs(match) : null;
    const revised = inputs ? revisedTarget(match.rain, inputs) : null;
    return revised ?? runsOf(match, match.innings[0]!) + 1;
  }
  if (index !== 3) return null;
  const before = match.innings.slice(0, 3);
  const own = before
    .filter((item) => item.battingTeamId === innings.battingTeamId)
    .reduce((sum, item) => sum + runsOf(match, item), 0);
  const theirs = before
    .filter((item) => item.battingTeamId === innings.bowlingTeamId)
    .reduce((sum, item) => sum + runsOf(match, item), 0);
  return theirs - own + 1;
}

export type NextInningsPlan =
  | { kind: "complete" }
  | {
      kind: "regular";
      number: number;
      battingTeamId: string;
      /** When set, the side batting first may make this team follow on instead. */
      followOnTeamId: string | null;
      lead: number;
    }
  | { kind: "super-over"; number: number; battingTeamId: string };

/** What happens after the current innings break, following the match rules. */
export function nextInningsPlan(match: CricketMatch): NextInningsPlan {
  const regular = regularInnings(match);
  const supers = superOvers(match);
  const number = match.innings.length + 1;
  const regularCount = match.settings.inningsPerSide * 2;
  const last = match.innings.at(-1)!;

  if (supers.length === 0 && regular.length < regularCount) {
    // One-innings chase already won (or tied/lost) at the end of innings two is handled below.
    if (match.settings.inningsPerSide === 1 || regular.length === 1) {
      return {
        kind: "regular",
        number,
        battingTeamId: last.bowlingTeamId,
        followOnTeamId: null,
        lead: 0,
      };
    }
    const first = regular[0]!;
    const second = regular[1]!;
    if (regular.length === 2) {
      const lead = runsOf(match, first) - runsOf(match, second);
      const threshold = match.settings.rules?.followOnLead;
      const followOnTeamId =
        threshold != null && threshold > 0 && lead >= threshold ? second.battingTeamId : null;
      return { kind: "regular", number, battingTeamId: first.battingTeamId, followOnTeamId, lead };
    }
    // Before the fourth innings: if the side that has batted twice is still behind, it has lost by an innings.
    const fourthBattingTeamId = match.teams.find(
      (team) => regular.filter((item) => item.battingTeamId === team.id).length === 1,
    )?.id;
    if (!fourthBattingTeamId) return { kind: "complete" };
    const totals = teamTotals(match);
    const twiceTeamId = match.teams.find((team) => team.id !== fourthBattingTeamId)!.id;
    if ((totals.get(twiceTeamId) ?? 0) < (totals.get(fourthBattingTeamId) ?? 0))
      return { kind: "complete" };
    return {
      kind: "regular",
      number,
      battingTeamId: fourthBattingTeamId,
      followOnTeamId: null,
      lead: 0,
    };
  }

  const superOverAllowed =
    Boolean(match.settings.rules?.superOver) &&
    match.settings.inningsPerSide === 1 &&
    match.settings.oversPerInnings !== null &&
    regular.length === 2;
  if (!superOverAllowed) return { kind: "complete" };
  if (supers.length === 0) {
    if (runsOf(match, regular[0]!) !== runsOf(match, regular[1]!)) return { kind: "complete" };
    // The side that batted second in the match bats first in the Super Over.
    return { kind: "super-over", number, battingTeamId: regular[1]!.battingTeamId };
  }
  if (supers.length % 2 === 1) {
    return { kind: "super-over", number, battingTeamId: supers.at(-1)!.bowlingTeamId };
  }
  const [a, b] = supers.slice(-2) as [Innings, Innings];
  if (runsOf(match, a) !== runsOf(match, b) || supers.length / 2 >= MAX_SUPER_OVERS) {
    return { kind: "complete" };
  }
  // In a repeat Super Over, the side that batted second last time bats first.
  return { kind: "super-over", number, battingTeamId: b.battingTeamId };
}

export interface MatchResult {
  winnerTeamId: string | null;
  tied: boolean;
  drawn: boolean;
  noResult: boolean;
  decidedBySuperOver: boolean;
  text: string;
}

/**
 * The result once no more cricket is due (match completed, or an innings break with nothing left to play).
 * Returns null while the match can still continue.
 */
export function matchResult(match: CricketMatch): MatchResult | null {
  if (match.status === "live") return null;
  if (match.status === "innings-break" && nextInningsPlan(match).kind !== "complete") return null;
  const name = (id: string) => findTeam(match, id).name;
  const base = { tied: false, drawn: false, noResult: false, decidedBySuperOver: false };
  const regular = regularInnings(match);
  const supers = superOvers(match);
  const bpo = match.settings.ballsPerOver;

  if (supers.length >= 2) {
    const complete = supers.length % 2 === 0 ? supers : supers.slice(0, -1);
    const [a, b] = complete.slice(-2) as [Innings, Innings];
    const aRuns = runsOf(match, a);
    const bRuns = runsOf(match, b);
    if (aRuns === bRuns) {
      return { ...base, winnerTeamId: null, tied: true, text: "Match tied (Super Over tied)" };
    }
    const winner = aRuns > bRuns ? a.battingTeamId : b.battingTeamId;
    return {
      ...base,
      winnerTeamId: winner,
      decidedBySuperOver: true,
      text: `${name(winner)} won the Super Over`,
    };
  }

  if (match.settings.inningsPerSide === 1) {
    if (regular.length < 2)
      return { ...base, winnerTeamId: null, noResult: true, text: "No result" };
    const [first, second] = regular as [Innings, Innings];
    const target = inningsTarget(match, match.innings.indexOf(second)) ?? runsOf(match, first) + 1;
    const summary = summarizeInnings(second, bpo);
    const rain = match.rain;
    const tag =
      rain && (rain.revisedOvers != null || rain.officialTarget != null || rain.abandoned)
        ? ` (${rainMethodShort(rain.method)})`
        : "";
    if (rain?.abandoned && summary.runs < target) {
      const inputs = rainChaseInputs(match)!;
      const outcome = abandonedOutcome(
        rain,
        inputs,
        { runs: summary.runs, ballsFaced: summary.legalBalls },
        rainMinOvers(match),
      );
      if (outcome.kind === "no-result")
        return { ...base, winnerTeamId: null, noResult: true, text: "No result (rain)" };
      if (outcome.kind === "needs-par")
        return { ...base, winnerTeamId: null, noResult: true, text: "Awaiting official par score" };
      if (outcome.kind === "tie")
        return { ...base, winnerTeamId: null, tied: true, text: `Match tied${tag}` };
      if (outcome.kind === "chasing-won") {
        const wicketsLeft = inningsWicketLimit(match, second) - summary.wickets;
        return {
          ...base,
          winnerTeamId: second.battingTeamId,
          text: `${name(second.battingTeamId)} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}${tag}`,
        };
      }
      return {
        ...base,
        winnerTeamId: first.battingTeamId,
        text: `${name(first.battingTeamId)} won by ${outcome.margin} run${outcome.margin === 1 ? "" : "s"}${tag}`,
      };
    }
    if (summary.runs >= target) {
      const wicketsLeft = inningsWicketLimit(match, second) - summary.wickets;
      const limit = inningsBallLimit(match, second);
      const ballsLeft = limit !== null ? limit - summary.legalBalls : 0;
      return {
        ...base,
        winnerTeamId: second.battingTeamId,
        text: `${name(second.battingTeamId)} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}${ballsLeft > 0 ? ` (${ballsLeft} ball${ballsLeft === 1 ? "" : "s"} left)` : ""}${tag}`,
      };
    }
    if (summary.runs === target - 1)
      return { ...base, winnerTeamId: null, tied: true, text: `Match tied${tag}` };
    const margin = target - 1 - summary.runs;
    return {
      ...base,
      winnerTeamId: first.battingTeamId,
      text: `${name(first.battingTeamId)} won by ${margin} run${margin === 1 ? "" : "s"}${tag}`,
    };
  }

  // Two innings per side.
  const totals = teamTotals(match);
  if (regular.length === 3) {
    const twice = regular[2]!.battingTeamId;
    const other = match.teams.find((team) => team.id !== twice)!.id;
    const twiceRuns = totals.get(twice) ?? 0;
    const otherRuns = totals.get(other) ?? 0;
    const onceInnings = regular.filter((item) => item.battingTeamId === twice).length === 2;
    if (onceInnings && twiceRuns < otherRuns && !regular[2]!.unfinished && !match.days?.timeUp) {
      const margin = otherRuns - twiceRuns;
      return {
        ...base,
        winnerTeamId: other,
        text: `${name(other)} won by an innings and ${margin} run${margin === 1 ? "" : "s"}`,
      };
    }
  }
  if (regular.length === 4) {
    const fourth = regular[3]!;
    const target = inningsTarget(match, match.innings.indexOf(fourth)) ?? 0;
    const summary = summarizeInnings(fourth, bpo);
    if (summary.runs >= target) {
      const wicketsLeft = inningsWicketLimit(match, fourth) - summary.wickets;
      return {
        ...base,
        winnerTeamId: fourth.battingTeamId,
        text: `${name(fourth.battingTeamId)} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`,
      };
    }
    const allOut = summary.wickets >= inningsWicketLimit(match, fourth);
    if (allOut && summary.runs === target - 1)
      return { ...base, winnerTeamId: null, tied: true, text: "Match tied" };
    if (allOut) {
      const margin = target - 1 - summary.runs;
      return {
        ...base,
        winnerTeamId: fourth.bowlingTeamId,
        text: `${name(fourth.bowlingTeamId)} won by ${margin} run${margin === 1 ? "" : "s"}`,
      };
    }
  }
  return { ...base, winnerTeamId: null, drawn: true, text: "Match drawn" };
}

/** Rules a new match starts with for a format: free hits in limited-overs cricket, Super Overs in T10/T20. */
export function defaultRulesForFormat(format: MatchFormat): MatchRules {
  if (format === "Multi-day") return { followOnLead: 150 };
  if (format === "The Hundred")
    return { freeHit: true, superOver: true, rainMethod: "arr", endsChangeEvery: 10 };
  if (format === "Indoor") return { freeHit: true, pairs: { oversPerPair: 4, runsPerWicket: 5 } };
  if (format === "Tape-ball") return { freeHit: true, superOver: true, rainMethod: "arr" };
  return { freeHit: true, superOver: format === "T10" || format === "T20", rainMethod: "arr" };
}

export function deliveryLabel(delivery: Delivery) {
  if (delivery.dismissal) return "W";
  if (delivery.extras.wide) return delivery.extras.wide === 1 ? "Wd" : `${delivery.extras.wide}Wd`;
  if (delivery.extras.noBall)
    return delivery.batterRuns ? `${delivery.batterRuns + delivery.extras.noBall}Nb` : "Nb";
  if (delivery.extras.bye) return `${delivery.extras.bye}B`;
  if (delivery.extras.legBye) return `${delivery.extras.legBye}Lb`;
  return String(delivery.batterRuns);
}

/** The chase of a one-innings, limited-overs match: the only innings rain rules adjust. */
export function isRainChase(match: CricketMatch, innings: Innings): boolean {
  return (
    match.settings.inningsPerSide === 1 &&
    match.settings.oversPerInnings !== null &&
    !isSuperOver(innings) &&
    match.innings.indexOf(innings) === 1
  );
}

/** First-innings figures the rain methods need, or null before there is a first innings to chase. */
export function rainChaseInputs(match: CricketMatch): ChaseInputs | null {
  const first = match.innings[0];
  const allotted = match.settings.oversPerInnings;
  if (!first || allotted === null || match.settings.inningsPerSide !== 1) return null;
  const bpo = match.settings.ballsPerOver;
  const summary = summarizeInnings(first, bpo);
  const bowledOut = summary.wickets >= inningsWicketLimit(match, first);
  const usedUp = summary.legalBalls >= allotted * bpo;
  // Bowled out or overs used up: the rate is over the full allocation. Otherwise over the overs actually faced.
  const firstOvers = bowledOut || usedUp ? allotted : summary.legalBalls / bpo;
  const perOver: number[] = [];
  for (const ball of first.deliveries)
    perOver[ball.over] = (perOver[ball.over] ?? 0) + deliveryRuns(ball);
  return {
    firstRuns: summary.runs,
    firstOvers,
    firstOverRuns: Array.from(perOver, (runs) => runs ?? 0),
    ballsPerOver: bpo,
  };
}

/** Minimum overs the chasing side must face for a rain result. */
export function rainMinOvers(match: CricketMatch): number {
  const set = match.rain?.minOversForResult;
  if (set != null) return set;
  return defaultMinOversForResult(match.rain?.revisedOvers ?? match.settings.oversPerInnings ?? 20);
}

/** Live par score during a rain-affected chase, or null. */
export function liveParScore(match: CricketMatch): number | null {
  const chase = match.innings[1];
  if (!match.rain || !chase || !isRainChase(match, chase)) return null;
  const inputs = rainChaseInputs(match);
  if (!inputs) return null;
  return parScore(
    match.rain,
    inputs,
    summarizeInnings(chase, match.settings.ballsPerOver).legalBalls,
  );
}

/** Calls off the chase for rain: the innings ends and the result is decided on the par score. */
export function abandonForRain(match: CricketMatch): CricketMatch {
  const rain: RainState = {
    ...(match.rain ?? { method: match.settings.rules?.rainMethod ?? "arr" }),
    abandoned: true,
  };
  const innings = match.innings.map((item, index) =>
    index === match.innings.length - 1 ? { ...item, status: "completed" as const } : item,
  );
  return { ...match, rain, innings, status: "completed", updatedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Toss, retirements, squad changes and measured ball speed.
// ---------------------------------------------------------------------------

/** Who bats first after the toss: the winner if they chose to bat, otherwise the other side. */
export function battingFirstFromToss(
  winner: "home" | "away",
  decision: "bat" | "bowl",
): "home" | "away" {
  if (decision === "bat") return winner;
  return winner === "home" ? "away" : "home";
}

/** Record the toss for a match already set up: the decision follows from who is batting first. */
export function recordToss(match: CricketMatch, winnerTeamId: string): CricketMatch {
  const first = regularInnings(match)[0] ?? match.innings[0];
  if (!first || !match.teams.some((team) => team.id === winnerTeamId)) return match;
  const decision: Toss["decision"] = first.battingTeamId === winnerTeamId ? "bat" : "bowl";
  return { ...match, toss: { winnerTeamId, decision }, updatedAt: new Date().toISOString() };
}

export function tossSummary(match: CricketMatch): string | null {
  if (!match.toss) return null;
  const team = match.teams.find((item) => item.id === match.toss!.winnerTeamId);
  if (!team) return null;
  return `${team.name} won the toss and chose to ${match.toss.decision}`;
}

/** The newest retirement, when nothing has been bowled since (so it can still be undone). */
export function undoableRetirement(match: CricketMatch): Retirement | null {
  const innings = currentInnings(match);
  const last = innings.retirements?.at(-1);
  return last && last.afterBall === innings.deliveries.length ? last : null;
}

/**
 * A batter at the crease retires hurt (may come back later), retires out, or is given out timed out
 * (only before facing a ball). Retired out and timed out count as wickets; retired hurt does not.
 */
export function retireBatter(
  match: CricketMatch,
  batterId: string,
  kind: RetirementKind,
  replacementId?: string,
): CricketMatch {
  if (match.status !== "live" || match.days?.atStumps) return match;
  const innings = currentInnings(match);
  const slot =
    batterId === innings.strikerId
      ? "striker"
      : batterId === innings.nonStrikerId
        ? "nonStriker"
        : null;
  if (!slot) return match;
  const batted = innings.deliveries.some(
    (d) => d.strikerId === batterId || d.nonStrikerId === batterId,
  );
  if (kind === "timed-out" && batted) return match;
  const team = findTeam(match, innings.battingTeamId);
  const alone = innings.strikerId === innings.nonStrikerId;
  const other = slot === "striker" ? innings.nonStrikerId : innings.strikerId;
  const retirement: Retirement = {
    batterId,
    kind,
    afterBall: innings.deliveries.length,
    prevStrikerId: innings.strikerId,
    prevNonStrikerId: innings.nonStrikerId,
    at: new Date().toISOString(),
  };
  const withRetirement: Innings = {
    ...innings,
    retirements: [...(innings.retirements ?? []), retirement],
  };
  const options = availableBatters(team, withRetirement, [other, batterId]);
  const replacement = replacementId && options.includes(replacementId) ? replacementId : options[0];
  let strikerId = innings.strikerId;
  let nonStrikerId = innings.nonStrikerId;
  let noBatterLeft = false;
  if (replacement && !alone) {
    if (slot === "striker") strikerId = replacement;
    else nonStrikerId = replacement;
    retirement.replacementId = replacement;
  } else if (replacement && alone) {
    strikerId = replacement;
    nonStrikerId = replacement;
    retirement.replacementId = replacement;
  } else if (!alone && lastManStandsApplies(match, innings)) {
    strikerId = other;
    nonStrikerId = other;
  } else {
    noBatterLeft = true;
  }
  const updated: Innings = { ...withRetirement, strikerId, nonStrikerId };
  const summary = summarizeInnings(updated, match.settings.ballsPerOver);
  const complete = noBatterLeft || summary.wickets >= inningsWicketLimit(match, innings);
  updated.status = complete ? "completed" : "live";
  return {
    ...match,
    status: complete ? "innings-break" : "live",
    updatedAt: new Date().toISOString(),
    innings: [...match.innings.slice(0, -1), updated],
  };
}

/** Undo the newest retirement if no ball has been bowled since. */
export function undoRetirement(match: CricketMatch): CricketMatch {
  const last = undoableRetirement(match);
  if (!last || match.status === "completed") return match;
  const innings = currentInnings(match);
  return {
    ...match,
    status: "live",
    updatedAt: new Date().toISOString(),
    innings: [
      ...match.innings.slice(0, -1),
      {
        ...innings,
        status: "live",
        retirements: (innings.retirements ?? []).slice(0, -1),
        strikerId: last.prevStrikerId,
        nonStrikerId: last.prevNonStrikerId,
      },
    ],
  };
}

const mapTeam = (
  match: CricketMatch,
  teamId: string,
  change: (team: Team) => Team,
): CricketMatch => ({
  ...match,
  updatedAt: new Date().toISOString(),
  teams: match.teams.map((team) => (team.id === teamId ? change(team) : team)) as [Team, Team],
});

/** Add a player to a team during the match (they join the end of the batting order). */
export function addPlayer(
  match: CricketMatch,
  teamId: string,
  name: string,
  id?: string,
): CricketMatch {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean || !match.teams.some((team) => team.id === teamId)) return match;
  const playerId = id ?? `${teamId}-p-${makeId("player")}`;
  if (match.teams.some((team) => team.players.some((player) => player.id === playerId)))
    return match;
  return mapTeam(match, teamId, (team) => ({
    ...team,
    players: [...team.players, { id: playerId, name: clean }],
  }));
}

export function renamePlayer(match: CricketMatch, playerId: string, name: string): CricketMatch {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  const team = match.teams.find((item) => item.players.some((player) => player.id === playerId));
  if (!clean || !team) return match;
  return mapTeam(match, team.id, (item) => ({
    ...item,
    players: item.players.map((player) =>
      player.id === playerId ? { ...player, name: clean } : player,
    ),
  }));
}

export function setPlayerHand(
  match: CricketMatch,
  playerId: string,
  leftHanded: boolean,
): CricketMatch {
  const team = match.teams.find((item) => item.players.some((player) => player.id === playerId));
  if (!team) return match;
  return mapTeam(match, team.id, (item) => ({
    ...item,
    players: item.players.map((player) => {
      if (player.id !== playerId) return player;
      const { leftHanded: _old, ...rest } = player;
      return leftHanded ? { ...rest, leftHanded: true } : rest;
    }),
  }));
}

/** Move a player up (-1) or down (+1) the batting order. */
export function movePlayer(
  match: CricketMatch,
  teamId: string,
  playerId: string,
  delta: -1 | 1,
): CricketMatch {
  const team = match.teams.find((item) => item.id === teamId);
  const index = team?.players.findIndex((player) => player.id === playerId) ?? -1;
  const target = index + delta;
  if (!team || index < 0 || target < 0 || target >= team.players.length) return match;
  const players = [...team.players];
  [players[index], players[target]] = [players[target]!, players[index]!];
  return mapTeam(match, teamId, (item) => ({ ...item, players }));
}

/** Store (or clear) the measured speed of one ball. */
export function setDeliverySpeed(
  match: CricketMatch,
  deliveryId: string,
  kph: number | null,
  evidence?: VideoSpeedEvidence,
): CricketMatch {
  if (kph !== null && (!Number.isFinite(kph) || kph <= 0)) return match;
  const rounded = kph === null ? null : Math.round(kph * 10) / 10;
  const reviewed = evidence === undefined ? undefined : validateVideoSpeedEvidence(evidence);
  if (evidence !== undefined && (!reviewed || reviewed.kph !== rounded)) return match;
  let found = false;
  const innings = match.innings.map((item) => ({
    ...item,
    deliveries: item.deliveries.map((delivery) => {
      if (delivery.id !== deliveryId) return delivery;
      found = true;
      const { speedKph: _old, speedEvidence: _evidence, ...rest } = delivery;
      return rounded !== null
        ? { ...rest, speedKph: rounded, ...(reviewed ? { speedEvidence: reviewed } : {}) }
        : rest;
    }),
  }));
  return found ? { ...match, innings, updatedAt: new Date().toISOString() } : match;
}

// ---------------------------------------------------------------------------
// Formats, substitutes and corrections to earlier balls.
// ---------------------------------------------------------------------------

/** Overs and balls per over a new match of this format starts with. */
export function formatPreset(format: MatchFormat): {
  overs: number | null;
  ballsPerOver: number;
  note: string;
} {
  switch (format) {
    case "T10":
      return { overs: 10, ballsPerOver: 6, note: "" };
    case "T20":
      return { overs: 20, ballsPerOver: 6, note: "" };
    case "ODI":
      return { overs: 50, ballsPerOver: 6, note: "" };
    case "The Hundred":
      return {
        overs: 20,
        ballsPerOver: 5,
        note: "100 balls a side in sets of 5; ends change every 10 balls; a bowler may bowl 5 or 10 in a row (20 at most).",
      };
    case "Tape-ball":
      return {
        overs: 8,
        ballsPerOver: 6,
        note: "Short tape-ball game; change the overs to suit your street or ground.",
      };
    case "Indoor":
      return {
        overs: 16,
        ballsPerOver: 6,
        note: "8-a-side pairs cricket: each pair bats 4 overs and a wicket costs 5 runs.",
      };
    case "Multi-day":
      return { overs: null, ballsPerOver: 6, note: "" };
    case "Club":
      return { overs: 40, ballsPerOver: 6, note: "" };
    default:
      return { overs: 20, ballsPerOver: 6, note: "" };
  }
}

export type SubstituteKind = "fielding" | "concussion" | "impact";

/**
 * Bring on a substitute. Fielding substitutes only field. A concussion replacement or impact player
 * takes over from `outId`, who can no longer bat or bowl. A batter at the crease must retire first.
 */
export function substitutePlayer(
  match: CricketMatch,
  teamId: string,
  kind: SubstituteKind,
  name: string,
  outId?: string,
  id?: string,
): { match: CricketMatch } | { error: string } {
  const team = match.teams.find((item) => item.id === teamId);
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!team || clean.length < 2) return { error: "Enter the substitute's name." };
  const out = outId ? team.players.find((player) => player.id === outId) : undefined;
  if (kind !== "fielding") {
    if (!out) return { error: "Choose who is being replaced." };
    if (out.replacedBy) return { error: `${out.name} has already been replaced.` };
    const innings = currentInnings(match);
    if (
      match.status === "live" &&
      innings.battingTeamId === teamId &&
      (innings.strikerId === out.id || innings.nonStrikerId === out.id)
    ) {
      return {
        error: `${out.name} is batting. Record them as retired hurt first, then bring on the replacement.`,
      };
    }
  }
  const playerId = id ?? `${teamId}-sub-${makeId("player")}`;
  const added: Player = {
    id: playerId,
    name: clean,
    substitute: kind,
    ...(out && kind !== "fielding" ? { replaces: out.id } : {}),
  };
  const players = team.players.map((player) =>
    out && kind !== "fielding" && player.id === out.id
      ? { ...player, replacedBy: playerId }
      : player,
  );
  return {
    match: {
      ...match,
      updatedAt: new Date().toISOString(),
      teams: match.teams.map((item) =>
        item.id === teamId ? { ...item, players: [...players, added] } : item,
      ) as [Team, Team],
    },
  };
}

function inputFromDelivery(delivery: Delivery): RecordDeliveryInput {
  return {
    strikerId: delivery.strikerId,
    nonStrikerId: delivery.nonStrikerId,
    bowlerId: delivery.bowlerId,
    end: delivery.end,
    deliveryStyle: delivery.deliveryStyle,
    outcome: delivery.outcome,
    batterRuns: delivery.batterRuns,
    extras: delivery.extras,
    fieldZone: delivery.fieldZone,
    fielderId: delivery.fielderId,
    dismissal: delivery.dismissal,
    note: delivery.note,
    pitch: delivery.pitch,
    beehive: delivery.beehive,
  };
}

export type DeliveryCorrection = Partial<
  Pick<
    RecordDeliveryInput,
    | "batterRuns"
    | "extras"
    | "bowlerId"
    | "strikerId"
    | "nonStrikerId"
    | "fielderId"
    | "fieldZone"
    | "outcome"
    | "deliveryStyle"
    | "pitch"
    | "beehive"
  >
> & {
  /** null removes a dismissal. */
  dismissal?: Dismissal | null;
};

/**
 * Change any ball in the current innings (runs, extras, bowler, batters, fielder, dismissal). The
 * innings is replayed from the first ball so totals, overs and the free hit all follow. Later balls
 * keep who was on strike as recorded. Refused when the change would have ended the innings earlier.
 */
export function correctDelivery(
  match: CricketMatch,
  deliveryId: string,
  change: DeliveryCorrection,
): { match: CricketMatch } | { error: string } {
  const innings = currentInnings(match);
  const index = innings.deliveries.findIndex((item) => item.id === deliveryId);
  if (index < 0) return { error: "Only balls in the current innings can be corrected." };
  const newOut = change.dismissal?.batterId;
  if (
    newOut &&
    innings.deliveries[index]!.dismissal?.batterId !== newOut &&
    innings.deliveries
      .slice(index + 1)
      .some((item) => item.strikerId === newOut || item.nonStrikerId === newOut)
  ) {
    return { error: "That batter kept batting after this ball. Fix the later balls first." };
  }
  const first = innings.deliveries[0]!;
  const retirements = innings.retirements ?? [];
  const originalStatus = innings.status;
  let replay: CricketMatch = {
    ...match,
    status: "live",
    stoppage: null,
    ...(match.days ? { days: { ...match.days, atStumps: false } } : {}),
    innings: [
      ...match.innings.slice(0, -1),
      {
        ...innings,
        deliveries: [],
        retirements: [],
        status: "live",
        strikerId: first.strikerId,
        nonStrikerId: first.nonStrikerId,
        bowlerId: first.bowlerId,
      },
    ],
  };
  const applyRetirements = (afterBall: number) => {
    for (const item of retirements.filter((entry) => entry.afterBall === afterBall)) {
      const next = retireBatter(replay, item.batterId, item.kind, item.replacementId);
      if (next !== replay) {
        const current = currentInnings(next);
        const kept = (current.retirements ?? []).map((entry, i, all) =>
          i === all.length - 1 ? { ...entry, at: item.at } : entry,
        );
        replay = {
          ...next,
          innings: [...next.innings.slice(0, -1), { ...current, retirements: kept }],
        };
      }
    }
  };
  for (let i = 0; i < innings.deliveries.length; i += 1) {
    applyRetirements(i);
    const original = innings.deliveries[i]!;
    let input = inputFromDelivery(original);
    if (i === index) {
      const { dismissal, ...rest } = change;
      input = { ...input, ...rest, extras: { ...original.extras, ...(change.extras ?? {}) } };
      if (dismissal === null) {
        input.dismissal = undefined;
        if (input.outcome === "wicket") input.outcome = input.batterRuns ? "hit" : "hit-no-run";
      } else if (dismissal) {
        input.dismissal = dismissal;
        input.outcome = "wicket";
      }
    }
    if (currentInnings(replay).status !== "live" || replay.status !== "live") {
      return {
        error:
          "With that change the innings would have ended before this ball. Undo the later balls first.",
      };
    }
    const next = recordDelivery(replay, input);
    if (next === replay)
      return {
        error:
          "That change isn't allowed here (for example a free hit can't be out bowled or caught).",
      };
    const current = currentInnings(next);
    const recorded = current.deliveries.at(-1)!;
    const restored: Delivery = {
      ...recorded,
      id: original.id,
      sequence: original.sequence,
      recordedAt: original.recordedAt,
      ...(original.speedKph != null ? { speedKph: original.speedKph } : {}),
      ...(original.speedEvidence ? { speedEvidence: original.speedEvidence } : {}),
    };
    replay = {
      ...next,
      innings: [
        ...next.innings.slice(0, -1),
        { ...current, deliveries: [...current.deliveries.slice(0, -1), restored] },
      ],
    };
  }
  applyRetirements(innings.deliveries.length);
  const done = currentInnings(replay);
  // Keep who is at the crease and bowling now unless the innings state changed.
  const out = dismissedPlayerIds(done);
  const keepCrease =
    done.status === "live" &&
    originalStatus === "live" &&
    (Boolean(pairsRule(match, innings)) ||
      (!out.has(innings.strikerId) && !out.has(innings.nonStrikerId)));
  const finalInnings: Innings = keepCrease
    ? {
        ...done,
        strikerId: innings.strikerId,
        nonStrikerId: innings.nonStrikerId,
        bowlerId: innings.bowlerId,
        end: innings.end,
      }
    : done;
  return {
    match: {
      ...replay,
      stoppage: match.stoppage ?? null,
      ...(match.days ? { days: match.days } : {}),
      updatedAt: new Date().toISOString(),
      innings: [...replay.innings.slice(0, -1), finalInnings],
      status:
        finalInnings.status === "completed"
          ? match.status === "completed"
            ? "completed"
            : "innings-break"
          : "live",
    },
  };
}
