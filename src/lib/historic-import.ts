/** Import season figures from an old scorecard spreadsheet (Play-Cricket, CricHeroes or hand-made). */
export interface HistoricRow {
  playerId: string;
  name: string;
  season: string;
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  ballsFaced: number;
  highScore: number | null;
  fours: number;
  sixes: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  catches: number;
  stumpings: number;
}

const aliases: Record<string, keyof HistoricRow | "overs"> = {
  name: "name", player: "name", "player name": "name",
  season: "season", year: "season",
  matches: "matches", m: "matches", mat: "matches",
  innings: "innings", inns: "innings", inn: "innings", i: "innings",
  "not outs": "notOuts", "not out": "notOuts", no: "notOuts",
  runs: "runs", "runs scored": "runs", "bat runs": "runs",
  balls: "ballsFaced", "balls faced": "ballsFaced", bf: "ballsFaced",
  hs: "highScore", "high score": "highScore", highest: "highScore",
  "4s": "fours", fours: "fours", "6s": "sixes", sixes: "sixes",
  overs: "overs", o: "overs", "overs bowled": "overs",
  "balls bowled": "ballsBowled",
  "runs conceded": "runsConceded", conceded: "runsConceded", "bowl runs": "runsConceded", r: "runsConceded",
  wickets: "wickets", wkts: "wickets", w: "wickets",
  catches: "catches", ct: "catches", c: "catches",
  stumpings: "stumpings", st: "stumpings",
};

/** Split one CSV line, honouring quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";" || ch === "\t") { out.push(cell.trim()); cell = ""; }
    else cell += ch;
  }
  out.push(cell.trim());
  return out;
}

/** "12.3" overs → 75 balls (6-ball overs). */
export function oversToBalls(value: string, ballsPerOver = 6): number {
  const [whole, part] = value.trim().split(".");
  const overs = Number(whole) || 0;
  const balls = Math.min(Number(part) || 0, ballsPerOver - 1);
  return Math.max(0, overs * ballsPerOver + balls);
}

const normalise = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function parseHistoricCsv(
  text: string,
  players: readonly { id: string; name: string }[],
  defaultSeason = "",
): { rows: HistoricRow[]; unknownNames: string[]; error: string | null } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], unknownNames: [], error: "Add a header row and at least one player." };
  if (lines.length > 1001) return { rows: [], unknownNames: [], error: "Import up to 1,000 rows at a time." };
  const header = splitCsvLine(lines[0]!).map((cell) => aliases[cell.toLowerCase().trim()] ?? null);
  if (!header.includes("name")) return { rows: [], unknownNames: [], error: "The first row needs a Name (or Player) column." };
  const byName = new Map(players.map((p) => [normalise(p.name), p]));
  const rows: HistoricRow[] = [];
  const unknown = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const get = (key: string) => cells[header.indexOf(key as never)] ?? "";
    const num = (key: string) => {
      const raw = get(key).replace(/\*$/, "");
      const value = Math.round(Number(raw));
      return Number.isFinite(value) && value >= 0 ? value : 0;
    };
    const name = get("name");
    if (!name) continue;
    const player = byName.get(normalise(name));
    if (!player) { unknown.add(name); continue; }
    const season = (get("season") || defaultSeason).slice(0, 40);
    if (season.trim().length < 2) return { rows: [], unknownNames: [], error: "Add a Season column or choose the season to import into." };
    const hs = get("highScore").replace(/\*$/, "");
    rows.push({
      playerId: player.id,
      name: player.name,
      season,
      matches: num("matches"),
      innings: num("innings"),
      notOuts: num("notOuts"),
      runs: num("runs"),
      ballsFaced: num("ballsFaced"),
      highScore: hs && Number.isFinite(Number(hs)) ? Math.round(Number(hs)) : null,
      fours: num("fours"),
      sixes: num("sixes"),
      ballsBowled: header.includes("ballsBowled") ? num("ballsBowled") : oversToBalls(get("overs") || "0"),
      runsConceded: num("runsConceded"),
      wickets: num("wickets"),
      catches: num("catches"),
      stumpings: num("stumpings"),
    });
  }
  return { rows, unknownNames: [...unknown], error: null };
}
