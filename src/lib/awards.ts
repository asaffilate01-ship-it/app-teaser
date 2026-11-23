/** Match and tournament awards, worked out from the scored balls. Organisers can override any winner and add a prize. */
import { battingCard, bowlingCard, isSuperOver, type CricketMatch } from "./cricket.ts";
import { matchImpacts, playerOfTheMatch } from "./player-profile.ts";
import { seasonStats } from "./season-stats.ts";

export type MatchAwardCategory = "player-of-match" | "best-batter" | "best-bowler" | "best-fielder";
export type TournamentAwardCategory =
  | "player-of-tournament"
  | "top-run-scorer"
  | "top-wicket-taker"
  | "best-fielder"
  | "best-figures"
  | "highest-score"
  | "most-sixes"
  | "best-economy"
  | "best-strike-rate"
  | "most-potm";

export interface AwardWinner<C extends string = string> {
  category: C;
  label: string;
  playerId: string;
  name: string;
  team: string;
  /** Short reason, e.g. "412 runs" or "5/23". */
  value: string;
}

export const MATCH_AWARD_LABELS: Record<MatchAwardCategory, string> = {
  "player-of-match": "Player of the Match",
  "best-batter": "Best batter",
  "best-bowler": "Best bowler",
  "best-fielder": "Best fielder",
};

export const TOURNAMENT_AWARD_LABELS: Record<TournamentAwardCategory, string> = {
  "player-of-tournament": "Player of the Tournament",
  "top-run-scorer": "Top run scorer",
  "top-wicket-taker": "Top wicket taker",
  "best-fielder": "Best fielder",
  "best-figures": "Best bowling figures",
  "highest-score": "Highest score",
  "most-sixes": "Most sixes",
  "best-economy": "Best economy",
  "best-strike-rate": "Best strike rate",
  "most-potm": "Most Player of the Match awards",
};

const teamOf = (match: CricketMatch, playerId: string) => match.teams.find((team) => team.players.some((player) => player.id === playerId));

/** The four match awards. Empty until there is something to award; Player of the Match waits for a result. */
export function matchAwards(match: CricketMatch): AwardWinner<MatchAwardCategory>[] {
  const out: AwardWinner<MatchAwardCategory>[] = [];
  const potm = playerOfTheMatch(match);
  if (potm) {
    const bits = [potm.runs ? `${potm.runs} runs` : "", potm.wickets ? `${potm.wickets} wkts` : "", potm.dismissalsFielded ? `${potm.dismissalsFielded} fielding` : ""].filter(Boolean);
    out.push({ category: "player-of-match", label: MATCH_AWARD_LABELS["player-of-match"], playerId: potm.playerId, name: potm.name, team: teamOf(match, potm.playerId)?.name ?? "", value: bits.join(", ") });
  }
  const innings = match.innings.filter((item) => !isSuperOver(item));
  const bat = new Map<string, { runs: number; balls: number }>();
  const bowl = new Map<string, { wickets: number; runs: number }>();
  for (const inn of innings) {
    for (const row of battingCard(match, inn)) {
      if (!row.balls && !row.runs) continue;
      const entry = bat.get(row.playerId) ?? { runs: 0, balls: 0 };
      bat.set(row.playerId, { runs: entry.runs + row.runs, balls: entry.balls + row.balls });
    }
    for (const row of bowlingCard(match, inn)) {
      if (!row.balls) continue;
      const entry = bowl.get(row.playerId) ?? { wickets: 0, runs: 0 };
      bowl.set(row.playerId, { wickets: entry.wickets + row.wickets, runs: entry.runs + row.runs });
    }
  }
  const nameOf = (id: string) => teamOf(match, id)?.players.find((player) => player.id === id)?.name ?? "Player";
  const push = (category: MatchAwardCategory, playerId: string, value: string) =>
    out.push({ category, label: MATCH_AWARD_LABELS[category], playerId, name: nameOf(playerId), team: teamOf(match, playerId)?.name ?? "", value });

  const batter = [...bat.entries()].sort((a, b) => b[1].runs - a[1].runs || a[1].balls - b[1].balls)[0];
  if (batter && batter[1].runs > 0) push("best-batter", batter[0], `${batter[1].runs} (${batter[1].balls})`);
  const bowler = [...bowl.entries()].sort((a, b) => b[1].wickets - a[1].wickets || a[1].runs - b[1].runs)[0];
  if (bowler && bowler[1].wickets > 0) push("best-bowler", bowler[0], `${bowler[1].wickets}/${bowler[1].runs}`);
  const fielder = matchImpacts(match).filter((item) => item.dismissalsFielded > 0).sort((a, b) => b.dismissalsFielded - a.dismissalsFielded)[0];
  if (fielder) push("best-fielder", fielder.playerId, `${fielder.dismissalsFielded} dismissal${fielder.dismissalsFielded === 1 ? "" : "s"}`);
  return out;
}

export interface TournamentAwardOptions {
  /** Minimum balls bowled for best economy (default 60 = 10 six-ball overs). */
  minEconomyBalls?: number;
  /** Minimum balls faced for best strike rate (default 60). */
  minStrikeRateBalls?: number;
}

