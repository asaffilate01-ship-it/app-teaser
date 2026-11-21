import type { CricketMatch } from "./cricket.ts";
import {
  battingCard,
  bowlingCard,
  currentInnings,
  findPlayer,
  findTeam,
  summarizeInnings,
  targetForCurrentInnings,
} from "./cricket.ts";

/**
 * Only aggregate totals and neutral player roles may be sent in public liveState.
 * Scoring models do not carry independently verified guardian/public-profile
 * consent, so publishing actual player names could expose junior details.
 * Server-side public scoreboard responses must also remove legacy names.
 */
export function publicLiveState(match: CricketMatch): Record<string, unknown> {
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
  return {
    battingTeamId: batting?.id,
    runs: summary.runs,
    wickets: summary.wickets,
    overs: summary.overs,
    target,
    striker: striker
      ? { name: "Striker", runs: strikerFigures?.runs ?? 0, balls: strikerFigures?.balls ?? 0 }
      : null,
    nonStriker: nonStriker
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
    message:
      match.status === "completed"
        ? "Match completed"
        : `${batting?.name ?? "Batting side"} innings in progress`,
  };
}
