import {
  currentInnings,
  inningsOversLimit,
  inningsTarget,
  summarizeInnings,
  type CricketMatch,
} from "./cricket.ts";
import { predictWin, type Prediction } from "./win-predictor.ts";

export interface WinPoint {
  /** e.g. "1st 5.0" */
  label: string;
  /** Chance that the first team in `match.teams` wins. */
  firstTeamWin: number;
}

function stateFor(match: CricketMatch, inningsIndex: number, deliveriesCount: number) {
  const innings = match.innings[inningsIndex]!;
  const balls = innings.deliveries.slice(0, deliveriesCount);
  const summary = summarizeInnings({ ...innings, deliveries: balls }, match.settings.ballsPerOver);
  const battingTeam = match.teams.find((team) => team.id === innings.battingTeamId);
  const target = inningsIndex === 1 ? inningsTarget(match, 1) : null;
  return {
    innings,
    prediction: predictWin({
      oversPerInnings: inningsOversLimit(match, innings),
      inningsPerSide: match.settings.inningsPerSide,
      ballsPerOver: match.settings.ballsPerOver,
      inningsNumber: inningsIndex + 1,
      runs: summary.runs,
      wickets: summary.wickets,
      legalBalls: summary.legalBalls,
      target,
      maxWickets: Math.min(10, Math.max(1, (battingTeam?.players.length ?? 11) - 1)),
      battingIsHome: innings.battingTeamId === match.teams[0].id,
      conditions: match.conditions,
    }),
  };
}

/** Current prediction for the live innings, from the batting side's point of view. */
export function currentPrediction(match: CricketMatch): Prediction | null {
  // A decided match (including a rain result) has no "chance" left to estimate.
  if (match.status === "completed") return null;
  const index = match.innings.length - 1;
  return stateFor(match, index, currentInnings(match).deliveries.length).prediction;
}

/** One point per completed over (plus the latest ball) across both innings, for the win "worm". */
export function winTimeline(match: CricketMatch): WinPoint[] {
  const points: WinPoint[] = [];
  const bpo = match.settings.ballsPerOver;
  match.innings.slice(0, 2).forEach((innings, inningsIndex) => {
    const push = (count: number, label: string) => {
      const { prediction } = stateFor(match, inningsIndex, count);
      if (!prediction) return;
      const firstBatting = innings.battingTeamId === match.teams[0].id;
      points.push({
        label,
        firstTeamWin: firstBatting ? prediction.battingWin : prediction.bowlingWin,
      });
    };
    const tag = inningsIndex === 0 ? "1st" : "2nd";
    push(0, `${tag} 0.0`);
    let legal = 0;
    innings.deliveries.forEach((ball, index) => {
      if (ball.legal) legal += 1;
      const last = index === innings.deliveries.length - 1;
      if ((ball.legal && legal % bpo === 0) || last) {
        push(index + 1, `${tag} ${Math.floor(legal / bpo)}.${legal % bpo}`);
      }
    });
  });
  return points;
}
