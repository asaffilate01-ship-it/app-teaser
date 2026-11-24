/** Club location, league links, team allowance and tournament invitations. Every rule is enforced by database RPCs. */
import { getCloudClient } from "@/lib/cloud";
import { cleanPlace, type PlaceValue } from "@/lib/geo";
import type { TeamAllowance } from "@/lib/team-types";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function loadOrganisationPlace(organisationId: string): Promise<PlaceValue> {
  const { data, error } = await getCloudClient()
    .from("organisations")
    .select("country_code, region, district, town")
    .eq("id", organisationId)
    .maybeSingle();
  fail(error);
  return {
    country: data?.country_code ?? "",
    province: data?.region ?? "",
    district: data?.district ?? "",
    town: data?.town ?? "",
  };
}

export async function saveOrganisationPlace(
  organisationId: string,
  place: PlaceValue,
): Promise<PlaceValue> {
  const clean = cleanPlace(place);
  const { error } = await getCloudClient()
    .from("organisations")
    .update({
      country_code: clean.country || null,
      region: clean.province || null,
      district: clean.district || null,
      town: clean.town || null,
    })
    .eq("id", organisationId);
  fail(error);
  return clean;
}

export interface LeagueOption {
  id: string;
  name: string;
  country: string | null;
  province: string | null;
  district: string | null;
  town: string | null;
}

export async function searchLeagues(query: string, country: string): Promise<LeagueOption[]> {
  const { data, error } = await getCloudClient().rpc("search_leagues", {
    p_query: query,
    p_country: country,
  });
  fail(error);
  type Row = {
    id: string;
    name: string;
    country_code: string | null;
    region: string | null;
    district: string | null;
    town: string | null;
  };
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    country: row.country_code,
    province: row.region,
    district: row.district,
    town: row.town,
  }));
}

export async function requestLeague(clubId: string, leagueId: string): Promise<void> {
  const { error } = await getCloudClient().rpc("request_league_membership", {
    p_club: clubId,
    p_league: leagueId,
  });
  fail(error);
}

export interface LeagueLink {
  id: string;
  status: "pending" | "approved";
  /** "club": this organisation is the club; "league": this organisation is the league. */
  side: "club" | "league";
  otherId: string;
  otherName: string;
  otherKind: string;
  country: string | null;
  region: string | null;
  district: string | null;
  town: string | null;
  createdAt: string;
}

export async function loadLeagueLinks(organisationId: string): Promise<LeagueLink[]> {
  const { data, error } = await getCloudClient().rpc("league_links", { p_org: organisationId });
  fail(error);
  return (Array.isArray(data) ? data : []) as unknown as LeagueLink[];
}

export async function decideLeagueLink(id: string, approve: boolean): Promise<void> {
  const { error } = await getCloudClient().rpc("decide_league_membership", {
    p_id: id,
    p_approve: approve,
  });
  fail(error);
}

export async function endLeagueLink(id: string): Promise<void> {
  const { error } = await getCloudClient().rpc("end_league_membership", { p_id: id });
  fail(error);
}

export async function loadTeamAllowance(organisationId: string): Promise<TeamAllowance> {
  const { data, error } = await getCloudClient().rpc("team_allowance", { p_org: organisationId });
  fail(error);
  const value = (data ?? {}) as { limit?: number | null; used?: number };
  return {
    limit: typeof value.limit === "number" ? value.limit : null,
    used: Number(value.used ?? 0),
  };
}

export interface ReceivedInvite {
  id: string;
  status: "pending" | "accepted";
  message: string;
  createdAt: string;
  competitionId: string;
  competition: string;
  format: string;
  season: string;
  startsOn: string | null;
  endsOn: string | null;
  hostName: string;
  hostKind: string;
  hostTown: string | null;
  hostRegion: string | null;
  hostCountry: string | null;
  teamIds: string[];
}

export interface SentInvite {
  id: string;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  createdAt: string;
  respondedAt: string | null;
  competitionId: string;
  clubId: string;
  clubName: string;
  clubTown: string | null;
  clubRegion: string | null;
  clubCountry: string | null;
  teams: string[];
}

export interface EnteredCompetition {
  competitionId: string;
  competition: string;
  format: string;
  season: string;
  hostName: string;
  teams: string[];
  fixtures: number;
}

export interface InvitesOverview {
  received: ReceivedInvite[];
  sent: SentInvite[];
  entered: EnteredCompetition[];
}

export async function loadInvitesOverview(organisationId: string): Promise<InvitesOverview> {
  const { data, error } = await getCloudClient().rpc("competition_invites_overview", {
    p_org: organisationId,
  });
  fail(error);
  const value = (data ?? {}) as Partial<InvitesOverview>;
  return { received: value.received ?? [], sent: value.sent ?? [], entered: value.entered ?? [] };
}

export interface InvitableClub {
  id: string;
  name: string;
  kind: string;
  country: string | null;
  province: string | null;
  district: string | null;
  town: string | null;
  inviteStatus: string | null;
  inLeague: boolean;
}

export async function findClubsToInvite(
  competitionId: string,
  query: string,
  country: string,
): Promise<InvitableClub[]> {
  const { data, error } = await getCloudClient().rpc("find_clubs_to_invite", {
    p_competition: competitionId,
    p_query: query,
    p_country: country,
  });
  fail(error);
  type Row = {
    id: string;
    name: string;
    kind: string;
    country_code: string | null;
    region: string | null;
    district: string | null;
    town: string | null;
    invite_status: string | null;
    in_league: boolean;
  };
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    country: row.country_code,
    province: row.region,
    district: row.district,
    town: row.town,
    inviteStatus: row.invite_status,
    inLeague: row.in_league,
  }));
}

export async function inviteClubs(
  competitionId: string,
  clubIds: string[],
  message: string,
): Promise<number> {
  const { data, error } = await getCloudClient().rpc("invite_clubs_to_competition", {
    p_competition: competitionId,
    p_orgs: clubIds,
    p_message: message,
  });
  fail(error);
  return Number(data ?? 0);
}

export async function inviteLeagueClubs(competitionId: string, message: string): Promise<number> {
  const { data, error } = await getCloudClient().rpc("invite_league_clubs", {
    p_competition: competitionId,
    p_message: message,
  });
  fail(error);
  return Number(data ?? 0);
}

export async function withdrawInvite(inviteId: string): Promise<void> {
  const { error } = await getCloudClient().rpc("withdraw_competition_invite", {
    p_invite: inviteId,
  });
  fail(error);
}

export async function answerInvite(
  inviteId: string,
  accept: boolean,
  teamIds: string[],
): Promise<void> {
  const { error } = await getCloudClient().rpc("respond_competition_invite", {
    p_invite: inviteId,
    p_accept: accept,
    p_team_ids: teamIds,
  });
  fail(error);
}
