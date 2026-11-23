import { getRequest, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { choosePromos, readVisitorPlace, type PromoItem, type PromoSlot, type PromoSurface, type VisitorPlace } from "./promo-targeting";
import { sha256Hex } from "./sha256";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Where the visitor is, from the edge network (no third-party lookups, nothing stored). */
export function visitorPlace(): VisitorPlace {
  let cf: Record<string, unknown> | null = null;
  try {
    cf = ((getRequest() as unknown as { cf?: Record<string, unknown> }).cf ?? null) as Record<string, unknown> | null;
  } catch {
    cf = null;
  }
  return readVisitorPlace((name) => getRequestHeader(name) ?? null, cf);
}

/** A per-day, salted fingerprint of the viewer used only to stop one device inflating play counts. */
export async function viewerHash(): Promise<string | null> {
  const salt = process.env["PROMO_VIEWER_SALT"];
  if (!salt) return null;
  const ip = getRequestIP({ xForwardedFor: true }) ?? getRequestHeader("cf-connecting-ip") ?? "unknown";
  const agent = getRequestHeader("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  return sha256Hex(`${salt}|${day}|${ip}|${agent}`);
}

/** The club that owns a published scoreboard (null when the board is not public). */
/**
 * The clubs behind a published scoreboard: the host (who runs the match) and the two playing clubs.
 * Null when the board is not public.
 */
export async function clubsForBoard(slug: string): Promise<{ host: string; playing: string[] } | null> {
  const db = await admin();
  const { data } = await db
    .from("public_scoreboards")
    .select("enabled, matches!inner(owner_organisation_id, home_team_id, away_team_id)")
    .eq("slug", slug)
    .maybeSingle();
  const row = data as
    | { enabled: boolean; matches: { owner_organisation_id: string; home_team_id: string; away_team_id: string } | null }
    | null;
  if (!row?.enabled || !row.matches) return null;
  const { data: teams } = await db
    .from("teams")
    .select("id, organisation_id")
    .in("id", [row.matches.home_team_id, row.matches.away_team_id]);
  const orgOf = (id: string) => (teams ?? []).find((team) => team.id === id)?.organisation_id ?? null;
  const playing = [orgOf(row.matches.away_team_id), orgOf(row.matches.home_team_id)].filter(
    (id, index, list): id is string => Boolean(id) && list.indexOf(id) === index,
  );
  return { host: row.matches.owner_organisation_id, playing };
}

export async function organisationForBoard(slug: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("public_scoreboards").select("enabled, matches!inner(owner_organisation_id)").eq("slug", slug).maybeSingle();
  const row = data as { enabled: boolean; matches: { owner_organisation_id: string } | null } | null;
  return row?.enabled && row.matches ? row.matches.owner_organisation_id : null;
}

/** Ads running today on this kind of screen that suit the visitor's place, with six-hour file links. */
export async function promosFor(surface: PromoSurface): Promise<Record<PromoSlot, PromoItem[]>> {
  const empty = { top: [], side: [] };
  const db = await admin();
  const { data, error } = await db.rpc("list_live_promos", { p_surface: surface });
  if (error || !data?.length) return empty;
  const chosen = choosePromos(
    data.map((row) => ({ ...row, slot: (row.slot === "side" ? "side" : "top") as PromoSlot })),
    visitorPlace(),
  );
  const paths = [...new Set([...chosen.top, ...chosen.side].map((row) => row.media_path))];
  if (paths.length === 0) return empty;
  const { data: signed } = await db.storage.from("promo-media").createSignedUrls(paths, 6 * 3600);
  const links = new Map<string, string>();
  // Links the visitor's browser opens must use the public backend address.
  const serverBase = process.env["SUPABASE_URL"] ?? "";
  const browserBase = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? serverBase;
  for (const row of signed ?? []) {
    if (row.path && row.signedUrl) links.set(row.path, serverBase ? row.signedUrl.replace(serverBase, browserBase) : row.signedUrl);
  }
  const toItem = (row: (typeof chosen.top)[number]): PromoItem | null => {
    const url = links.get(row.media_path);
    if (!url) return null;
    return {
      creativeId: row.creative_id,
      slot: row.slot as PromoSlot,
      kind: row.media_kind === "video" ? "video" : "image",
      url,
      durationSeconds: row.duration_seconds,
      advertiser: row.advertiser,
      alt: row.alt_text || `Advert: ${row.advertiser}`,
      clickUrl: row.click_url,
    };
  };
  return {
    top: chosen.top.map(toItem).filter((item): item is PromoItem => item !== null),
    side: chosen.side.map(toItem).filter((item): item is PromoItem => item !== null),
  };
}

/** Count plays (at most once a minute per ad per viewer). Returns how many were counted. */
export async function countPlays(surface: PromoSurface, organisationId: string | null, creativeIds: string[]): Promise<number> {
  const hash = await viewerHash();
  if (!hash || creativeIds.length === 0) return 0;
  const db = await admin();
  const { data, error } = await db.rpc("record_promo_plays", {
    p_creative_ids: creativeIds.slice(0, 20),
    p_organisation_id: organisationId as string,
    p_surface: surface,
    p_viewer_hash: hash,
  });
  if (error) {
    console.error("Ad play count failed", error.message);
    return 0;
  }
  return data ?? 0;
}
