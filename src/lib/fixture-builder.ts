export interface BuilderOptions {
  teamIds: readonly string[];
  /** Two legs: every pair meets twice, with home and away swapped. */
  doubleRoundRobin: boolean;
  /** First round date, "YYYY-MM-DD" (local). Empty leaves fixtures undated (draft). */
  firstDate: string;
  /** Start time, "HH:MM" (local). */
  startTime: string;
  daysBetweenRounds: number;
  /** Ground for every match, or "home" to use each home team's listed ground when it has one. */
  groundIds?: readonly string[];
}

export interface ProposedFixture {
  round: number;
  roundName: string;
  homeTeamId: string;
  awayTeamId: string;
  /** ISO timestamp, or null when no first date was given. */
  startsAt: string | null;
  groundId: string | null;
}

export interface BuilderResult {
  fixtures: ProposedFixture[];
  rounds: number;
  /** Team resting in each round when the number of teams is odd. */
  byes: { round: number; teamId: string }[];
}

/**
 * Round-robin fixtures by the circle method: every team plays every other team once per leg and never twice
 * in the same round. Venues are balanced so each team's home count differs from its away count by at most one.
 * Grounds, when given, rotate round by round so one ground is not used for every match of a round.
 */
export function buildRoundRobin(options: BuilderOptions): BuilderResult {
  const unique = [...new Set(options.teamIds)];
  if (unique.length < 2) return { fixtures: [], rounds: 0, byes: [] };
  const slots: (string | null)[] = unique.length % 2 === 0 ? [...unique] : [...unique, null];
  const n = slots.length;
  const legRounds = n - 1;
  const legs = options.doubleRoundRobin ? 2 : 1;
  const fixtures: ProposedFixture[] = [];
  const byes: BuilderResult["byes"] = [];
  const grounds = options.groundIds ?? [];
  const gap = Math.max(1, Math.min(60, Math.round(options.daysBetweenRounds || 7)));
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(options.firstDate);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(options.startTime) ?? ["", "11", "00"];

  const startFor = (roundIndex: number) => {
    if (!dateMatch) return null;
    const date = new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]) + roundIndex * gap,
      Number(timeMatch[1]),
      Number(timeMatch[2]),
    );
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  };

  let rotation = [...slots];
  const index = new Map(unique.map((id, i) => [id, i]));
  const cycle = unique.length % 2 === 1 ? unique.length : unique.length - 1;
  const firstLeg: { home: string; away: string }[][] = [];
  for (let round = 0; round < legRounds; round += 1) {
    const pairs: { home: string; away: string }[] = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = rotation[i]!;
      const b = rotation[n - 1 - i]!;
      if (a === null || b === null) {
        const resting = a ?? b;
        if (resting) byes.push({ round: round + 1, teamId: resting });
        continue;
      }
      // Venues: a cyclic rule over the first m teams (m odd) gives each exactly (m-1)/2 home games;
      // the extra team in an even-sized league alternates home and away by round.
      const ia = index.get(a)!;
      const ib = index.get(b)!;
      let aHosts: boolean;
      if (ia === cycle || ib === cycle) aHosts = (ia === cycle) === (round % 2 === 0);
      else {
        const distance = (ib - ia + cycle) % cycle;
        aHosts = distance >= 1 && distance <= (cycle - 1) / 2;
      }
      pairs.push(aHosts ? { home: a, away: b } : { home: b, away: a });
    }
    firstLeg.push(pairs);
    rotation = [rotation[0]!, rotation[n - 1]!, ...rotation.slice(1, n - 1)];
  }

  for (let leg = 0; leg < legs; leg += 1) {
    firstLeg.forEach((pairs, index) => {
      const roundIndex = leg * legRounds + index;
      if (leg === 1) {
        for (const bye of byes.filter((item) => item.round === index + 1)) {
          byes.push({ round: roundIndex + 1, teamId: bye.teamId });
        }
      }
      pairs.forEach((pair, matchIndex) => {
        const [home, away] = leg === 0 ? [pair.home, pair.away] : [pair.away, pair.home];
        fixtures.push({
          round: roundIndex + 1,
          roundName: `Round ${roundIndex + 1}`,
          homeTeamId: home,
          awayTeamId: away,
          startsAt: startFor(roundIndex),
          groundId: grounds.length ? grounds[(roundIndex + matchIndex) % grounds.length]! : null,
        });
      });
    });
  }
  return { fixtures, rounds: legRounds * legs, byes };
}
