export type MatchFormat = "T10" | "T20" | "ODI" | "School" | "Club" | "Multi-day" | "Custom";

export type MatchStatus = "live" | "innings-break" | "completed";
export type InningsStatus = "live" | "completed";
export type DeliveryEnd = "Pavilion" | "Far";
export type DeliveryStyle = "Fast" | "Medium" | "Off spin" | "Leg spin" | "Left-arm spin" | "Other";
export type ShotOutcome = "hit" | "hit-no-run" | "left" | "missed" | "wicket";
export type FieldZone =
  | "Fine leg"
  | "Square leg"
  | "Mid-wicket"
  | "Long on"
  | "Straight"
  | "Long off"
  | "Cover"
  | "Point"
  | "Third"
  | "Keeper"
  | "Bowler"
  | "Not recorded";

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

export interface MatchSettings {
  format: MatchFormat;
  oversPerInnings: number | null;
  inningsPerSide: 1 | 2;
  ballsPerOver: number;
  ground: string;
  weather: string;
  startTime: string;
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
}

export interface CricketMatch {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: MatchStatus;
  settings: MatchSettings;
  teams: [Team, Team];
  innings: Innings[];
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

const createInnings = (number: number, battingTeam: Team, bowlingTeam: Team): Innings => ({
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
  if (match.status !== "live") return match;
  const innings = currentInnings(match);
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
    }
  }

  const completedRunningRuns =
    delivery.batterRuns +
    delivery.extras.bye +
    delivery.extras.legBye +
    Math.max(0, delivery.extras.wide - 1);
  if (completedRunningRuns % 2 === 1) [strikerId, nonStrikerId] = [nonStrikerId, strikerId];

  const legalBallsAfter = summaryBefore.legalBalls + (legal ? 1 : 0);
  if (legal && legalBallsAfter % match.settings.ballsPerOver === 0) {
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
  const maximumBalls = match.settings.oversPerInnings
    ? match.settings.oversPerInnings * match.settings.ballsPerOver
    : null;
  const allOut = summaryAfter.wickets >= Math.max(1, battingTeam.players.length - 1);
  const oversComplete = maximumBalls !== null && summaryAfter.legalBalls >= maximumBalls;
  const inningsComplete = allOut || oversComplete;
  updatedInnings.status = inningsComplete ? "completed" : "live";

  return {
    ...match,
    updatedAt: new Date().toISOString(),
    status: inningsComplete ? "innings-break" : "live",
    innings: [...match.innings.slice(0, -1), updatedInnings],
  };
}

export function endCurrentInnings(match: CricketMatch): CricketMatch {
  if (match.status === "completed") return match;
  const innings = currentInnings(match);
  return {
    ...match,
    updatedAt: new Date().toISOString(),
    status: "innings-break",
    innings: [...match.innings.slice(0, -1), { ...innings, status: "completed" }],
  };
}

export function startNextInnings(match: CricketMatch): CricketMatch {
  const totalInnings = match.settings.inningsPerSide * 2;
  if (match.innings.length >= totalInnings) {
    return { ...match, status: "completed", updatedAt: new Date().toISOString() };
  }
  const firstBattingTeamId = match.innings[0]!.battingTeamId;
  const firstBattingTeam = findTeam(match, firstBattingTeamId);
  const firstBowlingTeam = match.teams.find((team) => team.id !== firstBattingTeamId)!;
  const nextNumber = match.innings.length + 1;
  const battingTeam = nextNumber % 2 === 1 ? firstBattingTeam : firstBowlingTeam;
  const bowlingTeam = nextNumber % 2 === 1 ? firstBowlingTeam : firstBattingTeam;
  return {
    ...match,
    status: "live",
    updatedAt: new Date().toISOString(),
    innings: [...match.innings, createInnings(nextNumber, battingTeam, bowlingTeam)],
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
    const balls = faced.filter((delivery) => delivery.legal).length;
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
      return {
        playerId: player.id,
        name: player.name,
        balls,
        overs: `${Math.floor(balls / match.settings.ballsPerOver)}.${balls % match.settings.ballsPerOver}`,
        maidens: 0,
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
  if (match.innings.length !== 2) return null;
  return summarizeInnings(match.innings[0]!, match.settings.ballsPerOver).runs + 1;
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
