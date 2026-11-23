import type { CricketMatch } from "./cricket.ts";
import { commentaryFeed } from "./commentary.ts";
import {
  battingCard,
  bowlingCard,
  currentInnings,
  findPlayer,
  findTeam,
  isSuperOver,
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
    },
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
