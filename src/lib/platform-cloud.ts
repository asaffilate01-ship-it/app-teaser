import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { getCloudClient, invokePlatformFunction } from "@/lib/cloud";
import type { CompetitionRules, PlatformRole } from "@/lib/platform";

export interface OrganisationRecord {
  id: string;
  name: string;
  slug: string;
  kind: "club" | "league" | "school" | "academy";
  defaultRetentionDays: number;
  role: PlatformRole;
}

export interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  ageGroup: string | null;
  playerIds: string[];
}

export interface GroundRecord {
  id: string;
  name: string;
  timezone: string;
}

export interface PlayerRecord {
  id: string;
  name: string;
  isJunior: boolean;
  publicProfile: boolean;
  teamIds: string[];
  career: {
    runs: number;
    ballsFaced: number;
    wickets: number;
    ballsBowled: number;
    catches: number;
    stumpings: number;
    runOuts: number;
  };
  consent: ConsentRecord | null;
}

export interface ConsentRecord {
  id: string;
  playerId: string;
  recording: ConsentState;
  coachingAnalysis: ConsentState;
  publicHighlights: ConsentState;
  biometricAnalysis: ConsentState;
  validFrom: string;
  validUntil: string | null;
}

export type ConsentState = "pending" | "granted" | "denied" | "withdrawn";

export interface CompetitionRecord {
  id: string;
  name: string;
  format: string;
  seasonId: string;
  seasonName: string;
  activeRuleVersion: number;
  ruleVersionId: string | null;
  rules: CompetitionRules | null;
}

export interface FixtureRecord {
  id: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  groundId: string | null;
  startsAt: string | null;
  status: string;
  roundName: string | null;
  result: Record<string, unknown>;
}

export interface MatchRecord {
  id: string;
  competitionId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  groundId: string | null;
  status: string;
  visibility: "private" | "clubs" | "league" | "public";
  scheduledAt: string | null;
  startedAt: string | null;
  updatedAt: string;
  weather: Record<string, unknown>;
  liveState: Record<string, unknown>;
  scoreboard: ScoreboardRecord | null;
  cameraRooms: CameraRoomRecord[];
}

export interface ScoreboardRecord {
  id: string;
  matchId: string;
  slug: string;
  enabled: boolean;
  delaySeconds: number;
}

export interface CameraRoomRecord {
  id: string;
  matchId: string;
  name: string;
  status: string;
  maxDevices: number;
  openedAt: string;
  closesAt: string | null;
  devices: CameraDeviceRecord[];
}

export interface CameraDeviceRecord {
  id: string;
  roomId: string;
  label: string;
  angle: string;
  clockOffsetMs: number;
  status: Record<string, unknown>;
  lastHeartbeatAt: string;
}

export interface MemberRecord {
  userId: string;
  role: PlatformRole;
  status: string;
  joinedAt: string;
  displayName: string;
}

export interface SubscriptionRecord {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface AuditRecord {
  id: number;
  action: string;
  entityTable: string;
  entityId: string;
  createdAt: string;
}

export interface PlatformDashboardData {
  organisationId: string;
  teams: TeamRecord[];
  grounds: GroundRecord[];
  players: PlayerRecord[];
  competitions: CompetitionRecord[];
  fixtures: FixtureRecord[];
  matches: MatchRecord[];
  members: MemberRecord[];
  videoCounts: { total: number; processing: number; ready: number; retentionDue: number };
  aiCounts: { queued: number; reviewRequired: number; completed: number };
  subscription: SubscriptionRecord | null;
  unreadNotifications: number;
  audit: AuditRecord[];
  loadedAt: string;
}

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

async function rows<T>(query: PromiseLike<QueryResult>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

async function maybeRow<T>(query: PromiseLike<QueryResult>): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? null) as T | null;
}

function asNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function isoDateOffset(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52);
}

