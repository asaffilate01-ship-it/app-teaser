/** Phone alerts worth sending after a ball: wickets, milestones, innings ends and results.
 *  Text is name-free (team names, batting positions and roles only) to keep junior players private. */
import { battingCard, bowlingCard, findTeam, isSuperOver, matchResult, summarizeInnings, type CricketMatch, type Innings } from "./cricket.ts";

export type AlertKind = "wickets" | "milestones" | "results";
export interface MatchAlert {
  kind: AlertKind;
  title: string;
  body: string;
}

const dismissalWords: Record<string, string> = {
  bowled: "Bowled",
  caught: "Caught",
  lbw: "LBW",
  stumped: "Stumped",
  "run-out": "Run out",
  "hit-wicket": "Hit wicket",
  "obstructing-the-field": "Obstructing the field",
};

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/** Batting position = order in which players first came to the crease. */
function battingPosition(innings: Innings, playerId: string): number {
  const order: string[] = [];
  for (const delivery of innings.deliveries) {
    for (const id of [delivery.strikerId, delivery.nonStrikerId]) if (!order.includes(id)) order.push(id);
  }
  return order.indexOf(playerId) + 1;
}

function score(match: CricketMatch, innings: Innings) {
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  return { text: `${findTeam(match, innings.battingTeamId).name} ${summary.runs}/${summary.wickets} (${summary.overs} ov)`, summary };
}

/** Alerts caused by moving from `prev` to `next`. Only a single newly recorded ball (or the match/innings
 *  ending) counts, so undoing or editing old balls never re-sends alerts. */
export function alertsBetween(prev: CricketMatch, next: CricketMatch): MatchAlert[] {
  const alerts: MatchAlert[] = [];
  const index = next.innings.length - 1;
  const innings = next.innings[index];
  const before = prev.innings[index];
  if (!innings) return alerts;
  const newBall = before && innings.id === before.id && innings.deliveries.length === before.deliveries.length + 1 ? innings.deliveries.at(-1)! : null;
  const now = score(next, innings);
  const label = isSuperOver(innings) ? "Super Over · " : "";

  if (newBall) {
    if (newBall.dismissal) {
      alerts.push({ kind: "wickets", title: `WICKET! ${now.text}`, body: `${label}${dismissalWords[newBall.dismissal.type] ?? "Out"} · ${ordinal(now.summary.wickets)} wicket down` });
    }
    const team = findTeam(next, innings.battingTeamId).name;
    const card = (match: CricketMatch, inn: Innings) => new Map(battingCard(match, inn).map((row) => [row.playerId, row.runs]));
    const runsBefore = card(prev, before!).get(newBall.strikerId) ?? 0;
    const runsAfter = card(next, innings).get(newBall.strikerId) ?? 0;
    for (const mark of [50, 100, 150, 200]) {
      if (runsBefore < mark && runsAfter >= mark) {
        const word = mark === 50 ? "FIFTY" : mark === 100 ? "HUNDRED" : `${mark}`;
        alerts.push({ kind: "milestones", title: `${word}! ${possessive(team)} No. ${battingPosition(innings, newBall.strikerId)} batter`, body: `${runsAfter} not out · ${now.text}` });
      }
    }
    const wicketsOf = (match: CricketMatch, inn: Innings) => bowlingCard(match, inn).find((row) => row.playerId === newBall.bowlerId)?.wickets ?? 0;
    if (wicketsOf(prev, before!) < 5 && wicketsOf(next, innings) >= 5) {
      alerts.push({ kind: "milestones", title: `FIVE-FOR! ${findTeam(next, innings.bowlingTeamId).name} bowler`, body: `5 wickets · ${now.text}` });
    }
  }

  if (next.status === "completed" && prev.status !== "completed") {
    const result = matchResult(next);
    alerts.push({ kind: "results", title: result?.text ?? "Match finished", body: next.innings.filter((item) => !isSuperOver(item)).map((item) => score(next, item).text).join(" · ") });
  } else if (next.status === "innings-break" && prev.status === "live" && innings.status === "completed") {
    alerts.push({ kind: "results", title: `Innings ended: ${now.text}`, body: innings.declared ? "Declared" : "Next innings coming up" });
  } else if (next.days?.atStumps && !prev.days?.atStumps) {
    alerts.push({ kind: "results", title: `Stumps, Day ${next.days.current}`, body: now.text });
  }
  return alerts.slice(0, 3);
}
