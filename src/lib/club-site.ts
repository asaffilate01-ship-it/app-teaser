import { buildLeagueStandings } from "./league-standings.ts";
import type { CompetitionRules, TableRow } from "./platform.ts";
import type { FixtureRecord } from "./platform-cloud";

/** What the public website lookup (`get_club_site`) returns; `files` holds short-lived links added on the server. */
export interface PublicClubSite {
  published: boolean;
  name: string;
  kind: string;
  slug: string;
  /** The club's own web address when it is live (League plan), e.g. "riversidecc.com". */
  domain?: string | null;
  /** League plan: club-first branding with a small "Powered by CricLume" mark. */
  coBranded?: boolean;
  site?: SiteSettings;
  teams?: SiteTeam[];
  matches?: SiteMatch[];
  fixtures?: SiteFixture[];
  competitions?: SiteCompetition[];
  posts?: SitePost[];
  photos?: SitePhoto[];
  files?: Record<string, string>;
}
export interface SiteSettings {
  tagline: string;
  about: string;
  accent: SiteAccent;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  mapUrl: string | null;
  socials: Record<string, string>;
  sponsors: Array<{ name: string; url?: string | null }>;
  heroPath: string | null;
  logoPath?: string | null;
  updatedAt: string;
}
export interface SiteTeam { id: string; name: string; shortName: string | null; ageGroup: string | null }
export interface SiteMatch {
  id: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  home: string;
  away: string;
  ground: string | null;
  runs: number | null;
  wickets: number | null;
  overs: string | null;
  target: number | null;
  battingIsHome: boolean | null;
  result: string | null;
  scoreboard: string | null;
}
export interface SiteFixture {
  id: string;
  competitionId: string;
  competition: string;
  round: string | null;
  startsAt: string | null;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  home: string;
  away: string;
  ground: string | null;
  result: Record<string, string | number | boolean | null> | null;
  signedOff: boolean;
  signedOffAt: string | null;
  ruleVersionId: string | null;
}
export interface SiteCompetition {
  id: string;
  name: string;
  format: string;
  season: string | null;
  ruleVersionId: string | null;
  rules: CompetitionRules | null;
}
export type PostKind = "news" | "notice" | "document";
export interface SitePost {
  id: string;
  kind: PostKind;
  title: string;
  body: string;
  filePath: string | null;
  linkUrl: string | null;
  pinned: boolean;
  publishedAt: string;
}
export interface SitePhoto { id: string; path: string; caption: string }

export const siteAccents = ["crimson", "gold", "emerald", "royal", "teal", "orange"] as const;
export type SiteAccent = (typeof siteAccents)[number];
export const accentLabels: Record<SiteAccent, string> = {
  crimson: "Crimson",
  gold: "Gold",
  emerald: "Emerald",
  royal: "Royal blue",
  teal: "Teal",
  orange: "Orange",
};
export function readAccent(value: unknown): SiteAccent {
  return siteAccents.includes(value as SiteAccent) ? (value as SiteAccent) : "crimson";
}

export const socialKeys = ["website", "facebook", "instagram", "youtube", "tiktok", "x", "whatsapp"] as const;
export type SocialKey = (typeof socialKeys)[number];
export const socialLabels: Record<SocialKey, string> = {
  website: "Website",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  whatsapp: "WhatsApp",
};

/** Only secure web links are kept, so a site can never link to scripts or odd schemes. */
export function safeLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^https:\/\/[^\s]+$/i.test(text) || text.length > 500) return null;
  try {
    return new URL(text).protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}

export function readSocials(raw: unknown): Partial<Record<SocialKey, string>> {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Partial<Record<SocialKey, string>> = {};
  for (const key of socialKeys) {
    const link = safeLink(source[key]);
    if (link) out[key] = link;
  }
  return out;
}

export interface Sponsor { name: string; url: string | null }
export function readSponsors(raw: unknown): Sponsor[] {
  if (!Array.isArray(raw)) return [];
  const out: Sponsor[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as Record<string, unknown>)["name"] ?? "").trim().slice(0, 80);
    if (!name) continue;
    out.push({ name, url: safeLink((item as Record<string, unknown>)["url"]) });
  }
  return out.slice(0, 24);
}

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The web address rule the database also enforces: 3–40 lowercase letters, numbers and single dashes. */
export function isValidWebSlug(value: string): boolean {
  return value.length >= 3 && value.length <= 40 && slugPattern.test(value);
}
export function suggestWebSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : `${base || "club"}-cricket`.slice(0, 40);
}

const liveStatuses = new Set(["live", "innings_break"]);
const resultStatuses = new Set(["completed", "abandoned"]);

