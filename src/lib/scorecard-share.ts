import { bowlingCard, findTeam, isSuperOver, matchResult, type CricketMatch } from "./cricket.ts";
import { battingSplit, fallOfWickets, inningsHeadline } from "./scorecard.ts";

export interface SheetInnings {
  title: string;
  team: string;
  total: string;
  overs: string;
  runRate: string;
  batting: {
    name: string;
    howOut: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: string;
  }[];
  extras: string;
  extrasTotal: number;
  bowling: {
    name: string;
    overs: string;
    maidens: number;
    runs: number;
    wickets: number;
    economy: string;
  }[];
  fallOfWickets: string;
}

export interface ScorecardSheet {
  title: string;
  subtitle: string;
  result: string | null;
  innings: SheetInnings[];
}

/** "Ayaan Khan" → "A. K." — for sharing junior scorecards without full names. */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}.`)
    .join(" ") || "Player";

/**
 * Everything a shared scorecard (image, PDF or text) shows. With `initials`, every player name
 * (batters, bowlers, fielders inside dismissals) is reduced to initials.
 */
export function scorecardSheet(
  match: CricketMatch,
  options: { initials?: boolean } = {},
): ScorecardSheet {
  const players = match.teams.flatMap((team) => team.players);
  const hide = (text: string) => {
    if (!options.initials) return text;
    let out = text;
    // Longest names first so "Sam Lee" is replaced before "Sam".
    for (const player of [...players].sort((a, b) => b.name.length - a.name.length)) {
      if (player.name) out = out.split(player.name).join(initialsOf(player.name));
    }
    return out;
  };
  const bpo = match.settings.ballsPerOver;
  const regularCount = match.innings.filter((item) => !isSuperOver(item)).length;
  const innings = match.innings.map((item, index) => {
    const head = inningsHeadline(match, item);
    const { batted } = battingSplit(match, item);
    const team = findTeam(match, item.battingTeamId).name;
    const superIndex = match.innings.slice(0, index + 1).filter(isSuperOver).length;
    const title = isSuperOver(item)
      ? `Super Over${superIndex > 2 ? ` ${Math.ceil(superIndex / 2)}` : ""}`
      : regularCount > 2
        ? `Innings ${item.number}${item.followOn ? " (follow-on)" : ""}`
        : `${index === 0 ? "1st" : "2nd"} innings`;
    return {
      title,
      team,
      total: `${head.label}${item.declared ? " dec" : ""}`,
      overs: head.overs,
      runRate: head.runRate.toFixed(2),
      batting: batted.map((row) => ({
        name: hide(row.name),
        howOut: hide(row.atCrease ? "not out" : row.dismissal),
        runs: row.runs,
        balls: row.balls,
        fours: row.fours,
        sixes: row.sixes,
        strikeRate: row.balls ? row.strikeRate.toFixed(1) : "–",
      })),
      extras: `${head.extras.wide}w ${head.extras.noBall}nb ${head.extras.bye}b ${head.extras.legBye}lb${head.extras.penalty ? ` ${head.extras.penalty}p` : ""}`,
      extrasTotal: head.extras.total,
      bowling: bowlingCard(match, item).map((row) => ({
        name: hide(row.name),
        overs: row.overs,
        maidens: row.maidens,
        runs: row.runs,
        wickets: row.wickets,
        economy: row.balls ? ((row.runs * bpo) / row.balls).toFixed(2) : "–",
      })),
      fallOfWickets: fallOfWickets(match, item)
        .map((fow) => `${fow.score}-${fow.wicket} (${hide(fow.batter)}, ${fow.over})`)
        .join(", "),
    };
  });
  const date = new Date(match.settings.startTime);
  const when = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return {
    title: `${match.teams[0].name} v ${match.teams[1].name}`,
    subtitle: [match.settings.format, match.settings.ground, when].filter(Boolean).join(" · "),
    result: matchResult(match)?.text ?? null,
    innings,
  };
}

/** Plain text for WhatsApp, email or a club group chat. */
export function scorecardText(sheet: ScorecardSheet): string {
  const lines = [sheet.title, sheet.subtitle];
  if (sheet.result) lines.push(sheet.result);
  for (const inn of sheet.innings) {
    lines.push("", `${inn.team} ${inn.total} (${inn.overs} ov) · ${inn.title}`);
    const bats = [...inn.batting].sort((a, b) => b.runs - a.runs).slice(0, 3);
    if (bats.length)
      lines.push(
        `Bat: ${bats.map((row) => `${row.name} ${row.runs}${row.howOut === "not out" ? "*" : ""} (${row.balls})`).join(", ")}`,
      );
    const bowls = [...inn.bowling]
      .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
      .slice(0, 3);
    if (bowls.length)
      lines.push(
        `Bowl: ${bowls.map((row) => `${row.name} ${row.wickets}/${row.runs} (${row.overs})`).join(", ")}`,
      );
  }
  lines.push("", "Scored with CricLume · criclume.com");
  return lines.join("\n");
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );

/** A complete, print-ready HTML document; the browser's "Save as PDF" turns it into a PDF. */
export function scorecardHtml(sheet: ScorecardSheet): string {
  const e = escapeHtml;
  const innings = sheet.innings
    .map(
      (inn) => `
  <section>
    <h2>${e(inn.team)} <span>${e(inn.total)} (${e(inn.overs)} ov, RR ${e(inn.runRate)})</span></h2>
    <p class="kicker">${e(inn.title)}</p>
    <table>
      <thead><tr><th class="l">Batter</th><th class="l">How out</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
      <tbody>${inn.batting
        .map(
          (row) =>
            `<tr><td class="l"><b>${e(row.name)}</b></td><td class="l">${e(row.howOut)}</td><td><b>${row.runs}</b></td><td>${row.balls}</td><td>${row.fours}</td><td>${row.sixes}</td><td>${e(row.strikeRate)}</td></tr>`,
        )
        .join("")}
      <tr class="sub"><td class="l">Extras</td><td class="l">${e(inn.extras)}</td><td>${inn.extrasTotal}</td><td colspan="4"></td></tr>
      <tr class="sub"><td class="l"><b>Total</b></td><td class="l">${e(inn.overs)} overs</td><td><b>${e(inn.total)}</b></td><td colspan="4"></td></tr>
      </tbody>
    </table>
    ${inn.fallOfWickets ? `<p class="fow"><b>Fall of wickets:</b> ${e(inn.fallOfWickets)}</p>` : ""}
    <table>
      <thead><tr><th class="l">Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
      <tbody>${inn.bowling
        .map(
          (row) =>
            `<tr><td class="l"><b>${e(row.name)}</b></td><td>${e(row.overs)}</td><td>${row.maidens}</td><td>${row.runs}</td><td><b>${row.wickets}</b></td><td>${e(row.economy)}</td></tr>`,
        )
        .join("")}</tbody>
    </table>
  </section>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${e(sheet.title)} scorecard</title>
