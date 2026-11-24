/** Ready-to-paste social posts for results and match days. Uses the shared scorecard sheet, so the
 *  "initials only" option for junior matches applies here too. */
import type { ScorecardSheet } from "./scorecard-share.ts";

const tag = (text: string) =>
  text
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

export function hashtags(home: string, away: string): string {
  const pair = `#${tag(home)}v${tag(away)}`;
  return [pair, "#Cricket", "#CricLume"].join(" ");
}

export interface TopPerformers {
  batter: { name: string; runs: number; balls: number; notOut: boolean } | null;
  bowler: { name: string; wickets: number; runs: number } | null;
}

/** Best innings (most runs, then fewest balls) and best bowling (most wickets, then fewest runs) of the match. */
export function topPerformers(sheet: ScorecardSheet): TopPerformers {
  const bats = sheet.innings
    .flatMap((inn) => inn.batting)
    .filter((row) => row.balls > 0 || row.runs > 0);
  const bowls = sheet.innings.flatMap((inn) => inn.bowling).filter((row) => row.wickets > 0);
  const bat = [...bats].sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0];
  const bowl = [...bowls].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
  return {
    batter: bat
      ? { name: bat.name, runs: bat.runs, balls: bat.balls, notOut: bat.howOut === "not out" }
      : null,
    bowler: bowl ? { name: bowl.name, wickets: bowl.wickets, runs: bowl.runs } : null,
  };
}

export function resultPost(sheet: ScorecardSheet, teams: [string, string], link?: string): string {
  const top = topPerformers(sheet);
  const lines = [`🏏 ${sheet.result ? "RESULT" : "SCORE UPDATE"} | ${teams[0]} v ${teams[1]}`, ""];
  for (const inn of sheet.innings) lines.push(`${inn.team} ${inn.total} (${inn.overs} ov)`);
  if (sheet.result) lines.push("", `✅ ${sheet.result}`);
  if (top.batter || top.bowler) lines.push("");
  if (top.batter)
    lines.push(
      `⭐ Top bat: ${top.batter.name} ${top.batter.runs}${top.batter.notOut ? "*" : ""} (${top.batter.balls})`,
    );
  if (top.bowler)
    lines.push(`🎯 Top bowl: ${top.bowler.name} ${top.bowler.wickets}/${top.bowler.runs}`);
  if (link) lines.push("", `Full scorecard: ${link}`);
  lines.push("", hashtags(teams[0], teams[1]));
  return lines.join("\n");
}

export interface FixturePostInput {
  home: string;
  away: string;
  startsAt: string | null;
  ground: string | null;
  competition: string | null;
  round: string | null;
  link?: string | undefined;
  timeZone?: string | undefined;
  locale?: string | undefined;
}

export function fixtureWhen(
  input: Pick<FixturePostInput, "startsAt" | "timeZone" | "locale">,
): string | null {
  if (!input.startsAt || !Number.isFinite(Date.parse(input.startsAt))) return null;
  return new Intl.DateTimeFormat(input.locale ?? "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
  }).format(new Date(input.startsAt));
}

export function fixturePost(input: FixturePostInput): string {
  const when = fixtureWhen(input);
  const lines = [`📅 MATCH DAY | ${input.home} v ${input.away}`];
  if (input.competition || input.round)
    lines.push([input.competition, input.round].filter(Boolean).join(" · "));
  lines.push("");
  if (when) lines.push(`🕐 ${when}`);
  if (input.ground) lines.push(`📍 ${input.ground}`);
  lines.push(input.link ? `🔴 Follow live: ${input.link}` : "Come along and support!");
  lines.push("", hashtags(input.home, input.away));
  return lines.join("\n");
}