export interface UpcomingItem {
  id: string;
  when: string | null;
  home: string;
  away: string;
  ground: string | null;
  label: string | null;
}

/** Live now, coming up (soonest first) and results (newest first) for the website. */
export function siteSchedule(site: Pick<PublicClubSite, "matches" | "fixtures">, nowMs: number) {
  const matches = site.matches ?? [];
  const live = matches.filter((m) => liveStatuses.has(m.status));
  const results = matches
    .filter((m) => resultStatuses.has(m.status))
    .sort((a, b) => time(b.completedAt ?? b.startedAt ?? b.scheduledAt) - time(a.completedAt ?? a.startedAt ?? a.scheduledAt));
  const cutoff = nowMs - 6 * 3_600_000;
  const upcoming: UpcomingItem[] = [];
  const seen = new Set<string>();
  const key = (home: string, away: string, when: string | null) => `${home}|${away}|${when ? when.slice(0, 10) : ""}`;
  for (const m of matches) {
    if (m.status !== "scheduled" || time(m.scheduledAt) < cutoff) continue;
    seen.add(key(m.home, m.away, m.scheduledAt));
    upcoming.push({ id: m.id, when: m.scheduledAt, home: m.home, away: m.away, ground: m.ground, label: null });
  }
  for (const f of site.fixtures ?? []) {
    if (!["scheduled", "postponed"].includes(f.status) || !f.startsAt || time(f.startsAt) < cutoff) continue;
    if (seen.has(key(f.home, f.away, f.startsAt))) continue;
    upcoming.push({
      id: f.id,
      when: f.startsAt,
      home: f.home,
      away: f.away,
      ground: f.ground,
      label: [f.competition, f.round, f.status === "postponed" ? "Postponed" : null].filter(Boolean).join(" · ") || null,
    });
  }
  upcoming.sort((a, b) => time(a.when) - time(b.when));
  return { live, upcoming, results };
}

function time(iso: string | null | undefined): number {
  const value = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

/** "Riverside 120/4 (16.2 ov)" for the side batting now. */
export function liveScoreLine(match: SiteMatch): string {
  if (match.runs == null) return "Starting soon";
  const side = match.battingIsHome === false ? match.away : match.home;
  const overs = match.overs ? ` (${match.overs} ov)` : "";
  const chase = match.target ? ` · target ${match.target}` : "";
  return `${side} ${match.runs}/${match.wickets ?? 0}${overs}${chase}`;
}

export interface SiteTable { competition: SiteCompetition; rows: Array<TableRow & { name: string }>; counted: number }

/** League tables from signed-off results only, using the same rules as the league workspace. */
export function siteTables(site: Pick<PublicClubSite, "competitions" | "fixtures">): SiteTable[] {
  const tables: SiteTable[] = [];
  for (const competition of site.competitions ?? []) {
    const own = (site.fixtures ?? []).filter((f) => f.competitionId === competition.id);
    if (own.length === 0) continue;
    const names = new Map<string, string>();
    for (const f of own) {
      names.set(f.homeTeamId, f.home);
      names.set(f.awayTeamId, f.away);
    }
    const fixtures: FixtureRecord[] = own.map((f) => ({
      id: f.id,
      competitionId: f.competitionId,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      groundId: null,
      startsAt: f.startsAt,
      status: f.status,
      roundName: f.round,
      result: f.result ?? {},
      ruleVersionId: f.ruleVersionId,
      signedOffAt: f.signedOff ? f.signedOffAt : null,
      signedOffBy: f.signedOff ? "league" : null,
    }));
    const preview = buildLeagueStandings({
      competition: { id: competition.id, rules: competition.rules, ruleVersionId: competition.ruleVersionId },
      fixtures,
      teams: [...names].map(([id, name]) => ({ id, name })),
    });
    if (preview.blockedReason || preview.rows.length === 0) continue;
    tables.push({
      competition,
      counted: preview.counted,
      rows: preview.rows.map((row) => ({ ...row, name: names.get(row.teamId) ?? "Team" })),
    });
  }
  return tables;
}

export function postExcerpt(body: string, length = 180): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`;
}

export const postKindLabels: Record<PostKind, string> = { news: "News", notice: "Notice", document: "Document" };

/** Every stored file the public page shows, so the server can sign them in one request. */
export function siteFilePaths(site: PublicClubSite): string[] {
  const paths = new Set<string>();
  if (site.site?.heroPath) paths.add(site.site.heroPath);
  if (site.site?.logoPath) paths.add(site.site.logoPath);
  for (const photo of site.photos ?? []) paths.add(photo.path);
  for (const post of site.posts ?? []) if (post.filePath) paths.add(post.filePath);
  return [...paths];
}
