import { getCloudClient } from "@/lib/cloud";
import type { DeliveryEvidence, Discipline } from "@/lib/analysis";
export type EvidenceFile = {
  id: string;
  kind: "image" | "video";
  storage_path: string;
  label: string;
  includes_junior: boolean;
  created_by: string;
};
export type AnalysisNote = {
  id: string;
  discipline: Discipline;
  note: string;
  tags: string;
  delivery_id: string | null;
  created_at: string;
};
export async function loadAnalysis(organisationId: string, matchId: string) {
  const db = getCloudClient();
  const m = await db
    .from("matches")
    .select("id")
    .eq("id", matchId)
    .eq("owner_organisation_id", organisationId)
    .single();
  if (m.error) throw m.error;
  const deliveries: DeliveryEvidence[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await db
      .from("deliveries")
      .select(
        "id,innings_id,sequence,over_number,ball_in_over,striker_id,bowler_id,fielder_id,delivery_style,outcome,batter_runs,total_runs,legal_ball,wicket,shot_zone,fielding_zone,superseded_by",
      )
      .eq("match_id", matchId)
      .is("superseded_by", null)
      .order("sequence")
      .order("id")
      .range(offset, offset + 499);
    if (r.error) throw r.error;
    deliveries.push(...(r.data as DeliveryEvidence[]));
    if (r.data.length < 500) break;
    if (offset >= 9500) throw new Error("Match exceeds workspace limit.");
  }
  const clips: Array<{
    delivery_id: string;
    asset_id: string;
    offset_start_ms: number;
    offset_end_ms: number;
  }> = [];
  for (let start = 0; start < deliveries.length; start += 100) {
    for (let offset = 0; ; offset += 500) {
      const r = await db
        .from("delivery_media_links")
        .select("delivery_id,asset_id,offset_start_ms,offset_end_ms")
        .in(
          "delivery_id",
          deliveries.slice(start, start + 100).map((d) => d.id),
        )
        .order("delivery_id")
        .order("asset_id")
        .range(offset, offset + 499);
      if (r.error) throw r.error;
      clips.push(...r.data);
      if (r.data.length < 500) break;
      if (offset >= 9500) throw new Error("Too many linked clips.");
    }
  }
  const [files, notes] = await Promise.all([
    db
      .from("criclume_analysis_files")
      .select("id,kind,storage_path,label,includes_junior,created_by")
      .eq("organisation_id", organisationId)
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("criclume_analysis_notes")
      .select("id,discipline,note,tags,delivery_id,created_at")
      .eq("organisation_id", organisationId)
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return {
    deliveries,
    clips,
    files: (files.data ?? []) as EvidenceFile[],
    notes: (notes.data ?? []) as AnalysisNote[],
    workspaceAvailable: !files.error && !notes.error,
    mediaIds: new Set(clips.map((c) => c.delivery_id)),
  };
}
export async function uploadEvidence(
  org: string,
  match: string,
  file: File,
  consent: boolean,
  junior: boolean,
) {
  if (!consent) throw new Error("Coaching permission is required.");
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };
  const ext = extensions[file.type];
  if (!ext || file.size < 1 || file.size > 52428800)
    throw new Error("Choose a supported photo or video up to 50 MB.");
  const db = getCloudClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const id = crypto.randomUUID(),
    path = `${org}/${match}/${id}.${ext}`;
  const r = await db.from("criclume_analysis_files").insert({
    id,
    organisation_id: org,
    match_id: match,
    kind: file.type.startsWith("image/") ? "image" : "video",
    storage_path: path,
    label: file.name.slice(0, 150),
    analysis_consent: true,
    includes_junior: junior,
    created_by: user.id,
  });
  if (r.error) throw r.error;
  const uploaded = await db.storage
    .from("criclume-evidence")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) {
    await db.from("criclume_analysis_files").delete().eq("id", id);
    throw uploaded.error;
  }
}
export async function evidenceUrl(file: EvidenceFile) {
  const r = await getCloudClient()
    .storage.from("criclume-evidence")
    .createSignedUrl(file.storage_path, 60);
  if (r.error) throw r.error;
  return r.data.signedUrl;
}
export async function removeEvidence(file: EvidenceFile) {
  const db = getCloudClient();
  const r = await db.storage.from("criclume-evidence").remove([file.storage_path]);
  if (r.error) throw r.error;
  const deleted = await db.from("criclume_analysis_files").delete().eq("id", file.id).select("id");
  if (deleted.error || deleted.data?.length !== 1)
    throw new Error("Evidence could not be removed.");
}
export async function clipUrl(id: string) {
  const db = getCloudClient();
  const r = await db
    .from("video_assets")
    .select("storage_path,status,recording_consent,retention_expires_at")
    .eq("id", id)
    .single();
  if (
    r.error ||
    !r.data.storage_path ||
    r.data.recording_consent !== "granted" ||
    ["deleted", "quarantined"].includes(r.data.status) ||
    Date.parse(r.data.retention_expires_at) <= Date.now()
  )
    throw new Error("Clip unavailable or consent expired.");
  const s = await db.storage.from("match-video").createSignedUrl(r.data.storage_path, 60);
  if (s.error) throw s.error;
  return s.data.signedUrl;
}
export async function saveNote(
  org: string,
  match: string,
  discipline: Discipline,
  note: string,
  tags: string,
  deliveryId: string,
) {
  const db = getCloudClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const r = await db.from("criclume_analysis_notes").insert({
    organisation_id: org,
    match_id: match,
    discipline,
    note,
    tags,
    delivery_id: deliveryId || null,
    created_by: user.id,
  });
  if (r.error) throw r.error;
}