/** Season / tournament awards across finished and live match snapshots. */
export function tournamentAwards(matches: readonly CricketMatch[], options: TournamentAwardOptions = {}): AwardWinner<TournamentAwardCategory>[] {
  const stats = seasonStats(matches);
  const out: AwardWinner<TournamentAwardCategory>[] = [];
  const push = (category: TournamentAwardCategory, row: { playerId: string; name: string; team: string } | undefined, value: string) => {
    if (row) out.push({ category, label: TOURNAMENT_AWARD_LABELS[category], playerId: row.playerId, name: row.name, team: row.team, value });
  };

  const impact = new Map<string, { playerId: string; name: string; team: string; score: number; potm: number }>();
  for (const match of matches) {
    const star = playerOfTheMatch(match);
    for (const item of matchImpacts(match)) {
      const entry = impact.get(item.playerId) ?? { playerId: item.playerId, name: item.name, team: teamOf(match, item.playerId)?.name ?? "", score: 0, potm: 0 };
      entry.score += item.score;
      if (star?.playerId === item.playerId) entry.potm += 1;
      impact.set(item.playerId, entry);
    }
  }
  const impacts = [...impact.values()];
  const mvp = impacts.filter((item) => item.score > 0).sort((a, b) => b.score - a.score)[0];
  push("player-of-tournament", mvp, mvp ? `${mvp.score} impact points` : "");

  const runs = [...stats.batting].sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0];
  if (runs && runs.runs > 0) push("top-run-scorer", runs, `${runs.runs} run${runs.runs === 1 ? "" : "s"}${runs.average != null ? ` · avg ${runs.average.toFixed(1)}` : ""}`);
  const wickets = [...stats.bowling].sort((a, b) => b.wickets - a.wickets || (a.average ?? 999) - (b.average ?? 999))[0];
  if (wickets && wickets.wickets > 0) push("top-wicket-taker", wickets, `${wickets.wickets} wicket${wickets.wickets === 1 ? "" : "s"}${wickets.economy != null ? ` · econ ${wickets.economy.toFixed(2)}` : ""}`);
  const fielding = [...stats.fielding].map((row) => ({ ...row, total: row.catches + row.stumpings + row.runOuts })).sort((a, b) => b.total - a.total)[0];
  if (fielding && fielding.total > 0) push("best-fielder", fielding, `${fielding.catches} ct · ${fielding.stumpings} st · ${fielding.runOuts} ro`);
  const figures = stats.bowling.filter((row) => row.best && row.best.wickets > 0).sort((a, b) => b.best!.wickets - a.best!.wickets || a.best!.runs - b.best!.runs)[0];
  if (figures) push("best-figures", figures, `${figures.best!.wickets}/${figures.best!.runs}`);
  const high = [...stats.batting].sort((a, b) => b.highScore - a.highScore || Number(b.highScoreNotOut) - Number(a.highScoreNotOut))[0];
  if (high && high.highScore > 0) push("highest-score", high, `${high.highScore}${high.highScoreNotOut ? "*" : ""}`);
  const sixes = [...stats.batting].sort((a, b) => b.sixes - a.sixes)[0];
  if (sixes && sixes.sixes > 0) push("most-sixes", sixes, `${sixes.sixes} sixes`);
  const minEcon = options.minEconomyBalls ?? 60;
  const econ = stats.bowling.filter((row) => row.balls >= minEcon && row.economy != null).sort((a, b) => a.economy! - b.economy!)[0];
  if (econ) push("best-economy", econ, `${econ.economy!.toFixed(2)} an over (${econ.overs} ov)`);
  const minSr = options.minStrikeRateBalls ?? 60;
  const sr = stats.batting.filter((row) => row.balls >= minSr).sort((a, b) => b.strikeRate - a.strikeRate)[0];
  if (sr) push("best-strike-rate", sr, `${sr.strikeRate.toFixed(1)} (${sr.runs} off ${sr.balls})`);
  const potm = impacts.filter((item) => item.potm > 0).sort((a, b) => b.potm - a.potm || b.score - a.score)[0];
  if (potm) push("most-potm", potm, `${potm.potm} award${potm.potm === 1 ? "" : "s"}`);
  return out;
}

export interface AwardSetting {
  category: string;
  prize: string | null;
  /** Organiser's chosen winner, replacing the automatic one. */
  winnerPlayerId: string | null;
  winnerName: string | null;
}

export interface AwardRow {
  category: TournamentAwardCategory;
  label: string;
  automatic: AwardWinner<TournamentAwardCategory> | null;
  winner: { playerId: string; name: string; team: string; value: string; chosen: boolean } | null;
  prize: string | null;
}

/** Every tournament award category with its automatic winner, any organiser override and the prize. */
export function awardBoard(automatic: AwardWinner<TournamentAwardCategory>[], settings: readonly AwardSetting[]): AwardRow[] {
  return (Object.keys(TOURNAMENT_AWARD_LABELS) as TournamentAwardCategory[]).map((category) => {
    const auto = automatic.find((item) => item.category === category) ?? null;
    const setting = settings.find((item) => item.category === category);
    const chosen = setting?.winnerPlayerId && setting.winnerName
      ? { playerId: setting.winnerPlayerId, name: setting.winnerName, team: "", value: "Chosen by organiser", chosen: true }
      : null;
    return {
      category,
      label: TOURNAMENT_AWARD_LABELS[category],
      automatic: auto,
      winner: chosen ?? (auto ? { playerId: auto.playerId, name: auto.name, team: auto.team, value: auto.value, chosen: false } : null),
      prize: setting?.prize?.trim() || null,
    };
  });
}
