import type { MatchFormat } from "./cricket";

export type MatchSetupResult =
  | { ok: true; homeLineup: string[]; awayLineup: string[]; oversPerInnings: number | null }
  | { ok: false; error: string };

export type CloudSetupResult =
  | { ok: true; oversPerInnings: number }
  | { ok: false; error: string };

/**
 * Never coerce empty, fractional, negative, scientific-notation or non-finite
 * overs into an official match. Match formats with a limited number of overs
 * always require a valid integer; multi-day matches have no over limit.
 */
function parseOvers(value: string, allowUnlimited: boolean): number | null {
  const raw = value.trim();
  if (!raw && allowUnlimited) return null;
  if (!/^[0-9]+$/.test(raw)) return Number.NaN;
  const overs = Number(raw);
  return Number.isSafeInteger(overs) && overs >= 1 && overs <= 100 ? overs : Number.NaN;
}

function namesForTeam(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function rosterError(names: string[], label: string): string | null {
  if (names.length < 2) return `Add at least two players to the ${label} lineup.`;
  if (names.length > 11) return `The ${label} playing XI can have at most 11 players.`;
  if (names.some((name) => name.length > 100)) {
    return `Keep each player name in the ${label} lineup under 100 characters.`;
  }
  const unique = new Set(names.map((name) => name.normalize("NFKC").toLocaleLowerCase("en")));
  if (unique.size !== names.length) return `Remove duplicate names from the ${label} lineup.`;
  return null;
}

export function validateDeviceMatchSetup(input: {
  homeName: string;
  awayName: string;
  homePlayers: string;
  awayPlayers: string;
  overs: string;
  format: MatchFormat;
}): MatchSetupResult {
  const home = input.homeName.trim();
  const away = input.awayName.trim();
  if (home.length < 2 || away.length < 2 || home.length > 120 || away.length > 120) {
    return { ok: false, error: "Enter two team names between 2 and 120 characters." };
  }
  if (home.normalize("NFKC").toLocaleLowerCase("en") === away.normalize("NFKC").toLocaleLowerCase("en")) {
    return { ok: false, error: "Home and away teams must have different names." };
  }
  const homeLineup = namesForTeam(input.homePlayers);
  const awayLineup = namesForTeam(input.awayPlayers);
  const homeError = rosterError(homeLineup, "home team");
  if (homeError) return { ok: false, error: homeError };
  const awayError = rosterError(awayLineup, "away team");
  if (awayError) return { ok: false, error: awayError };
  const oversPerInnings = parseOvers(input.overs, input.format === "Multi-day");
  if (oversPerInnings !== null && !Number.isFinite(oversPerInnings)) {
    return { ok: false, error: "Enter a whole number of overs between 1 and 100." };
  }
  return { ok: true, homeLineup, awayLineup, oversPerInnings };
}

export function validateCloudMatchSetup(input: {
  homeTeamId: string;
  awayTeamId: string;
  battingFirstTeamId: string;
  overs: string;
  teams: readonly { id: string; playerIds: readonly string[] }[];
}): CloudSetupResult {
  const home = input.teams.find((team) => team.id === input.homeTeamId);
  const away = input.teams.find((team) => team.id === input.awayTeamId);
  if (!home || !away || home.id === away.id) {
    return { ok: false, error: "Select two different registered teams." };
  }
  if (![home.id, away.id].includes(input.battingFirstTeamId)) {
    return { ok: false, error: "Choose which of the selected teams bats first." };
  }
  for (const team of [home, away]) {
    if (new Set(team.playerIds).size < 2) {
      return { ok: false, error: "Each team needs at least two registered players before scoring." };
    }
  }
  const oversPerInnings = parseOvers(input.overs, false);
  if (oversPerInnings === null || !Number.isFinite(oversPerInnings)) {
    return { ok: false, error: "Enter a whole number of overs between 1 and 100." };
  }
  return { ok: true, oversPerInnings };
}
