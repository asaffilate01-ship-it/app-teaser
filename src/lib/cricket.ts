import { abandonedOutcome, defaultMinOversForResult, parScore, rainMethodShort, revisedTarget, type ChaseInputs, type RainMethod, type RainState } from "./rain-rules.ts";
export type MatchFormat = "T10" | "T20" | "ODI" | "School" | "Club" | "Multi-day" | "Custom";

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
  const battingTeam = input.battingFirst === "home" ? home : away;
  const bowlingTeam = input.battingFirst === "home" ? away : home;
  const now = new Date().toISOString();

  return {
    id: makeId("match"),
    createdAt: now,
    updatedAt: now,
    status: "live",
    settings: input.settings,
    teams: [home, away],
    innings: [createInnings(1, battingTeam, bowlingTeam)],
  };
}

export const currentInnings = (match: CricketMatch) => match.innings.at(-1)!;
export const findTeam = (match: CricketMatch, id: string) =>
  match.teams.find((team) => team.id === id)!;
export const findPlayer = (match: CricketMatch, id: string) =>
  match.teams.flatMap((team) => team.players).find((player) => player.id === id);

export const deliveryRuns = (delivery: Delivery) =>
  delivery.batterRuns + Object.values(delivery.extras).reduce((sum, value) => sum + value, 0);

export const isBowlerWicket = (type: DismissalType) =>
  !["run-out", "obstructing-the-field"].includes(type);

export function summarizeInnings(innings: Innings, ballsPerOver = 6): InningsSummary {
  const extras = innings.deliveries.reduce<Extras>(
    (totals, delivery) => ({
      wide: totals.wide + delivery.extras.wide,
      noBall: totals.noBall + delivery.extras.noBall,
      bye: totals.bye + delivery.extras.bye,
      legBye: totals.legBye + delivery.extras.legBye,
      penalty: totals.penalty + delivery.extras.penalty,
    }),
    emptyExtras(),
  );
  const runs = innings.deliveries.reduce((sum, delivery) => sum + deliveryRuns(delivery), 0);
  const legalBalls = innings.deliveries.filter((delivery) => delivery.legal).length;
  const wickets = innings.deliveries.filter((delivery) => Boolean(delivery.dismissal)).length;

  return {
    runs,
    wickets,
    legalBalls,
    overs: `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`,
    runRate: legalBalls ? (runs * ballsPerOver) / legalBalls : 0,
    extras: { ...extras, total: Object.values(extras).reduce((sum, value) => sum + value, 0) },
  };
}

const dismissedPlayerIds = (innings: Innings) =>
  new Set(
    innings.deliveries.flatMap((delivery) =>
      delivery.dismissal ? [delivery.dismissal.batterId] : [],
    ),
  );

const nextBatter = (team: Team, innings: Innings, activeIds: string[]) => {
  const dismissed = dismissedPlayerIds(innings);
  return team.players.find((player) => !dismissed.has(player.id) && !activeIds.includes(player.id))
    ?.id;
};

