/**
 * Live centre: the public page listing every published match, filtered by country, region and
 * competition, with in-page alerts (wickets, fours, sixes, rain delays, results) worked out by
 * comparing two snapshots of the name-free public feed.
 */

export type LiveAlertKind = "wicket" | "six" | "four" | "milestone" | "stoppage" | "innings" | "result" | "start";
export type LiveBucket = "live" | "results" | "upcoming";

export interface LiveTeam {
  id: string;
  name: string;
  shortName: string;
}

export interface LiveBall {
  label: string;
  kind?: string;
}

export interface LiveStateLite {
  battingTeamId?: string;
  battingIsHome?: boolean;
  runs?: number;
  wickets?: number;
  overs?: string;
  target?: number | null;
  inningsNumber?: number;
  settings?: { oversPerInnings?: number | null; inningsPerSide?: number; ballsPerOver?: number };
  oversLimit?: number | null;
  rain?: { method?: string; revisedOvers?: number | null; officialTarget?: number | null; abandoned?: boolean } | null;
  par?: number | null;
  stoppage?: { reason?: string; since?: string } | null;
  days?: { current?: number; atStumps?: boolean } | null;
  superOver?: boolean;
  declared?: boolean;
  result?: string | null;
  recent?: LiveBall[];
}

export interface LiveMatch {
  slug: string;
  matchId: string;
  status: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  homeTeam: LiveTeam;
  awayTeam: LiveTeam;
  ground?: string;
  competition?: { id: string; name: string; format?: string };
  organisation?: string;
  country?: string;
  region?: string;
  delayed?: boolean;
  liveState?: LiveStateLite;
}

export interface LiveEvent {
  /** Stable id so the same moment is never announced twice. */
  key: string;
  kind: LiveAlertKind;
  slug: string;
  title: string;
  body: string;
}

export const liveAlertKinds: ReadonlyArray<{ id: LiveAlertKind; label: string }> = [
  { id: "wicket", label: "Wickets" },
  { id: "six", label: "Sixes" },
  { id: "four", label: "Fours" },
  { id: "milestone", label: "Team 50s & 100s" },
  { id: "stoppage", label: "Rain & delays" },
  { id: "innings", label: "Innings & stumps" },
  { id: "result", label: "Results" },
  { id: "start", label: "Match starts" },
];

export function liveBucket(match: Pick<LiveMatch, "status">): LiveBucket {
  if (match.status === "live" || match.status === "innings_break") return "live";
  if (match.status === "completed") return "results";
  return "upcoming";
}

export interface LiveFilters {
  bucket: LiveBucket | "all";
  country?: string;
  region?: string;
  competition?: string;
  query?: string;
  following?: ReadonlySet<string> | null;
}

const clean = (value: string | undefined) => (value ?? "").trim().toLowerCase();

