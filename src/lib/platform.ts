export const platformRoles = [
  "owner",
  "league_admin",
  "club_admin",
  "safeguarding_officer",
  "treasurer",
  "team_manager",
  "scorer",
  "coach",
  "player",
  "viewer",
] as const;

export type PlatformRole = (typeof platformRoles)[number];

export const permissions = [
  "organisation.manage",
  "members.manage",
  "team.manage",
  "player.manage",
  "competition.manage",
  "fixtures.manage",
  "match.manage",
  "match.score",
  "match.view_private",
  "video.capture",
  "video.review",
  "video.publish",
  "player.private_data",
  "safeguarding.manage",
  "billing.manage",
  "audit.review",
  "fees.manage",
  "bookings.manage",
  "bookings.request",
  "events.manage",
  "travel.manage",
  "drivers.approve",
  "store.manage",
  "guardians.manage",
  "umpires.manage",
  "umpires.pay",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<PlatformRole, ReadonlySet<Permission>> = {
  owner: new Set(permissions),
  league_admin: new Set([
    "organisation.manage",
    "members.manage",
    "team.manage",
    "player.manage",
    "competition.manage",
    "fixtures.manage",
    "match.manage",
    "match.score",
    "match.view_private",
    "video.review",
    "video.publish",
    "audit.review",
    "bookings.manage",
    "bookings.request",
    "events.manage",
    "umpires.manage",
    "umpires.pay",
  ]),
  club_admin: new Set([
    "members.manage",
    "team.manage",
    "player.manage",
    "fixtures.manage",
    "match.manage",
    "match.score",
    "match.view_private",
    "video.capture",
    "video.review",
    "video.publish",
    "audit.review",
    "fees.manage",
    "bookings.manage",
    "bookings.request",
    "events.manage",
    "travel.manage",
    "store.manage",
    "guardians.manage",
    "umpires.manage",
    "umpires.pay",
  ]),
  safeguarding_officer: new Set([
    "match.view_private",
    "video.review",
    "video.publish",
    "player.private_data",
    "safeguarding.manage",
    "audit.review",
    "travel.manage",
    "drivers.approve",
    "guardians.manage",
  ]),
  treasurer: new Set(["match.view_private", "fees.manage", "store.manage", "umpires.pay"]),
  team_manager: new Set([
    "match.view_private",
    "events.manage",
    "bookings.request",
    "travel.manage",
    "store.manage",
  ]),
  scorer: new Set(["match.manage", "match.score", "match.view_private", "video.capture"]),
  coach: new Set([
    "player.manage",
    "match.view_private",
    "video.capture",
    "video.review",
    "audit.review",
    "events.manage",
    "bookings.request",
  ]),
  player: new Set(["match.view_private", "video.review"]),
  viewer: new Set(["match.view_private"]),
};

export function can(role: PlatformRole, permission: Permission): boolean {
  return rolePermissions[role]?.has(permission) ?? false;
}

/**
 * Roles a member may hand out or change. Mirrors `public.can_assign_role` in the database,
 * which is what actually enforces it: owners manage everyone, club and league admins only
 * manage the roles below them, and nobody can change their own role.
 */
export function assignableRoles(actor: PlatformRole): PlatformRole[] {
  if (actor === "owner") return [...platformRoles];
  if (actor === "club_admin" || actor === "league_admin")
    return ["treasurer", "team_manager", "scorer", "coach", "player", "viewer"];
  return [];
}

export const roleLabels: Record<PlatformRole, string> = {
  owner: "Owner",
  league_admin: "League admin",
  club_admin: "Club admin",
  safeguarding_officer: "Safeguarding officer",
  treasurer: "Treasurer",
  team_manager: "Team manager",
  scorer: "Scorer",
  coach: "Coach",
  player: "Player",
  viewer: "Member / parent",
};

export interface CompetitionRules {
  version: number;
  ballsPerOver: number;
  oversPerInnings: number | null;
  inningsPerSide: number;
  points: {
    win: number;
    tie: number;
    noResult: number;
    loss: number;
  };
  tieBreakers: Array<"points" | "wins" | "net-run-rate" | "head-to-head">;
  /** Default rain method for shortened chases in this competition. */
  rainMethod?: "arr" | "mpo" | "dls" | "manual";
  bonusPoints?: {
    battingAtRuns?: number;
    battingPoints?: number;
    bowlingAtWickets?: number;
    bowlingPoints?: number;
  };
  rainRule?: {
    provider: string;
    method: string;
    edition: string;
    parameters: Record<string, string | number | boolean>;
  };
}

export interface CompletedFixture {
  id: string;
  /** Awarded without play (the other side conceded). */
  walkover?: boolean;
  homeTeamId: string;
  awayTeamId: string;
  status: "completed" | "abandoned" | "cancelled";
  winnerTeamId?: string;
  tied?: boolean;
  noResult?: boolean;
  homeRuns?: number;
  homeLegalBalls?: number;
  awayRuns?: number;
  awayLegalBalls?: number;
  homeBonusPoints?: number;
  awayBonusPoints?: number;
}

export interface TableRow {
  teamId: string;
  played: number;
  won: number;
  tied: number;
  lost: number;
  noResult: number;
  points: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
  netRunRate: number;
  /** League points added or taken away by the organisers (already inside points). */
  pointsAdjustment?: number;
}

/** Points the league added or deducted for a team, with the reason shown under the table. */
export interface PointAdjustment {
  teamId: string;
  points: number;
  reason: string;
}

export interface FixtureTeam {
  id: string;
  homeGroundId: string;
  unavailableSlotIds?: string[];
}

export interface FixtureSlot {
  id: string;
  startsAt: string;
  availableGroundIds: string[];
}

export interface GeneratedFixture {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  slotId: string | null;
  groundId: string | null;
  conflicts: string[];
}

export function generateRoundRobinFixtures(
  teams: FixtureTeam[],
  slots: FixtureSlot[],
  playEachOtherTwice = false,
): GeneratedFixture[] {
  if (teams.length < 2) return [];
  const participants: Array<FixtureTeam | null> = [...teams];
  if (participants.length % 2 === 1) participants.push(null);
  const rounds = participants.length - 1;
  const half = participants.length / 2;
  const rotation = [...participants];
  const output: GeneratedFixture[] = [];
  const usedGroundsBySlot = new Map<string, Set<string>>();
  const usedTeamsBySlot = new Map<string, Set<string>>();
  let slotCursor = 0;

  const addLeg = (leg: number, reverse: boolean) => {
    for (let round = 0; round < rounds; round += 1) {
      for (let pairing = 0; pairing < half; pairing += 1) {
        const first = rotation[pairing];
        const second = rotation[rotation.length - 1 - pairing];
        if (!first || !second) continue;
        const flip = (round + pairing) % 2 === 1;
        const naturalHome = flip ? second : first;
        const naturalAway = flip ? first : second;
        const home = reverse ? naturalAway : naturalHome;
        const away = reverse ? naturalHome : naturalAway;
        let selectedSlot: FixtureSlot | undefined;
        let selectedGround: string | undefined;

        for (let offset = 0; offset < slots.length; offset += 1) {
          const slot = slots[(slotCursor + offset) % slots.length];
          if (!slot) continue;
          const unavailable = new Set([
            ...(home.unavailableSlotIds ?? []),
            ...(away.unavailableSlotIds ?? []),
          ]);
          const bookedTeams = usedTeamsBySlot.get(slot.id);
          if (unavailable.has(slot.id) || bookedTeams?.has(home.id) || bookedTeams?.has(away.id))
            continue;
          const bookedGrounds = usedGroundsBySlot.get(slot.id);
          const ground =
            slot.availableGroundIds.includes(home.homeGroundId) &&
            !bookedGrounds?.has(home.homeGroundId)
              ? home.homeGroundId
              : slot.availableGroundIds.find((candidate) => !bookedGrounds?.has(candidate));
          if (!ground) continue;
          selectedSlot = slot;
          selectedGround = ground;
          slotCursor = (slots.indexOf(slot) + 1) % Math.max(1, slots.length);
          break;
        }

        const conflicts: string[] = [];
        if (!selectedSlot)
          conflicts.push("No slot satisfies team availability and ground capacity.");
        if (selectedSlot && selectedGround) {
          const used = usedGroundsBySlot.get(selectedSlot.id) ?? new Set<string>();
          used.add(selectedGround);
          usedGroundsBySlot.set(selectedSlot.id, used);
          const bookedTeams = usedTeamsBySlot.get(selectedSlot.id) ?? new Set<string>();
          bookedTeams.add(home.id);
          bookedTeams.add(away.id);
          usedTeamsBySlot.set(selectedSlot.id, bookedTeams);
        }
        output.push({
          round: round + 1 + leg * rounds,
          homeTeamId: home.id,
          awayTeamId: away.id,
          slotId: selectedSlot?.id ?? null,
          groundId: selectedGround ?? null,
          conflicts,
        });
      }
      const fixed = rotation[0] ?? null;
      const rest = rotation.slice(1);
      const moved = rest.pop() ?? null;
      rotation.splice(0, rotation.length, fixed, moved, ...rest);
    }
  };

  addLeg(0, false);
  if (playEachOtherTwice) {
    rotation.splice(0, rotation.length, ...participants);
    addLeg(1, true);
  }
  return output;
}

export interface KnockoutTie {
  round: number;
  position: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  advancesTeamId: string | null;
}

export function seedKnockoutBracket(seedOrder: string[]): KnockoutTie[] {
  if (seedOrder.length < 2) return [];
  const bracketSize = 2 ** Math.ceil(Math.log2(seedOrder.length));
  const seeded: Array<string | null> = [
    ...seedOrder,
    ...Array<string | null>(bracketSize - seedOrder.length).fill(null),
  ];
  const ties: KnockoutTie[] = [];
  for (let position = 0; position < bracketSize / 2; position += 1) {
    const homeTeamId = seeded[position] ?? null;
    const awayTeamId = seeded[bracketSize - 1 - position] ?? null;
    ties.push({
      round: 1,
      position: position + 1,
      homeTeamId,
      awayTeamId,
      advancesTeamId: homeTeamId && !awayTeamId ? homeTeamId : null,
    });
  }
  return ties;
}

function emptyTableRow(teamId: string): TableRow {
  return {
    teamId,
    played: 0,
    won: 0,
    tied: 0,
    lost: 0,
    noResult: 0,
    points: 0,
    runsFor: 0,
    ballsFaced: 0,
    runsAgainst: 0,
    ballsBowled: 0,
    netRunRate: 0,
  };
}

function effectiveOvers(balls: number, ballsPerOver: number): number {
  return balls > 0 ? balls / ballsPerOver : 0;
}

export function calculateCompetitionTable(
  teamIds: string[],
  fixtures: CompletedFixture[],
  rules: CompetitionRules,
  adjustments: readonly PointAdjustment[] = [],
): TableRow[] {
  const rows = new Map(teamIds.map((teamId) => [teamId, emptyTableRow(teamId)]));
  for (const adjustment of adjustments) {
    const row = rows.get(adjustment.teamId);
    if (!row || !Number.isFinite(adjustment.points)) continue;
    row.points += adjustment.points;
    row.pointsAdjustment =
      Math.round(((row.pointsAdjustment ?? 0) + adjustment.points) * 100) / 100;
  }

  for (const fixture of fixtures) {
    if (fixture.status !== "completed" && fixture.status !== "abandoned") continue;
    const home = rows.get(fixture.homeTeamId);
    const away = rows.get(fixture.awayTeamId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;

    if (fixture.noResult || fixture.status === "abandoned") {
      home.noResult += 1;
      away.noResult += 1;
      home.points += rules.points.noResult;
      away.points += rules.points.noResult;
    } else if (fixture.tied) {
      home.tied += 1;
      away.tied += 1;
      home.points += rules.points.tie;
      away.points += rules.points.tie;
    } else if (fixture.winnerTeamId === fixture.homeTeamId) {
      home.won += 1;
      away.lost += 1;
      home.points += rules.points.win;
      away.points += rules.points.loss;
    } else if (fixture.winnerTeamId === fixture.awayTeamId) {
      away.won += 1;
      home.lost += 1;
      away.points += rules.points.win;
      home.points += rules.points.loss;
    }

    home.points += fixture.homeBonusPoints ?? 0;
    away.points += fixture.awayBonusPoints ?? 0;
    home.runsFor += fixture.homeRuns ?? 0;
    home.ballsFaced += fixture.homeLegalBalls ?? 0;
    home.runsAgainst += fixture.awayRuns ?? 0;
    home.ballsBowled += fixture.awayLegalBalls ?? 0;
    away.runsFor += fixture.awayRuns ?? 0;
    away.ballsFaced += fixture.awayLegalBalls ?? 0;
    away.runsAgainst += fixture.homeRuns ?? 0;
    away.ballsBowled += fixture.homeLegalBalls ?? 0;
  }

  const result = Array.from(rows.values());
  for (const row of result) {
    const scoringRate =
      effectiveOvers(row.ballsFaced, rules.ballsPerOver) > 0
        ? row.runsFor / effectiveOvers(row.ballsFaced, rules.ballsPerOver)
        : 0;
    const concessionRate =
      effectiveOvers(row.ballsBowled, rules.ballsPerOver) > 0
        ? row.runsAgainst / effectiveOvers(row.ballsBowled, rules.ballsPerOver)
        : 0;
    row.netRunRate = Number((scoringRate - concessionRate).toFixed(3));
  }

  return result.sort((a, b) => {
    for (const tieBreaker of rules.tieBreakers) {
      if (tieBreaker === "points" && a.points !== b.points) return b.points - a.points;
      if (tieBreaker === "wins" && a.won !== b.won) return b.won - a.won;
      if (tieBreaker === "net-run-rate" && a.netRunRate !== b.netRunRate)
        return b.netRunRate - a.netRunRate;
    }
    return a.teamId.localeCompare(b.teamId);
  });
}

export interface PlayerDeliveryFact {
  batterId: string;
  bowlerId: string;
  batterRuns: number;
  extras: number;
  legalBall: boolean;
  wicket: boolean;
  creditedBowlerWicket: boolean;
  fielderId?: string;
  fieldingDismissal?: "catch" | "stumping" | "run-out";
}

export interface PlayerCareer {
  playerId: string;
  batting: { runs: number; balls: number; fours: number; sixes: number; strikeRate: number };
  bowling: { balls: number; runs: number; wickets: number; economy: number };
  fielding: { catches: number; stumpings: number; runOuts: number };
}

export function buildCareer(playerId: string, deliveries: PlayerDeliveryFact[]): PlayerCareer {
  let battingRuns = 0;
  let battingBalls = 0;
  let fours = 0;
  let sixes = 0;
  let bowlingBalls = 0;
  let bowlingRuns = 0;
  let bowlingWickets = 0;
  let catches = 0;
  let stumpings = 0;
  let runOuts = 0;

  for (const delivery of deliveries) {
    if (delivery.batterId === playerId) {
      battingRuns += delivery.batterRuns;
      if (delivery.legalBall) battingBalls += 1;
      if (delivery.batterRuns === 4) fours += 1;
      if (delivery.batterRuns === 6) sixes += 1;
    }
    if (delivery.bowlerId === playerId) {
      if (delivery.legalBall) bowlingBalls += 1;
      bowlingRuns += delivery.batterRuns + delivery.extras;
      if (delivery.creditedBowlerWicket) bowlingWickets += 1;
    }
    if (delivery.fielderId === playerId) {
      if (delivery.fieldingDismissal === "catch") catches += 1;
      if (delivery.fieldingDismissal === "stumping") stumpings += 1;
      if (delivery.fieldingDismissal === "run-out") runOuts += 1;
    }
  }

  const overs = effectiveOvers(bowlingBalls, 6);
  return {
    playerId,
    batting: {
      runs: battingRuns,
      balls: battingBalls,
      fours,
      sixes,
      strikeRate: battingBalls > 0 ? Number(((battingRuns / battingBalls) * 100).toFixed(2)) : 0,
    },
    bowling: {
      balls: bowlingBalls,
      runs: bowlingRuns,
      wickets: bowlingWickets,
      economy: overs > 0 ? Number((bowlingRuns / overs).toFixed(2)) : 0,
    },
    fielding: { catches, stumpings, runOuts },
  };
}

export interface CameraClockSample {
  clientSentAtMs: number;
  serverReceivedAtMs: number;
  serverSentAtMs: number;
  clientReceivedAtMs: number;
}

export function estimateCameraClockOffset(samples: CameraClockSample[]): {
  offsetMs: number;
  roundTripMs: number;
  confidence: "high" | "medium" | "low";
} {
  if (samples.length === 0) return { offsetMs: 0, roundTripMs: 0, confidence: "low" };
  const ranked = samples
    .map((sample) => {
      const roundTripMs =
        sample.clientReceivedAtMs -
        sample.clientSentAtMs -
        (sample.serverSentAtMs - sample.serverReceivedAtMs);
      const offsetMs =
        (sample.serverReceivedAtMs -
          sample.clientSentAtMs +
          sample.serverSentAtMs -
          sample.clientReceivedAtMs) /
        2;
      return { roundTripMs, offsetMs };
    })
    .sort((a, b) => a.roundTripMs - b.roundTripMs);
  const best = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 3)));
  const offsetMs = Math.round(best.reduce((sum, sample) => sum + sample.offsetMs, 0) / best.length);
  const roundTripMs = Math.round(
    best.reduce((sum, sample) => sum + sample.roundTripMs, 0) / best.length,
  );
  return {
    offsetMs,
    roundTripMs,
    confidence: roundTripMs <= 120 ? "high" : roundTripMs <= 350 ? "medium" : "low",
  };
}

