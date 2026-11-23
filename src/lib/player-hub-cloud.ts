import { getCloudClient } from "@/lib/cloud";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isCloudPlayerId = (id: string) => uuid.test(id);

export interface PlayerClip {
  deliveryId: string;
  over: number;
  ball: number;
  runs: number;
  wicket: boolean;
  role: "batting" | "bowling";
  assetId: string;
  startMs: number;
  endMs: number;
}

/** Saved camera clips linked to balls this player faced or bowled (only clips you're allowed to see). */
export async function listPlayerClips(playerId: string): Promise<PlayerClip[]> {
  if (!isCloudPlayerId(playerId)) return [];
  const { data, error } = await getCloudClient()
    .from("deliveries")
    .select("id,over_number,ball_in_over,batter_runs,wicket,striker_id,bowler_id,delivery_media_links(asset_id,offset_start_ms,offset_end_ms)")
    .or(`striker_id.eq.${playerId},bowler_id.eq.${playerId}`)
    .is("voided_by_event_id", null)
    .order("occurred_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const clips: PlayerClip[] = [];
  for (const row of data ?? []) {
    for (const link of (row.delivery_media_links ?? []) as { asset_id: string; offset_start_ms: number; offset_end_ms: number }[]) {
      clips.push({
        deliveryId: row.id,
        over: row.over_number,
        ball: row.ball_in_over,
        runs: row.batter_runs,
        wicket: row.wicket,
        role: row.striker_id === playerId ? "batting" : "bowling",
        assetId: link.asset_id,
        startMs: link.offset_start_ms,
        endMs: link.offset_end_ms,
      });
    }
  }
  return clips.slice(0, 60);
}

export async function followPlayer(playerId: string, follow: boolean) {
  const db = getCloudClient();
  if (follow) {
    const { error } = await db.from("player_follows").insert({ player_id: playerId });
    if (error && error.code !== "23505") throw new Error("Only adult players with a public profile can be followed.");
  } else {
    const { error } = await db.from("player_follows").delete().eq("player_id", playerId);
    if (error) throw error;
  }
}

export async function isFollowing(playerId: string) {
  const { data } = await getCloudClient().from("player_follows").select("player_id").eq("player_id", playerId).maybeSingle();
  return Boolean(data);
}

export async function requestProfileClaim(playerId: string, message: string) {
  const db = getCloudClient();
  const player = await db.from("players").select("id,organisation_id,linked_user_id").eq("id", playerId).maybeSingle();
  if (player.error || !player.data) throw new Error("You can only claim a profile at a club you belong to.");
  if (player.data.linked_user_id) throw new Error("This profile is already linked to an account.");
  const { error } = await db.from("player_claims").insert({ player_id: playerId, organisation_id: player.data.organisation_id, message: message.trim().slice(0, 300) || null });
  if (error) throw new Error(error.code === "23505" ? "You've already asked to claim this profile." : "The claim could not be sent.");
}

export interface CareerRow {
  playerId: string;
  name: string;
  club: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  catches: number;
  stumpings: number;
  runOuts: number;
}

export async function myCareer(): Promise<CareerRow[]> {
  const { data, error } = await getCloudClient().rpc("my_career");
  if (error) throw error;
  return (data ?? []) as unknown as CareerRow[];
}

export interface RankingRow {
  ref: string;
  name: string;
  club: string;
  country: string | null;
  region: string | null;
  town: string | null;
  runs: number | null;
  ballsFaced: number | null;
  fours: number | null;
  sixes: number | null;
  ballsBowled: number | null;
  runsConceded: number | null;
  wickets: number | null;
  catches: number | null;
  stumpings: number | null;
  runOuts: number | null;
}

export async function playerRankings(filters: { country?: string; region?: string; town?: string }): Promise<RankingRow[]> {
  const { data, error } = await getCloudClient().rpc("player_rankings", {
    ...(filters.country ? { p_country: filters.country } : {}),
    ...(filters.region ? { p_region: filters.region } : {}),
    ...(filters.town ? { p_town: filters.town } : {}),
    p_limit: 100,
  });
  if (error) throw error;
  return (data ?? []) as unknown as RankingRow[];
}

export interface ClaimRow {
  id: string;
  player_id: string;
  user_id: string;
  message: string | null;
  status: string;
  created_at: string;
  players: { display_name: string } | null;
}

export async function pendingClaims(organisationId: string): Promise<ClaimRow[]> {
  const { data, error } = await getCloudClient()
    .from("player_claims")
    .select("id,player_id,user_id,message,status,created_at,players(display_name)")
    .eq("organisation_id", organisationId)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as ClaimRow[];
}

export async function decideClaim(id: string, approve: boolean) {
  const { error } = await getCloudClient().rpc("decide_player_claim", { p_claim_id: id, p_approve: approve });
  if (error) throw new Error(error.message);
}