export function filterLiveMatches(matches: readonly LiveMatch[], filters: LiveFilters): LiveMatch[] {
  const query = clean(filters.query);
  return matches.filter((match) => {
    if (filters.bucket !== "all" && liveBucket(match) !== filters.bucket) return false;
    if (filters.country && match.country !== filters.country) return false;
    if (filters.region && clean(match.region) !== clean(filters.region)) return false;
    if (filters.competition && match.competition?.id !== filters.competition) return false;
    if (filters.following && !filters.following.has(match.slug)) return false;
    if (query) {
      const haystack = [match.homeTeam.name, match.awayTeam.name, match.ground, match.competition?.name, match.organisation, match.region]
        .map(clean)
        .join(" ");
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

function tally(values: Array<[string, string] | null>): FilterOption[] {
  const map = new Map<string, FilterOption>();
  for (const entry of values) {
    if (!entry) continue;
    const [value, label] = entry;
    const item = map.get(value) ?? { value, label, count: 0 };
    item.count += 1;
    map.set(value, item);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Countries for everything; regions within the chosen country; competitions within country and region. */
export function liveFilterOptions(matches: readonly LiveMatch[], selected: { country?: string; region?: string }) {
  const inCountry = matches.filter((match) => !selected.country || match.country === selected.country);
  const inRegion = inCountry.filter((match) => !selected.region || clean(match.region) === clean(selected.region));
  return {
    countries: tally(matches.map((match) => (match.country ? [match.country, countryName(match.country)] : null))),
    regions: tally(inCountry.map((match) => (match.region ? [match.region, match.region] : null))),
    competitions: tally(inRegion.map((match) => (match.competition ? [match.competition.id, match.competition.name] : null))),
  };
}

export function bucketCounts(matches: readonly LiveMatch[]): Record<LiveBucket, number> {
  const counts: Record<LiveBucket, number> = { live: 0, results: 0, upcoming: 0 };
  for (const match of matches) counts[liveBucket(match)] += 1;
  return counts;
}

/** Countries a club or league can pick, cricket nations first. */
export const liveCountryCodes = [
  "PK", "IN", "GB", "AU", "NZ", "ZA", "LK", "BD", "AF", "AE", "SA", "QA", "BH", "OM", "KW", "KE", "UG", "TZ", "RW",
  "ZW", "NA", "BW", "NP", "HK", "SG", "MY", "TH", "JP", "CN", "PG", "IE", "NL", "DE", "FR", "BE", "IT", "ES", "DK",
  "SE", "NO", "CA", "US", "JM", "TT", "BB", "GY", "FJ",
] as const;

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Flag emoji from a two-letter country code ("PK" → 🇵🇰). */
export function countryFlag(code: string | undefined): string {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

export function legalBallsFromOvers(overs: string | undefined, ballsPerOver = 6): number {
  const parts = /^(\d+)(?:\.(\d+))?$/.exec(overs ?? "");
  if (!parts) return 0;
  return Number(parts[1]) * ballsPerOver + Number(parts[2] ?? 0);
}

export function stoppageLabel(reason: string | undefined): string {
  if (reason === "rain") return "Rain delay";
  if (reason === "bad-light") return "Bad light";
  if (reason === "wet-outfield") return "Wet outfield";
  return "Play suspended";
}

export function battingTeam(match: LiveMatch): LiveTeam {
  const id = match.liveState?.battingTeamId;
  return id === match.awayTeam.id ? match.awayTeam : match.homeTeam;
}

export function bowlingTeam(match: LiveMatch): LiveTeam {
  return battingTeam(match).id === match.homeTeam.id ? match.awayTeam : match.homeTeam;
}

export function scoreText(match: LiveMatch): string {
  const state = match.liveState ?? {};
  return `${battingTeam(match).name} ${state.runs ?? 0}/${state.wickets ?? 0} (${state.overs ?? "0.0"} ov)`;
}

/** One line under the score: result, delay, chase or who is batting. */
export function liveSummary(match: LiveMatch): string {
  const state = match.liveState;
  if (match.status === "completed") return state?.result ?? "Match finished";
  if (liveBucket(match) === "upcoming") return match.competition?.name ?? "Fixture";
  if (match.delayed || !state) return "Score shown after the club's broadcast delay";
  if (state.stoppage) return `${stoppageLabel(state.stoppage.reason)} — play has stopped`;
  if (state.days?.atStumps) return `Stumps, Day ${state.days.current ?? 1}`;
  if (match.status === "innings_break") return "Innings break";
  const batting = battingTeam(match).name;
  if (state.target != null) {
    const runsNeeded = Math.max(0, state.target - (state.runs ?? 0));
    const ballsPerOver = state.settings?.ballsPerOver ?? 6;
    const limit = state.oversLimit !== undefined ? state.oversLimit : (state.settings?.oversPerInnings ?? null);
    const ballsLeft = limit ? Math.max(0, limit * ballsPerOver - legalBallsFromOvers(state.overs, ballsPerOver)) : null;
    if (runsNeeded === 0) return `${batting} have reached the target`;
    return `${batting} need ${runsNeeded} ${runsNeeded === 1 ? "run" : "runs"}${ballsLeft != null ? ` from ${ballsLeft} ${ballsLeft === 1 ? "ball" : "balls"}` : ""}`;
  }
  return `${batting} batting`;
}

const ballRuns = (ball: LiveBall) => (/^\d+$/.test(ball.label) ? Number(ball.label) : 0);
const sameBall = (a: LiveBall | undefined, b: LiveBall | undefined) => a?.label === b?.label && (a?.kind ?? "") === (b?.kind ?? "");

/**
 * Balls added between two "last six balls" trails. Finds the smallest shift where the old trail
 * lines up with the new one; when nothing lines up (a long gap) it only trusts the legal balls bowled.
 */
export function newBallsBetween(prev: readonly LiveBall[], next: readonly LiveBall[], legalBallsAdded: number, runsAdded: number): LiveBall[] {
  let added: LiveBall[] | null = null;
  for (let shift = 1; shift < next.length; shift += 1) {
    const overlap = next.slice(0, next.length - shift);
    const tail = prev.slice(prev.length - overlap.length);
    if (tail.length === overlap.length && overlap.every((ball, index) => sameBall(ball, tail[index]))) {
      added = next.slice(next.length - shift);
      break;
    }
  }
  if (!added) added = prev.length === 0 ? [...next] : next.slice(-Math.max(1, Math.min(next.length, legalBallsAdded)));
  // The balls found can't carry more runs than the score went up by; if they do, the trail didn't line up.
  return added.reduce((sum, ball) => sum + ballRuns(ball), 0) > runsAdded ? [] : added;
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** Moments worth telling a viewer about between two polls of the same match. */
export function liveEventsBetween(prev: LiveMatch, next: LiveMatch): LiveEvent[] {
  const events: LiveEvent[] = [];
  const p = prev.liveState ?? {};
  const n = next.liveState ?? {};
  const innings = n.inningsNumber ?? 1;
  const fixture = `${next.homeTeam.name} v ${next.awayTeam.name}`;
  const push = (kind: LiveAlertKind, title: string, body: string, tag = "") =>
    events.push({ key: `${next.slug}:${kind}:${innings}:${n.runs ?? 0}/${n.wickets ?? 0}:${n.overs ?? ""}${tag}`, kind, slug: next.slug, title, body });

  if (liveBucket(prev) === "upcoming" && liveBucket(next) === "live") push("start", `Match started: ${fixture}`, next.competition?.name ?? next.ground ?? "Live now");
  if (next.status === "completed" && prev.status !== "completed") {
    push("result", n.result ?? `Match finished: ${fixture}`, next.liveState ? scoreText(next) : fixture);
    return events;
  }
  if (!next.liveState || next.delayed || !prev.liveState || prev.delayed) return events;

  const sameInnings = (p.inningsNumber ?? 1) === innings && p.battingTeamId === n.battingTeamId;
  const score = scoreText(next);
  if (sameInnings) {
    const ballsPerOver = n.settings?.ballsPerOver ?? 6;
    const runsAdded = (n.runs ?? 0) - (p.runs ?? 0);
    const wicketsAdded = (n.wickets ?? 0) - (p.wickets ?? 0);
    const ballsAdded = legalBallsFromOvers(n.overs, ballsPerOver) - legalBallsFromOvers(p.overs, ballsPerOver);
    // A correction (undo) moves the score backwards: never announce anything from it.
    if (runsAdded >= 0 && wicketsAdded >= 0 && ballsAdded >= 0 && (runsAdded > 0 || wicketsAdded > 0 || ballsAdded > 0)) {
      const balls = newBallsBetween(p.recent ?? [], n.recent ?? [], ballsAdded, runsAdded);
      if (wicketsAdded > 0) {
        push("wicket", wicketsAdded > 1 ? `${wicketsAdded} WICKETS!` : "WICKET!", `${score} · ${ordinal(n.wickets ?? 0)} wicket down`, ":w");
      }
      const sixes = balls.filter((ball) => ball.label === "6").length;
      const fours = balls.filter((ball) => ball.label === "4" && ball.kind === "boundary").length;
      if (sixes > 0) push("six", sixes > 1 ? `${sixes} SIXES!` : "SIX!", score, ":6");
      if (fours > 0) push("four", fours > 1 ? `${fours} FOURS!` : "FOUR!", score, ":4");
      const before = Math.floor((p.runs ?? 0) / 50);
      const after = Math.floor((n.runs ?? 0) / 50);
      if (after > before && (n.runs ?? 0) >= 50) push("milestone", `${battingTeam(next).name} reach ${after * 50}`, score, ":m");
    }
    if (next.status === "innings_break" && prev.status === "live") {
      push("innings", `Innings break: ${score}`, n.declared ? "Declared" : "Next innings coming up", ":ib");
    }
  } else if (innings > (p.inningsNumber ?? 1) && prev.status === "live") {
    push("innings", `New innings: ${battingTeam(next).name} batting`, n.target != null ? `Target ${n.target}` : fixture, ":ni");
  }

  if (n.stoppage && !p.stoppage) push("stoppage", `${stoppageLabel(n.stoppage.reason)}: ${fixture}`, `Play has stopped · ${score}`, ":stop");
  if (!n.stoppage && p.stoppage) push("stoppage", `Play resumes: ${fixture}`, score, ":go");
  const revised = n.rain?.revisedOvers ?? null;
  if (revised != null && revised !== (p.rain?.revisedOvers ?? null)) {
    push("stoppage", `Revised: ${revised} overs`, n.target != null ? `${battingTeam(next).name} now need ${n.target} to win` : fixture, `:r${revised}`);
  }
  if (n.days?.atStumps && !p.days?.atStumps) push("innings", `Stumps, Day ${n.days.current ?? 1}`, score, ":stumps");
  return events.slice(0, 4);
}

export interface LiveAlertPrefs {
  kinds: Record<LiveAlertKind, boolean>;
  scope: "all" | "following";
  browser: boolean;
}

export const defaultLiveAlertPrefs: LiveAlertPrefs = {
  kinds: { wicket: true, six: true, four: true, milestone: true, stoppage: true, innings: true, result: true, start: true },
  scope: "all",
  browser: false,
};

export function parseLiveAlertPrefs(raw: string | null): LiveAlertPrefs {
  try {
    const value = JSON.parse(raw ?? "null") as Partial<LiveAlertPrefs> | null;
    if (!value || typeof value !== "object") return defaultLiveAlertPrefs;
    const kinds = { ...defaultLiveAlertPrefs.kinds };
    for (const kind of Object.keys(kinds) as LiveAlertKind[]) {
      if (typeof value.kinds?.[kind] === "boolean") kinds[kind] = value.kinds[kind];
    }
    return { kinds, scope: value.scope === "following" ? "following" : "all", browser: value.browser === true };
  } catch {
    return defaultLiveAlertPrefs;
  }
}

export function shouldAlert(event: LiveEvent, prefs: LiveAlertPrefs, following: ReadonlySet<string>): boolean {
  if (!prefs.kinds[event.kind]) return false;
  return prefs.scope === "all" || following.has(event.slug);
}
