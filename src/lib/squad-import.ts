/** Spreadsheet (CSV) import of teams and players — parsing and planning only; no network. */

export interface ImportPlan {
  newTeams: { name: string; shortName: string; ageGroup: string | null }[];
  players: { team: string; name: string; isJunior: boolean; publicProfile: boolean }[];
  skipped: { line: number; reason: string }[];
}

/** RFC 4180-style CSV: quoted fields, doubled quotes, commas/newlines inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === "," || char === ";" || char === "\t") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((cells) => cells.map((cell) => cell.trim())).filter((cells) => cells.some(Boolean));
}

const yes = new Set(["y", "yes", "true", "1", "x", "ja", "oui"]);
const no = new Set(["", "n", "no", "false", "0", "nee", "nein", "non"]);
const columnNames: Record<string, string[]> = {
  team: ["team", "team name", "side", "squad"],
  player: ["player", "player name", "name", "full name"],
  junior: ["junior", "is junior", "u18", "under 18"],
  public: ["public", "public profile", "show publicly"],
  short: ["short", "short name", "abbreviation", "code"],
  age: ["age group", "age", "group"],
};

function shortNameFor(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? words.map((word) => word[0]).join("") : name.slice(0, 3);
  return initials.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "TEAM";
}

/**
 * Builds what an import would create. Existing teams are matched by name (any case); a player already on that
 * team, or listed twice, is skipped so re-importing the same sheet is harmless. Unknown junior/public values are
 * rejected rather than guessed, and both default to "no" when the column is absent or blank.
 */
export function planSquadImport(
  csv: string,
  existing: { teams: readonly { id: string; name: string }[]; players: readonly { name: string; teamIds: readonly string[] }[] },
  maxPlayers = 500,
): ImportPlan {
  const rows = parseCsv(csv);
  const plan: ImportPlan = { newTeams: [], players: [], skipped: [] };
  if (rows.length === 0) return plan;
  const header = rows[0]!.map((cell) => cell.toLowerCase());
  const index = (key: string) => header.findIndex((cell) => columnNames[key]!.includes(cell));
  const col = { team: index("team"), player: index("player"), junior: index("junior"), public: index("public"), short: index("short"), age: index("age") };
  if (col.team < 0 || col.player < 0) {
    plan.skipped.push({ line: 1, reason: "Header row needs “Team” and “Player” columns" });
    return plan;
  }
  const teamByName = new Map(existing.teams.map((team) => [team.name.trim().toLowerCase(), team.id]));
  const onTeam = new Set(existing.players.flatMap((player) => player.teamIds.map((teamId) => `${teamId}|${player.name.trim().toLowerCase()}`)));
  const seen = new Set<string>();
  const newTeams = new Map<string, ImportPlan["newTeams"][number]>();

  rows.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const team = (cells[col.team] ?? "").replace(/\s+/g, " ");
    const name = (cells[col.player] ?? "").replace(/\s+/g, " ");
    if (!team || !name) return plan.skipped.push({ line, reason: "Missing team or player name" });
    if (team.length > 80 || name.length > 80) return plan.skipped.push({ line, reason: "Name longer than 80 characters" });
    const flag = (position: number) => {
      if (position < 0) return false;
      const value = (cells[position] ?? "").toLowerCase();
      if (yes.has(value)) return true;
      if (no.has(value)) return false;
      return null;
    };
    const isJunior = flag(col.junior);
    const publicProfile = flag(col.public);
    if (isJunior === null || publicProfile === null) return plan.skipped.push({ line, reason: "Junior/Public must be yes or no" });
    const teamKey = team.toLowerCase();
    const playerKey = `${teamKey}|${name.toLowerCase()}`;
    const existingTeamId = teamByName.get(teamKey);
    if (seen.has(playerKey) || (existingTeamId && onTeam.has(`${existingTeamId}|${name.toLowerCase()}`))) {
      return plan.skipped.push({ line, reason: `${name} is already on ${team}` });
    }
    if (plan.players.length >= maxPlayers) return plan.skipped.push({ line, reason: `Only ${maxPlayers} players per import` });
    seen.add(playerKey);
    if (!existingTeamId && !newTeams.has(teamKey)) {
      newTeams.set(teamKey, {
        name: team,
        shortName: (col.short >= 0 && cells[col.short]) || shortNameFor(team),
        ageGroup: (col.age >= 0 && cells[col.age]) || null,
      });
    }
    plan.players.push({ team, name, isJunior, publicProfile: isJunior ? false : publicProfile });
    return undefined;
  });
  plan.newTeams = [...newTeams.values()];
  return plan;
}

export const SQUAD_TEMPLATE_CSV = "Team,Player,Junior,Public\nFirst XI,Sam Patel,no,yes\nUnder 13s,Alex Khan,yes,no\n";
