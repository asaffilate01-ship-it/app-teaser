import {
  battingCard,
  bowlingCard,
  findPlayer,
  findTeam,
  summarizeInnings,
  type CricketMatch,
} from "./cricket.ts";

/** One CSV cell: quoted when needed; a leading = + - @ is neutralised so spreadsheets never run it as a formula. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const toCsv = (rows: readonly (readonly unknown[])[]) =>
  rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

/** Every ball of the match, one row each. */
export function ballByBallCsv(match: CricketMatch): string {
  const name = (id?: string) => (id ? (findPlayer(match, id)?.name ?? "") : "");
  const rows: unknown[][] = [
    [
      "Innings",
      "Batting team",
      "Over",
      "Ball",
      "Bowler",
      "Striker",
      "Non-striker",
      "Bat runs",
      "Wides",
      "No-balls",
      "Byes",
      "Leg byes",
      "Penalty",
      "Wicket",
      "Out batter",
      "Fielder",
      "Field position",
      "Bowling type",
      "Pitch length",
      "Speed km/h",
      "Time",
    ],
  ];
  for (const innings of match.innings) {
    const team = findTeam(match, innings.battingTeamId).name;
    for (const d of innings.deliveries) {
      rows.push([
        innings.number,
        team,
        d.over + 1,
        d.ball,
        name(d.bowlerId),
        name(d.strikerId),
        name(d.nonStrikerId),
        d.batterRuns,
        d.extras.wide,
        d.extras.noBall,
        d.extras.bye,
        d.extras.legBye,
        d.extras.penalty,
        d.dismissal?.type ?? "",
        name(d.dismissal?.batterId),
        name(d.dismissal?.fielderId ?? d.fielderId),
        d.fieldZone === "Not recorded" ? "" : d.fieldZone,
        d.deliveryStyle,
        d.pitch ? Math.round(d.pitch.y * 100) / 100 : "",
        d.speedKph ?? "",
        d.recordedAt,
      ]);
    }
  }
  return toCsv(rows);
}

/** Batting and bowling figures for every innings. */
export function scorecardCsv(match: CricketMatch): string {
  const rows: unknown[][] = [];
  for (const innings of match.innings) {
    const team = findTeam(match, innings.battingTeamId).name;
    const total = summarizeInnings(innings, match.settings.ballsPerOver);
    rows.push([
      `Innings ${innings.number}: ${team}`,
      `${total.runs}/${total.wickets}`,
      `${total.overs} overs`,
    ]);
    rows.push(["Batter", "How out", "Runs", "Balls", "4s", "6s", "Strike rate"]);
    for (const b of battingCard(match, innings).filter(
      (item) => item.balls > 0 || item.dismissal !== "not out",
    )) {
      rows.push([b.name, b.dismissal, b.runs, b.balls, b.fours, b.sixes, b.strikeRate]);
    }
    rows.push(["Bowler", "Overs", "Maidens", "Runs", "Wickets", "Economy"]);
    for (const b of bowlingCard(match, innings))
      rows.push([b.name, b.overs, b.maidens, b.runs, b.wickets, b.economy]);
    rows.push([]);
  }
  return toCsv(rows);
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[^\w.-]+/g, "-");
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
