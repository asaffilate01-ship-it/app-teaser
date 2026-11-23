import { battingCard, findPlayer, summarizeInnings, type CricketMatch, type Innings } from "./cricket.ts";

export interface FallOfWicket {
  wicket: number;
  score: number;
  batter: string;
  over: string;
}

/** Score and over at each wicket, in order. */
export function fallOfWickets(match: CricketMatch, innings: Innings): FallOfWicket[] {
  const result: FallOfWicket[] = [];
  let runs = 0;
  let legal = 0;
  for (const ball of innings.deliveries) {
    runs += ball.batterRuns + ball.extras.wide + ball.extras.noBall + ball.extras.bye + ball.extras.legBye + ball.extras.penalty;
    if (ball.legal) legal += 1;
    if (ball.dismissal) {
      result.push({
        wicket: result.length + 1,
        score: runs,
        batter: findPlayer(match, ball.dismissal.batterId)?.name ?? "Batter",
        over: `${Math.floor(legal / match.settings.ballsPerOver)}.${legal % match.settings.ballsPerOver}`,
      });
    }
  }
  return result;
}

/** Batters who have faced a ball, been dismissed or are at the crease, in batting order; plus who is yet to bat. */
export function battingSplit(match: CricketMatch, innings: Innings) {
  const rows = battingCard(match, innings);
  const order: string[] = [];
  for (const ball of innings.deliveries) {
    for (const id of [ball.strikerId, ball.nonStrikerId]) if (id && !order.includes(id)) order.push(id);
  }
  // Timed-out batters never faced a ball but still went in.
  for (const item of innings.retirements ?? []) if (!order.includes(item.batterId)) order.push(item.batterId);
  const live = innings.status === "live";
  for (const id of live ? [innings.strikerId, innings.nonStrikerId] : []) if (id && !order.includes(id)) order.push(id);
  const batted = order
    .map((id) => rows.find((row) => row.playerId === id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({
      ...row,
      atCrease: live && row.dismissal === "not out" && (row.playerId === innings.strikerId || row.playerId === innings.nonStrikerId),
      onStrike: live && row.playerId === innings.strikerId,
    }));
  const yetToBat = rows.filter((row) => !order.includes(row.playerId)).map((row) => row.name);
  return { batted, yetToBat };
}

export function inningsHeadline(match: CricketMatch, innings: Innings) {
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  return { ...summary, label: `${summary.runs}/${summary.wickets}` };
}