export interface MediaSafeguardingDecision {
  canRecord: boolean;
  canPublish: boolean;
  blurRequired: boolean;
  retentionDays: number;
  reasons: string[];
}

export function decideMediaSafeguarding(input: {
  includesJunior: boolean;
  recordingConsent: "granted" | "pending" | "denied";
  publicationConsent: "granted" | "pending" | "denied";
  clubRetentionDays: number;
  publicAudience: boolean;
  blurRequested: boolean;
}): MediaSafeguardingDecision {
  const reasons: string[] = [];
  const canRecord = input.recordingConsent === "granted";
  const canPublish =
    canRecord &&
    input.publicationConsent === "granted" &&
    (!input.includesJunior || input.publicAudience);
  const blurRequired =
    input.blurRequested ||
    (input.includesJunior && input.publicAudience && input.publicationConsent !== "granted");

  if (!canRecord) reasons.push("Recording consent has not been granted.");
  if (input.publicAudience && input.publicationConsent !== "granted")
    reasons.push("Publication consent has not been granted.");
  if (input.includesJunior && input.publicAudience)
    reasons.push("Junior media requires safeguarding review before public release.");

  return {
    canRecord,
    canPublish: canPublish && !blurRequired,
    blurRequired,
    retentionDays: Math.max(1, Math.min(input.clubRetentionDays, input.includesJunior ? 90 : 365)),
    reasons,
  };
}

export class RainRuleConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RainRuleConfigurationError";
  }
}

export function requireLicensedRainRule(
  rules: CompetitionRules,
): NonNullable<CompetitionRules["rainRule"]> {
  if (!rules.rainRule?.provider || !rules.rainRule.method || !rules.rainRule.edition) {
    throw new RainRuleConfigurationError(
      "This competition has no authorised, versioned rain-rule provider configured.",
    );
  }
  return rules.rainRule;
}