<style>
  @page { margin: 14mm; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1b1d2a; margin: 0; }
  header { border-bottom: 3px solid #c9a227; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 22px; margin: 0; }
  .meta { color: #5b5f73; font-size: 12px; margin: 4px 0 0; }
  .result { font-weight: 700; font-size: 15px; margin: 8px 0 0; color: #7a1626; }
  section { break-inside: avoid; margin-bottom: 18px; }
  h2 { font-size: 16px; margin: 0; display: flex; justify-content: space-between; gap: 12px; }
  h2 span { font-weight: 600; }
  .kicker { margin: 2px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8a6d12; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 6px; }
  th, td { padding: 4px 6px; text-align: right; border-bottom: 1px solid #e4e5ec; }
  th { background: #f3f1ea; font-size: 11px; text-transform: uppercase; }
  .l { text-align: left; }
  tr.sub td { background: #fafafa; }
  .fow { font-size: 11px; color: #3c4054; margin: 4px 0 8px; }
  footer { margin-top: 10px; font-size: 10px; color: #8b8fa3; }
</style></head><body>
<header><h1>${e(sheet.title)}</h1><p class="meta">${e(sheet.subtitle)}</p>${sheet.result ? `<p class="result">${e(sheet.result)}</p>` : ""}</header>
${innings}
<footer>Scored with CricLume · criclume.com</footer>
</body></html>`;
}