export async function createOrganisation(input: {
  name: string;
  kind: OrganisationRecord["kind"];
  user: User;
}): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 6);
  const baseSlug = slugify(input.name) || "cricket-organisation";
  const { data, error } = await getCloudClient()
    .from("organisations")
    .insert({
      name: input.name.trim(),
      kind: input.kind,
      slug: `${baseSlug}-${suffix}`,
      created_by: input.user.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function loadOrganisationDashboard(
  organisationId: string,
  role: PlatformRole,
): Promise<PlatformDashboardData> {
  const client = getCloudClient();
  const [
    teamRows,
    groundRows,
    playerRows,
    teamPlayerRows,
    consentRows,
    careerRows,
    seasonRows,
    competitionRows,
    ruleRows,
    fixtureRows,
    matchRows,
    memberRows,
    notificationRows,
    videoRows,
    aiRows,
  ] = await Promise.all([
    rows<Record<string, unknown>>(
      client
        .from("teams")
        .select("id,name,short_name,age_group")
        .eq("organisation_id", organisationId)
        .order("name"),
    ),
    rows<Record<string, unknown>>(
      client
        .from("grounds")
        .select("id,name,timezone")
        .eq("organisation_id", organisationId)
        .order("name"),
    ),
    rows<Record<string, unknown>>(
      client
        .from("players")
        .select("id,display_name,is_junior,public_profile")
        .eq("organisation_id", organisationId)
        .order("display_name"),
    ),
    rows<Record<string, unknown>>(
      client.from("team_players").select("team_id,player_id,valid_until"),
    ),
    rows<Record<string, unknown>>(
      client
        .from("player_consents")
        .select(
          "id,player_id,recording,coaching_analysis,public_highlights,biometric_analysis,valid_from,valid_until",
        )
        .eq("organisation_id", organisationId)
        .order("valid_from", { ascending: false }),
    ),
    rows<Record<string, unknown>>(client.from("player_career_stats").select("*")),
    rows<Record<string, unknown>>(
      client
        .from("seasons")
        .select("id,name,starts_on,ends_on")
        .eq("organisation_id", organisationId)
        .order("starts_on", { ascending: false }),
    ),
    rows<Record<string, unknown>>(
      client
        .from("competitions")
        .select("id,name,format,season_id,active_rule_version")
        .eq("organisation_id", organisationId)
        .order("created_at", { ascending: false }),
    ),
    rows<Record<string, unknown>>(
      client
        .from("competition_rule_versions")
        .select("id,competition_id,version,rules,rain_provider,rain_method,rain_edition")
        .is("retired_at", null),
    ),
    rows<Record<string, unknown>>(
      client
        .from("fixtures")
        .select(
          "id,competition_id,rule_version_id,home_team_id,away_team_id,ground_id,round_name,starts_at,status,result",
        )
        .order("starts_at", { ascending: true }),
    ),
    rows<Record<string, unknown>>(
      client
        .from("matches")
        .select(
          "id,competition_id,home_team_id,away_team_id,ground_id,status,visibility,scheduled_at,started_at,updated_at,weather,live_state",
        )
        .eq("owner_organisation_id", organisationId)
        .order("scheduled_at", { ascending: false }),
    ),
    rows<Record<string, unknown>>(
      client
        .from("organisation_members")
        .select("user_id,role,status,joined_at")
        .eq("organisation_id", organisationId)
        .order("joined_at"),
    ),
    rows<Record<string, unknown>>(
      client
        .from("notifications")
        .select("id,read_at")
        .eq("organisation_id", organisationId)
        .is("read_at", null),
    ),
    rows<Record<string, unknown>>(
      client
        .from("video_assets")
        .select("id,status,retention_expires_at")
        .eq("organisation_id", organisationId),
    ),
    rows<Record<string, unknown>>(
      client.from("ai_jobs").select("id,status").eq("organisation_id", organisationId),
    ),
  ]);

  const competitionIds = new Set(competitionRows.map((row) => String(row["id"])));
  const memberUserIds = memberRows.map((row) => String(row["user_id"]));
  const profileRows = memberUserIds.length
    ? await rows<Record<string, unknown>>(
        client.from("profiles").select("id,display_name").in("id", memberUserIds),
      )
    : [];
  const profiles = new Map(
    profileRows.map((row) => [String(row["id"]), String(row["display_name"] || "Member")]),
  );
  const organisationFixtures = fixtureRows.filter((row) =>
    competitionIds.has(String(row["competition_id"])),
  );
  const matchIds = matchRows.map((row) => String(row["id"]));
  const scoreboardRows = matchIds.length
    ? await rows<Record<string, unknown>>(
        client
          .from("public_scoreboards")
          .select("id,match_id,slug,enabled,delay_seconds")
          .in("match_id", matchIds),
      )
    : [];
  const roomRows = matchIds.length
    ? await rows<Record<string, unknown>>(
        client
          .from("camera_rooms")
          .select("id,match_id,name,status,max_devices,opened_at,closes_at")
          .in("match_id", matchIds)
          .order("opened_at", { ascending: false }),
      )
    : [];
  const roomIds = roomRows.map((row) => String(row["id"]));
  const deviceRows = roomIds.length
    ? await rows<Record<string, unknown>>(
        client
          .from("camera_devices")
          .select("id,room_id,label,angle,clock_offset_ms,status,last_heartbeat_at")
          .in("room_id", roomIds),
      )
    : [];
  const administrativeRoles: PlatformRole[] = [
    "owner",
    "league_admin",
    "club_admin",
    "safeguarding_officer",
  ];
  const subscription = ["owner", "league_admin", "club_admin"].includes(role)
    ? await maybeRow<Record<string, unknown>>(
        client
          .from("subscriptions")
          .select("plan,status,current_period_end,cancel_at_period_end")
          .eq("organisation_id", organisationId)
          .maybeSingle(),
      )
    : null;
  const auditRows = administrativeRoles.includes(role)
    ? await rows<Record<string, unknown>>(
        client
          .from("audit_log")
          .select("id,action,entity_table,entity_id,created_at")
          .eq("organisation_id", organisationId)
          .order("created_at", { ascending: false })
          .limit(20),
      )
    : [];

  const teamPlayers = new Map<string, string[]>();
  const playerTeams = new Map<string, string[]>();
  for (const row of teamPlayerRows) {
    if (row["valid_until"] && new Date(String(row["valid_until"])) < new Date()) continue;
    const teamId = String(row["team_id"]);
    const playerId = String(row["player_id"]);
    teamPlayers.set(teamId, [...(teamPlayers.get(teamId) ?? []), playerId]);
    playerTeams.set(playerId, [...(playerTeams.get(playerId) ?? []), teamId]);
  }
  const latestConsent = new Map<string, ConsentRecord>();
  for (const row of consentRows) {
    const playerId = String(row["player_id"]);
    if (latestConsent.has(playerId)) continue;
    latestConsent.set(playerId, {
      id: String(row["id"]),
      playerId,
      recording: row["recording"] as ConsentState,
      coachingAnalysis: row["coaching_analysis"] as ConsentState,
      publicHighlights: row["public_highlights"] as ConsentState,
      biometricAnalysis: row["biometric_analysis"] as ConsentState,
      validFrom: String(row["valid_from"]),
      validUntil: row["valid_until"] ? String(row["valid_until"]) : null,
    });
  }
  const careers = new Map(careerRows.map((row) => [String(row["player_id"]), row]));
  const seasons = new Map(seasonRows.map((row) => [String(row["id"]), String(row["name"])]));
  const rules = new Map(
    ruleRows.map((row) => [`${String(row["competition_id"])}:${asNumber(row["version"])}`, row]),
  );
  const scoreboards = new Map(scoreboardRows.map((row) => [String(row["match_id"]), row]));
  const devicesByRoom = new Map<string, CameraDeviceRecord[]>();
  for (const row of deviceRows) {
    const roomId = String(row["room_id"]);
    const device: CameraDeviceRecord = {
      id: String(row["id"]),
      roomId,
      label: String(row["label"]),
      angle: String(row["angle"]),
      clockOffsetMs: asNumber(row["clock_offset_ms"]),
      status: (row["status"] ?? {}) as Record<string, unknown>,
      lastHeartbeatAt: String(row["last_heartbeat_at"]),
    };
    devicesByRoom.set(roomId, [...(devicesByRoom.get(roomId) ?? []), device]);
  }
  const roomsByMatch = new Map<string, CameraRoomRecord[]>();
  for (const row of roomRows) {
    const matchId = String(row["match_id"]);
    const roomId = String(row["id"]);
    const room: CameraRoomRecord = {
      id: roomId,
      matchId,
      name: String(row["name"]),
      status: String(row["status"]),
      maxDevices: asNumber(row["max_devices"]),
      openedAt: String(row["opened_at"]),
      closesAt: row["closes_at"] ? String(row["closes_at"]) : null,
      devices: devicesByRoom.get(roomId) ?? [],
    };
    roomsByMatch.set(matchId, [...(roomsByMatch.get(matchId) ?? []), room]);
  }

  const today = Date.now();
  return {
    organisationId,
    teams: teamRows.map((row) => ({
      id: String(row["id"]),
      name: String(row["name"]),
      shortName: String(row["short_name"]),
      ageGroup: row["age_group"] ? String(row["age_group"]) : null,
      playerIds: teamPlayers.get(String(row["id"])) ?? [],
    })),
    grounds: groundRows.map((row) => ({
      id: String(row["id"]),
      name: String(row["name"]),
      timezone: String(row["timezone"]),
    })),
    players: playerRows.map((row) => {
      const id = String(row["id"]);
      const career = careers.get(id) ?? {};
      return {
        id,
        name: String(row["display_name"]),
        isJunior: Boolean(row["is_junior"]),
        publicProfile: Boolean(row["public_profile"]),
        teamIds: playerTeams.get(id) ?? [],
        consent: latestConsent.get(id) ?? null,
        career: {
          runs: asNumber(career["runs"]),
          ballsFaced: asNumber(career["balls_faced"]),
          wickets: asNumber(career["wickets"]),
          ballsBowled: asNumber(career["balls_bowled"]),
          catches: asNumber(career["catches"]),
          stumpings: asNumber(career["stumpings"]),
          runOuts: asNumber(career["run_outs"]),
        },
      };
    }),
    competitions: competitionRows.map((row) => {
      const activeVersion = asNumber(row["active_rule_version"]);
      const rule = rules.get(`${String(row["id"])}:${activeVersion}`);
      return {
        id: String(row["id"]),
        name: String(row["name"]),
        format: String(row["format"]),
        seasonId: String(row["season_id"]),
        seasonName: seasons.get(String(row["season_id"])) ?? "Season",
        activeRuleVersion: activeVersion,
        ruleVersionId: rule ? String(rule["id"]) : null,
        rules: rule ? (rule["rules"] as CompetitionRules) : null,
      };
    }),
    fixtures: organisationFixtures.map((row) => ({
      id: String(row["id"]),
      competitionId: String(row["competition_id"]),
      homeTeamId: String(row["home_team_id"]),
      awayTeamId: String(row["away_team_id"]),
      groundId: row["ground_id"] ? String(row["ground_id"]) : null,
      startsAt: row["starts_at"] ? String(row["starts_at"]) : null,
      status: String(row["status"]),
      roundName: row["round_name"] ? String(row["round_name"]) : null,
      result: (row["result"] ?? {}) as Record<string, unknown>,
    })),
    matches: matchRows.map((row) => {
      const id = String(row["id"]);
      const scoreboard = scoreboards.get(id);
      return {
        id,
        competitionId: row["competition_id"] ? String(row["competition_id"]) : null,
        homeTeamId: String(row["home_team_id"]),
        awayTeamId: String(row["away_team_id"]),
        groundId: row["ground_id"] ? String(row["ground_id"]) : null,
        status: String(row["status"]),
        visibility: row["visibility"] as MatchRecord["visibility"],
        scheduledAt: row["scheduled_at"] ? String(row["scheduled_at"]) : null,
        startedAt: row["started_at"] ? String(row["started_at"]) : null,
        updatedAt: String(row["updated_at"]),
        weather: (row["weather"] ?? {}) as Record<string, unknown>,
        liveState: (row["live_state"] ?? {}) as Record<string, unknown>,
        scoreboard: scoreboard
          ? {
              id: String(scoreboard["id"]),
              matchId: id,
              slug: String(scoreboard["slug"]),
              enabled: Boolean(scoreboard["enabled"]),
              delaySeconds: asNumber(scoreboard["delay_seconds"]),
            }
          : null,
        cameraRooms: roomsByMatch.get(id) ?? [],
      };
    }),
    members: memberRows.map((row) => {
      const userId = String(row["user_id"]);
      return {
        userId,
        role: row["role"] as PlatformRole,
        status: String(row["status"]),
        joinedAt: String(row["joined_at"]),
        displayName: profiles.get(userId) ?? "Member",
      };
    }),
    videoCounts: {
      total: videoRows.length,
      processing: videoRows.filter((row) =>
        ["uploading", "uploaded", "processing"].includes(String(row["status"])),
      ).length,
      ready: videoRows.filter((row) => row["status"] === "ready").length,
      retentionDue: videoRows.filter((row) => {
        const expiry = new Date(String(row["retention_expires_at"])).getTime();
        return Number.isFinite(expiry) && expiry <= today + 7 * 86_400_000;
      }).length,
    },
    aiCounts: {
      queued: aiRows.filter((row) => ["queued", "running"].includes(String(row["status"]))).length,
      reviewRequired: aiRows.filter((row) => row["status"] === "review_required").length,
      completed: aiRows.filter((row) => row["status"] === "completed").length,
    },
    subscription: subscription
      ? {
          plan: String(subscription["plan"]),
          status: String(subscription["status"]),
          currentPeriodEnd: subscription["current_period_end"]
            ? String(subscription["current_period_end"])
            : null,
          cancelAtPeriodEnd: Boolean(subscription["cancel_at_period_end"]),
        }
      : null,
    unreadNotifications: notificationRows.length,
    audit: auditRows.map((row) => ({
      id: asNumber(row["id"]),
      action: String(row["action"]),
      entityTable: String(row["entity_table"]),
      entityId: String(row["entity_id"]),
      createdAt: String(row["created_at"]),
    })),
    loadedAt: new Date().toISOString(),
  };
}

export function subscribeToOrganisationOperations(
  organisationId: string,
  onChange: () => void,
): () => void {
  const client = getCloudClient();
  let timer: number | undefined;
  const refreshSoon = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 250);
  };
  const channel: RealtimeChannel = client
    .channel(`operations:${organisationId}:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "matches",
        filter: `owner_organisation_id=eq.${organisationId}`,
      },
      refreshSoon,
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "camera_devices" }, refreshSoon)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "ai_jobs",
        filter: `organisation_id=eq.${organisationId}`,
      },
      refreshSoon,
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, refreshSoon)
    .subscribe();
  return () => {
    window.clearTimeout(timer);
    void client.removeChannel(channel);
  };
}

export async function createTeam(input: {
  organisationId: string;
  name: string;
  shortName: string;
  ageGroup?: string;
}): Promise<string> {
  const { data, error } = await getCloudClient()
    .from("teams")
    .insert({
      organisation_id: input.organisationId,
      name: input.name.trim(),
      short_name: input.shortName.trim().toUpperCase().slice(0, 12),
      age_group: input.ageGroup?.trim() || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createGround(input: {
  organisationId: string;
  name: string;
}): Promise<string> {
  const { data, error } = await getCloudClient()
    .from("grounds")
    .insert({ organisation_id: input.organisationId, name: input.name.trim() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createPlayer(input: {
  organisationId: string;
  teamId: string;
  name: string;
  isJunior: boolean;
  publicProfile: boolean;
}): Promise<string> {
  const client = getCloudClient();
  const { data, error } = await client
    .from("players")
    .insert({
      organisation_id: input.organisationId,
      display_name: input.name.trim(),
      is_junior: input.isJunior,
      public_profile: input.publicProfile,
    })
    .select("id")
    .single();
  if (error) throw error;
  const playerId = data.id as string;
  const { error: rosterError } = await client
    .from("team_players")
    .insert({ team_id: input.teamId, player_id: playerId });
  if (rosterError) throw rosterError;
  return playerId;
}

export async function createCompetition(input: {
  organisationId: string;
  name: string;
  format: string;
  seasonName: string;
  startsOn?: string;
  endsOn?: string;
  oversPerInnings: number;
  inningsPerSide: number;
  ballsPerOver: number;
}): Promise<{ competitionId: string; ruleVersionId: string }> {
  const rules: CompetitionRules = {
    version: 1,
    oversPerInnings: input.oversPerInnings,
    inningsPerSide: input.inningsPerSide,
    ballsPerOver: input.ballsPerOver,
    points: { win: 4, tie: 2, noResult: 2, loss: 0 },
    tieBreakers: ["points", "wins", "net-run-rate"],
  };
  const { data, error } = await getCloudClient().rpc("create_competition_workspace", {
    p_organisation_id: input.organisationId,
    p_name: input.name.trim(),
    p_format: input.format,
    p_season_name: input.seasonName.trim(),
    p_starts_on: input.startsOn || isoDateOffset(0),
    p_ends_on: input.endsOn || isoDateOffset(365),
    p_rules: rules,
  });
  if (error) throw error;
  const result = data as { competitionId: string; ruleVersionId: string };
  return result;
}

export async function createFixture(input: {
  competition: CompetitionRecord;
  homeTeamId: string;
  awayTeamId: string;
  groundId?: string;
  startsAt?: string;
  roundName?: string;
}): Promise<string> {
  if (!input.competition.ruleVersionId) throw new Error("Competition has no active rule version.");
  const { data, error } = await getCloudClient()
    .from("fixtures")
    .insert({
      competition_id: input.competition.id,
      rule_version_id: input.competition.ruleVersionId,
      home_team_id: input.homeTeamId,
      away_team_id: input.awayTeamId,
      ground_id: input.groundId || null,
      starts_at: input.startsAt ? new Date(input.startsAt).toISOString() : null,
      round_name: input.roundName?.trim() || null,
      status: input.startsAt ? "scheduled" : "draft",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createMatchWorkspace(input: {
  organisationId: string;
  homeTeamId: string;
  awayTeamId: string;
  groundId?: string;
  competitionId?: string;
  scheduledAt?: string;
  visibility: MatchRecord["visibility"];
  battingFirstTeamId: string;
  oversPerInnings: number;
  inningsPerSide: number;
  ballsPerOver: number;
  weather: string;
  publicSlug?: string;
}): Promise<{ matchId: string; inningsId: string; scoreboardSlug: string | null }> {
  const publicSlugBase = input.publicSlug ? slugify(input.publicSlug).slice(0, 42) : "";
  const { data, error } = await getCloudClient().rpc("create_match_workspace", {
    p_organisation_id: input.organisationId,
    p_home_team_id: input.homeTeamId,
    p_away_team_id: input.awayTeamId,
    p_ground_id: input.groundId || null,
    p_competition_id: input.competitionId || null,
    p_scheduled_at: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    p_visibility: input.visibility,
    p_batting_first_team_id: input.battingFirstTeamId,
    p_overs_per_innings: input.oversPerInnings,
    p_innings_per_side: input.inningsPerSide,
    p_balls_per_over: input.ballsPerOver,
    p_weather: { summary: input.weather.trim() },
    p_public_slug: publicSlugBase ? `${publicSlugBase}-${crypto.randomUUID().slice(0, 8)}` : null,
  });
  if (error) throw error;
  return data as { matchId: string; inningsId: string; scoreboardSlug: string | null };
}

export async function createCameraRoom(input: {
  matchId: string;
  name: string;
}): Promise<{ roomId: string; pairingToken: string; expiresAt: string }> {
  const { data, error } = await getCloudClient().rpc("create_camera_room", {
    p_match_id: input.matchId,
    p_name: input.name.trim() || "Match camera room",
  });
  if (error) throw error;
  return data as { roomId: string; pairingToken: string; expiresAt: string };
}

export async function setPublicScoreboard(input: {
  matchId: string;
  slug: string;
  enabled: boolean;
  delaySeconds?: number;
}): Promise<void> {
  const slug = slugify(input.slug);
  if (!slug) throw new Error("A public scoreboard slug is required.");
  const { error } = await getCloudClient()
    .from("public_scoreboards")
    .upsert(
      {
        match_id: input.matchId,
        slug,
        enabled: input.enabled,
        delay_seconds: input.delaySeconds ?? 0,
      },
      { onConflict: "match_id" },
    );
  if (error) throw error;
  const { error: visibilityError } = await getCloudClient()
    .from("matches")
    .update({ visibility: input.enabled ? "public" : "private" })
    .eq("id", input.matchId);
  if (visibilityError) throw visibilityError;
}

export async function recordPlayerConsent(input: {
  organisationId: string;
  playerId: string;
  recording: ConsentState;
  coachingAnalysis: ConsentState;
  publicHighlights: ConsentState;
  biometricAnalysis: ConsentState;
  notes?: string;
}): Promise<void> {
  const { error } = await getCloudClient().rpc("record_player_consent_decision", {
    p_organisation_id: input.organisationId,
    p_player_id: input.playerId,
    p_recording: input.recording,
    p_coaching_analysis: input.coachingAnalysis,
    p_public_highlights: input.publicHighlights,
    p_biometric_analysis: input.biometricAnalysis,
    p_notes: input.notes?.trim() || null,
  });
  if (error) throw error;
}

export async function inviteMember(input: {
  organisationId: string;
  email: string;
  role: PlatformRole;
}): Promise<void> {
  await invokePlatformFunction("invite-member", {
    organisationId: input.organisationId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    redirectTo: `${window.location.origin}/platform`,
  });
}

export async function createCheckout(input: {
  organisationId: string;
  priceId: string;
}): Promise<string> {
  const result = await invokePlatformFunction<{ url?: string }>("create-checkout-session", {
    organisationId: input.organisationId,
    priceId: input.priceId,
    successUrl: `${window.location.origin}/platform?billing=success`,
    cancelUrl: `${window.location.origin}/platform?billing=cancelled`,
  });
  if (!result.url) throw new Error("Stripe did not return a checkout URL.");
  return result.url;
}
