import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, RefreshCw, Save, ShieldCheck, Star, Video } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { signedRoomClipUrl } from "@/lib/camera-review-cloud";
import type { CameraClip, CameraDelivery } from "@/lib/camera-review";
import {
  canMarkPrivateHighlight,
  redactHighlightNote,
  syncedDeliverySeconds,
  syncedSecondarySeconds,
  validCalibrationOffset,
  type HighlightKind,
  type PrivateHighlightCandidate,
} from "@/lib/camera-replay-workbench";

interface Device {
  id: string;
  label: string;
  angle: string;
}

export function CameraReplayWorkbench({
  roomId,
  clips,
  deliveries,
  devices,
}: {
  roomId: string;
  clips: CameraClip[];
  deliveries: CameraDelivery[];
  devices: Device[];
}) {
  const leftRef = useRef<HTMLVideoElement>(null);
  const rightRef = useRef<HTMLVideoElement>(null);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [urls, setUrls] = useState<{ left: string; right: string } | null>(null);
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [savedOffsets, setSavedOffsets] = useState<Record<string, number>>({});
  const [highlights, setHighlights] = useState<PrivateHighlightCandidate[]>([]);
  const [linkedDelivery, setLinkedDelivery] = useState("");
  const [kind, setKind] = useState<HighlightKind>("other");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [overlap, setOverlap] = useState(true);

  const left = clips.find((clip) => clip.id === leftId);
  const right = clips.find((clip) => clip.id === rightId);
  const label = (deviceId: string) =>
    devices.find((item) => item.id === deviceId)?.label ?? "Camera " + deviceId.slice(0, 6);
  const availablePairs = clips.some((a) => clips.some((b) => b.device_id !== a.device_id));

  useEffect(() => {
    if (clips.length === 0) {
      setLeftId("");
      setRightId("");
      setUrls(null);
      return;
    }
    const initialClip = clips[0];
    if (!initialClip) return;
    setLeftId((current) => (clips.some((clip) => clip.id === current) ? current : initialClip.id));
    setRightId((current) => {
      const first = clips.find((clip) => clip.id === leftId) ?? initialClip;
      return clips.some((clip) => clip.id === current && clip.device_id !== first.device_id)
        ? current
        : (clips.find((clip) => clip.device_id !== first.device_id)?.id ?? "");
    });
  }, [clips, leftId]);

  const refresh = useCallback(async () => {
    if (clips.length === 0) return;
    try {
      const client = getCloudClient();
      const [saved, candidates] = await Promise.all([
        client
          .from("camera_clip_calibrations")
          .select("asset_id,offset_ms")
          .eq("room_id", roomId)
          .in(
            "asset_id",
            clips.map((clip) => clip.id),
          ),
        client
          .from("camera_highlight_candidates")
          .select("id,asset_id,delivery_id,at_ms,duration_ms,kind,note,created_by,created_at")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(60),
      ]);
      if (saved.error) throw saved.error;
      if (candidates.error) throw candidates.error;
      const recorded = Object.fromEntries(
        (saved.data ?? []).map((row) => [row.asset_id, row.offset_ms]),
      );
      setSavedOffsets(recorded);
      setOffsets(recorded);
      setHighlights((candidates.data ?? []) as PrivateHighlightCandidate[]);
      setError("");
    } catch {
      setError(
        "Private replay calibration and highlights are unavailable. Verify the CricLume database migration and director access.",
      );
    }
  }, [roomId, clips]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setUrls(null);
    setOverlap(true);
  }, [leftId, rightId]);

  const startComparison = async () => {
    if (!left || !right || left.device_id === right.device_id) return;
    setBusy(true);
    setError("");
    try {
      const [leftUrl, rightUrl] = await Promise.all([
        signedRoomClipUrl(left),
        signedRoomClipUrl(right),
      ]);
      setUrls({ left: leftUrl, right: rightUrl });
      setMessage(
        "Two private camera sources authorised. Timing is an estimate until manually reviewed.",
      );
    } catch (reason) {
      setUrls(null);
      setError(reason instanceof Error ? reason.message : "Private replay was denied.");
    } finally {
      setBusy(false);
    }
  };

  const align = () => {
    if (!left || !right || !urls || !leftRef.current || !rightRef.current) return;
    const primary = leftRef.current;
    const secondary = rightRef.current;
    const seconds = syncedSecondarySeconds(
      left,
      right,
      primary.currentTime,
      offsets[left.id] ?? 0,
      offsets[right.id] ?? 0,
    );
    if (seconds === null) {
      setOverlap(false);
      secondary.pause();
      return;
    }
    setOverlap(true);
    if (secondary.readyState < 1) return;
    if (Math.abs(secondary.currentTime - seconds) > 0.3) secondary.currentTime = seconds;
    secondary.playbackRate = primary.playbackRate;
    if (primary.paused && !secondary.paused) secondary.pause();
    if (!primary.paused && secondary.paused)
      void secondary
        .play()
        .catch(() => setError("Second angle could not autoplay. Use video controls."));
  };

  const saveOffset = async (clip: CameraClip) => {
    const offset = offsets[clip.id] ?? 0;
    if (!validCalibrationOffset(offset)) {
      setError("Only whole-millisecond offsets within ±30 seconds are permitted.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data: auth, error: authError } = await getCloudClient().auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in to calibrate a recording.");
      const { error: saveError } = await getCloudClient().from("camera_clip_calibrations").upsert(
        {
          asset_id: clip.id,
          room_id: roomId,
          offset_ms: offset,
          calibrated_by: auth.user.id,
          calibrated_at: new Date().toISOString(),
          method: "manual_review",
        },
        { onConflict: "asset_id" },
      );
      if (saveError) throw saveError;
      setSavedOffsets((value) => ({ ...value, [clip.id]: offset }));
      setMessage("Manual camera clock offset saved. This does not certify frame accuracy.");
      align();
    } catch {
      setError(
        "Cannot save calibration. You must have director access and ownership of this calibration.",
      );
    } finally {
      setBusy(false);
    }
  };

  const markHighlight = async () => {
    if (!left || !leftRef.current) return;
    const seconds = leftRef.current.currentTime;
    if (!canMarkPrivateHighlight(left, seconds, 6000, Date.now())) {
      setError("Choose a current, consented clip with at least six seconds remaining.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data: auth, error: authError } = await getCloudClient().auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in to mark a highlight.");
      const { error: saveError } = await getCloudClient()
        .from("camera_highlight_candidates")
        .insert({
          room_id: roomId,
          asset_id: left.id,
          delivery_id: linkedDelivery || null,
          at_ms: Math.round(seconds * 1000),
          duration_ms: 6000,
          kind,
          note: redactHighlightNote(note) || null,
          source: "manual",
          created_by: auth.user.id,
        });
      if (saveError) throw saveError;
      setNote("");
      setMessage("Private highlight candidate saved. No video was generated or published.");
      await refresh();
    } catch {
      setError(
        "Highlight was not saved. Check authorisation, match delivery selection and private media consent.",
      );
    } finally {
      setBusy(false);
    }
  };

  const leftCalibrated = left ? savedOffsets[left.id] !== undefined : false;
  const rightCalibrated = right ? savedOffsets[right.id] !== undefined : false;

  return (
    <section
      className="mt-6 rounded-xl border border-white/10 bg-[#141923] p-4 md:p-5"
      aria-label="Private dual-angle replay calibration and highlight review"
    >
      <div className="flex items-start gap-3">
        <Video className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div>
          <h3 className="text-base font-bold">Two-angle replay and private highlight desk</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Timeline matching uses recorded device times. Adjust each clip offset to align a visible
            event; saved calibration remains manually estimated, not frame certified. Only
            authorised, consented and privacy-processed footage can play.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-rose-200">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-xs text-amber-200">
          {message}
        </p>
      )}
      {!availablePairs ? (
        <p className="mt-4 text-sm text-slate-400">
          Two distinct paired camera angles with eligible private clips are needed for comparison.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(["left", "right"] as const).map((side) => {
              const clip = side === "left" ? left : right;
              const selectedId = side === "left" ? leftId : rightId;
              const offset = clip ? (offsets[clip.id] ?? 0) : 0;
              return (
                <div key={side} className="min-w-0">
                  <label className="grid gap-1 text-xs text-slate-300">
                    {side === "left" ? "Reference camera" : "Second camera"}
                    <select
                      value={selectedId}
                      onChange={(event) => {
                        if (side === "left") setLeftId(event.target.value);
                        else setRightId(event.target.value);
                      }}
                      className="min-h-11 rounded-md border border-white/20 bg-[#141923] px-2 text-xs"
                    >
                      <option value="">Choose a clip</option>
                      {clips
                        .filter((item) => side === "left" || item.device_id !== left?.device_id)
                        .map((item) => (
                          <option value={item.id} key={item.id}>
                            {label(item.device_id)} ·{" "}
                            {new Date(item.started_at).toLocaleTimeString()}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-black">
                    {urls && clip ? (
                      <video
                        key={clip.id + urls[side]}
                        ref={side === "left" ? leftRef : rightRef}
                        src={urls[side]}
                        playsInline
                        controls={side === "left"}
                        preload="metadata"
                        onTimeUpdate={side === "left" ? align : undefined}
                        onSeeked={side === "left" ? align : undefined}
                        onPlay={side === "left" ? align : undefined}
                        onPause={side === "left" ? align : undefined}
                        onRateChange={side === "left" ? align : undefined}
                        onLoadedMetadata={side === "left" ? align : undefined}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-slate-400">
                        Authorise the private two-angle comparison to load footage
                      </div>
                    )}
                  </div>
                  {clip && (
                    <div className="mt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold">{label(clip.device_id)}</span>
                        <span className="text-slate-400">
                          {(side === "left" ? leftCalibrated : rightCalibrated)
                            ? "Saved manual offset"
                            : "Uncalibrated clock estimate"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                          Offset (ms)
                          <input
                            aria-label={side + " clip clock adjustment in milliseconds"}
                            type="number"
                            min={-30000}
                            max={30000}
                            step={100}
                            value={offset}
                            onChange={(event) =>
                              setOffsets((old) => ({
                                ...old,
                                [clip.id]: Number(event.target.value),
                              }))
                            }
                            className="w-28 min-h-10 rounded-md border border-white/20 bg-[#141923] px-2"
                          />
                        </label>
                        <button
                          disabled={busy || !validCalibrationOffset(offset)}
                          onClick={() => void saveOffset(clip)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-xs disabled:opacity-40"
                        >
                          <Save className="size-4" /> Save timing
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              disabled={busy || !left || !right || left.device_id === right.device_id}
              onClick={() => void startComparison()}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-300 px-4 text-xs font-bold text-black disabled:opacity-40"
            >
              <Video className="size-4" /> Open two private angles
            </button>
            <span className="text-xs text-slate-400">
              {urls
                ? overlap
                  ? "Estimated overlapping footage"
                  : "No overlapping footage at this playhead"
                : "No private video loaded"}
            </span>
          </div>
        </>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
            <Clock3 className="size-4" /> Seek a scored delivery
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            These are timestamp-based cues and should be checked against the actual video.
          </p>
          <div className="mt-2 max-h-48 space-y-1 overflow-auto">
            {left &&
              deliveries.slice(0, 120).map((delivery) => {
                const second = syncedDeliverySeconds(left, delivery, offsets[left.id] ?? 0);
                if (second === null) return null;
                return (
                  <button
                    key={delivery.id}
                    disabled={!urls}
                    onClick={() => {
                      if (leftRef.current) leftRef.current.currentTime = second;
                      setLinkedDelivery(delivery.id);
                      align();
                    }}
                    className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md bg-white/[0.05] px-3 text-left text-xs hover:bg-white/[0.09] disabled:opacity-40"
                  >
                    <span>
                      Over {delivery.over_number + 1} · Ball {delivery.ball_in_over}
                    </span>
                    <span className="text-amber-200">
                      {delivery.wicket ? "WICKET" : delivery.total_runs + " runs"}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
        <div>
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
            <Star className="size-4" /> Mark a private highlight candidate
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Saves a six-second editorial bookmark only. No AI detection, extracted media,
            publication or approval is performed.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="grid gap-1 text-xs">
              Type
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as HighlightKind)}
                className="min-h-10 rounded-md border border-white/20 bg-[#141923] px-2"
              >
                <option value="other">Moment</option>
                <option value="wicket">Wicket</option>
                <option value="boundary">Boundary</option>
                <option value="fielding">Fielding</option>
              </select>
            </label>
            <label className="grid min-w-40 flex-1 gap-1 text-xs">
              Scored delivery (optional)
              <select
                value={linkedDelivery}
                onChange={(event) => setLinkedDelivery(event.target.value)}
                className="min-h-10 rounded-md border border-white/20 bg-[#141923] px-2"
              >
                <option value="">No delivery selected</option>
                {deliveries.slice(0, 200).map((delivery) => (
                  <option key={delivery.id} value={delivery.id}>
                    Over {delivery.over_number + 1} Ball {delivery.ball_in_over}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 grid gap-1 text-xs text-slate-300">
            Private reviewer note
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={240}
              placeholder="Why is this moment worth reviewing?"
              className="min-h-11 rounded-md border border-white/20 bg-[#141923] px-3"
            />
          </label>
          <button
            disabled={busy || !urls || !left}
            onClick={() => void markHighlight()}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-amber-300/40 px-4 text-xs font-bold text-amber-200 disabled:opacity-40"
          >
            <Star className="size-4" /> Save private highlight candidate
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
            <ShieldCheck className="size-4" /> Private highlight review queue ({highlights.length})
          </h4>
          <button
            onClick={() => void refresh()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-xs"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
        </div>
        {highlights.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">
            No editorial bookmarks yet. These are private notes, not published videos.
          </p>
        )}
        <div className="mt-2 max-h-56 space-y-2 overflow-auto">
          {highlights.map((item) => {
            const clip = clips.find((candidate) => candidate.id === item.asset_id);
            if (!clip) return null;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setLeftId(clip.id);
                  setLinkedDelivery(item.delivery_id ?? "");
                  setKind(item.kind);
                  setMessage(
                    "Bookmark selected. Reopen private angles before seeking this timestamp.",
                  );
                }}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-white/[0.05] px-3 py-2 text-left text-xs"
              >
                <span className="min-w-0 truncate">
                  {label(clip.device_id)} · {item.kind} · {(item.at_ms / 1000).toFixed(1)}s
                  {item.note ? " · " + item.note : ""}
                </span>
                <span className="shrink-0 text-slate-400">Private</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