export function recordDelivery(match: CricketMatch, input: RecordDeliveryInput): CricketMatch {
  if (match.status !== "live" || match.days?.atStumps) return match;
  const innings = currentInnings(match);
  const freeHit = nextBallIsFreeHit(match);
  // On a free hit the batter cannot be bowled, caught, lbw, stumped or out hit wicket.
  if (freeHit && input.dismissal && !freeHitDismissals.includes(input.dismissal.type)) return match;
  const summaryBefore = summarizeInnings(innings, match.settings.ballsPerOver);
  const extras = { ...emptyExtras(), ...input.extras };
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
    batterRuns: Math.max(0, input.batterRuns),
    extras,
    fieldZone: input.fieldZone ?? "Not recorded",
    fielderId: input.fielderId || undefined,
    dismissal: input.dismissal,
    note: input.note?.trim() || undefined,
    ...(freeHit ? { freeHit: true } : {}),
  };

  const deliveries = [...innings.deliveries, delivery];
  const battingTeam = findTeam(match, innings.battingTeamId);
  let strikerId = input.strikerId;
  let nonStrikerId = input.nonStrikerId;

  if (input.dismissal) {
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
  if (!batterAlone && legal && legalBallsAfter % match.settings.ballsPerOver === 0) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }

  const updatedInnings: Innings = {
    ...innings,
    strikerId,
    nonStrikerId,
    bowlerId: input.bowlerId,
    end: input.end,
    deliveries,
  };
  const summaryAfter = summarizeInnings(updatedInnings, match.settings.ballsPerOver);
  const maximumBalls = inningsBallLimit(match, innings);
  const allOut = summaryAfter.wickets >= inningsWicketLimit(match, innings);
  const oversComplete = maximumBalls !== null && summaryAfter.legalBalls >= maximumBalls;
  // A chase (one-innings second innings, fourth innings, or second half of a Super Over)
  // finishes as soon as the target is reached.
  const target = targetForCurrentInnings(match);
  const chaseWon = target !== null && summaryAfter.runs >= target;
  const inningsComplete = allOut || oversComplete || chaseWon;
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
  const followOn = plan.kind === "regular" && options.followOn === true && plan.followOnTeamId !== null;
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
    return {
      playerId: player.id,
      name: player.name,
      runs,
      balls,
      fours: faced.filter((delivery) => delivery.batterRuns === 4).length,
      sixes: faced.filter((delivery) => delivery.batterRuns === 6).length,
      strikeRate: balls ? (runs * 100) / balls : 0,
      dismissal: dismissalDelivery ? dismissalLabel(dismissalDelivery, match) : "not out",
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
  let free = false;
  for (const delivery of currentInnings(match).deliveries) {
    if (delivery.extras.noBall > 0) free = true;
    else if (delivery.extras.wide > 0) continue;
    else free = false;
  }
  return free;
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
  if (revised != null && isRainChase(match, innings)) return Math.round(revised * match.settings.ballsPerOver);
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
    totals.set(innings.battingTeamId, (totals.get(innings.battingTeamId) ?? 0) + runsOf(match, innings));
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
      return { kind: "regular", number, battingTeamId: last.bowlingTeamId, followOnTeamId: null, lead: 0 };
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
    if ((totals.get(twiceTeamId) ?? 0) < (totals.get(fourthBattingTeamId) ?? 0)) return { kind: "complete" };
    return { kind: "regular", number, battingTeamId: fourthBattingTeamId, followOnTeamId: null, lead: 0 };
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
    return { ...base, winnerTeamId: winner, decidedBySuperOver: true, text: `${name(winner)} won the Super Over` };
  }

  if (match.settings.inningsPerSide === 1) {
    if (regular.length < 2) return { ...base, winnerTeamId: null, noResult: true, text: "No result" };
    const [first, second] = regular as [Innings, Innings];
    const target = inningsTarget(match, match.innings.indexOf(second)) ?? runsOf(match, first) + 1;
    const summary = summarizeInnings(second, bpo);
    const rain = match.rain;
    const tag = rain && (rain.revisedOvers != null || rain.officialTarget != null || rain.abandoned) ? ` (${rainMethodShort(rain.method)})` : "";
    if (rain?.abandoned && summary.runs < target) {
      const inputs = rainChaseInputs(match)!;
      const outcome = abandonedOutcome(rain, inputs, { runs: summary.runs, ballsFaced: summary.legalBalls }, rainMinOvers(match));
      if (outcome.kind === "no-result") return { ...base, winnerTeamId: null, noResult: true, text: "No result (rain)" };
      if (outcome.kind === "needs-par") return { ...base, winnerTeamId: null, noResult: true, text: "Awaiting official par score" };
      if (outcome.kind === "tie") return { ...base, winnerTeamId: null, tied: true, text: `Match tied${tag}` };
      if (outcome.kind === "chasing-won") {
        const wicketsLeft = inningsWicketLimit(match, second) - summary.wickets;
        return { ...base, winnerTeamId: second.battingTeamId, text: `${name(second.battingTeamId)} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}${tag}` };
      }
      return { ...base, winnerTeamId: first.battingTeamId, text: `${name(first.battingTeamId)} won by ${outcome.margin} run${outcome.margin === 1 ? "" : "s"}${tag}` };
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
    if (summary.runs === target - 1) return { ...base, winnerTeamId: null, tied: true, text: `Match tied${tag}` };
    const margin = target - 1 - summary.runs;
    return { ...base, winnerTeamId: first.battingTeamId, text: `${name(first.battingTeamId)} won by ${margin} run${margin === 1 ? "" : "s"}${tag}` };
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
      return { ...base, winnerTeamId: other, text: `${name(other)} won by an innings and ${margin} run${margin === 1 ? "" : "s"}` };
    }
  }
  if (regular.length === 4) {
    const fourth = regular[3]!;
    const target = inningsTarget(match, match.innings.indexOf(fourth)) ?? 0;
    const summary = summarizeInnings(fourth, bpo);
    if (summary.runs >= target) {
      const wicketsLeft = inningsWicketLimit(match, fourth) - summary.wickets;
      return { ...base, winnerTeamId: fourth.battingTeamId, text: `${name(fourth.battingTeamId)} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}` };
    }
    const allOut = summary.wickets >= inningsWicketLimit(match, fourth);
    if (allOut && summary.runs === target - 1) return { ...base, winnerTeamId: null, tied: true, text: "Match tied" };
    if (allOut) {
      const margin = target - 1 - summary.runs;
      return { ...base, winnerTeamId: fourth.bowlingTeamId, text: `${name(fourth.bowlingTeamId)} won by ${margin} run${margin === 1 ? "" : "s"}` };
    }
  }
  return { ...base, winnerTeamId: null, drawn: true, text: "Match drawn" };
}

/** Rules a new match starts with for a format: free hits in limited-overs cricket, Super Overs in T10/T20. */
export function defaultRulesForFormat(format: MatchFormat): MatchRules {
  if (format === "Multi-day") return { followOnLead: 150 };
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
  for (const ball of first.deliveries) perOver[ball.over] = (perOver[ball.over] ?? 0) + deliveryRuns(ball);
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
  return parScore(match.rain, inputs, summarizeInnings(chase, match.settings.ballsPerOver).legalBalls);
}

/** Calls off the chase for rain: the innings ends and the result is decided on the par score. */
export function abandonForRain(match: CricketMatch): CricketMatch {
  const rain: RainState = { ...(match.rain ?? { method: match.settings.rules?.rainMethod ?? "arr" }), abandoned: true };
  const innings = match.innings.map((item, index) => (index === match.innings.length - 1 ? { ...item, status: "completed" as const } : item));
  return { ...match, rain, innings, status: "completed", updatedAt: new Date().toISOString() };
}
