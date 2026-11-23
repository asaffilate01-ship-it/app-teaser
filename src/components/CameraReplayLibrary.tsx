import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CirclePlay, Clock3, RefreshCw, ShieldCheck, Video } from "lucide-react";
import { CameraReplayWorkbench } from "@/components/CameraReplayWorkbench";
import { HighlightReel } from "@/components/HighlightReel";
import { estimateDeliveryCues, type CameraClip } from "@/lib/camera-review";
import { loadCameraRoomReview, signedRoomClipUrl } from "@/lib/camera-review-cloud";

interface DeviceLabel {
  id: string;
  label: string;
  angle: string;
}

export function CameraReplayLibrary({
  roomId,
  matchId,
  devices,
}: {
  roomId: string;
  matchId: string;
  devices: DeviceLabel[];
}) {
  const player = useRef<HTMLVideoElement>(null);
  const [clips, setClips] = useState<CameraClip[]>([]);
  const [deliveries, setDeliveries] = useState<
    Awaited<ReturnType<typeof loadCameraRoomReview>>["deliveries"]
  >([]);
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadCameraRoomReview(roomId, matchId);
      setClips(result.clips);
      setDeliveries(result.deliveries);
      setMessage(
        result.clips.length >= 120
          ? "Showing the latest 120 recording segments; older clips are not loaded."
          : "",
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Private recording library could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [roomId, matchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const deviceName = (id: string) => {
    const device = devices.find((item) => item.id === id);
    return device ? device.label : "Camera " + id.slice(0, 6);
  };
  const filteredClips = clips.filter(
    (clip) => selectedDevice === "all" || clip.device_id === selectedDevice,
  );
  const cues = useMemo(
    () => estimateDeliveryCues(filteredClips, deliveries, Date.now()),
    [filteredClips, deliveries],
  );
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);

  const play = async (clip: CameraClip, seconds = 0) => {
    setBusy(true);
    setError("");
    try {
      const url = await signedRoomClipUrl(clip);
      setSource(url);
      setSelectedClipId(clip.id);
      setPosition(seconds);
    } catch (reason) {
      setSource("");
      setSelectedClipId(null);
      setError(reason instanceof Error ? reason.message : "Recording cannot be played.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const video = player.current;
    if (!video || !source) return;
    const seek = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.min(Math.max(position, 0), video.duration - 0.01);
      }
      video.playbackRate = speed;
      void video.play().catch(() => {});
    };
    video.addEventListener("loadedmetadata", seek);
    if (video.readyState >= 1) seek();
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [source, position, speed]);

  return (
    <section
      aria-label="Private camera recordings and ball review"
      className="mt-6 rounded-xl border border-white/10 bg-card p-4 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Video className="size-5 text-amber-300" /> Recorded camera review
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Access-restricted stored recordings and estimated ball cue points based on device
            timestamps. These are not verified frame-level synchronization, speed measurements, or
            automated scoring decisions.
          </p>
        </div>
        <button
          disabled={loading}
          type="button"
          onClick={() => void refresh()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-3 text-sm disabled:opacity-50"
        >
          <RefreshCw className="size-4" /> Refresh clips
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-rose-500/30 p-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-xs text-amber-200">
          {message}
        </p>
      )}
      {loading && (
        <p role="status" className="mt-3 text-sm text-slate-300">
          Loading club video records…
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {source && selectedClip ? (
            <>
              <div className="overflow-hidden rounded-lg bg-black">
                <video
                  key={selectedClip.id + source}
                  ref={player}
                  src={source}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full object-contain"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{deviceName(selectedClip.device_id)}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(selectedClip.started_at).toLocaleString()} ·{" "}
                    {selectedClip.blur_mode === "none" ? "Private footage" : "Blurred derivative"}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  Playback speed
                  <select
                    value={String(speed)}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                    className="rounded-md border border-white/20 bg-card px-2 py-2 text-sm"
                  >
                    <option value="0.25">0.25×</option>
                    <option value="0.5">0.5×</option>
                    <option value="1">1×</option>
                    <option value="1.5">1.5×</option>
                    <option value="2">2×</option>
                  </select>
                </label>
              </div>
            </>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-black/40 p-5 text-center text-sm text-slate-400">
              <CirclePlay className="size-10 text-amber-300" />
              Select an eligible recording or delivery cue to play
            </div>
          )}
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-300" />
            Only current, consented files are listed. If privacy blurring was requested, playback is
            blocked until its processed blurred variant is ready. Playback links expire; refresh or
            reopen the clip if needed.
          </p>
        </div>

        <div className="min-w-0">
          <label className="grid gap-1 text-xs font-semibold text-slate-300">
            Camera angle
            <select
              value={selectedDevice}
              onChange={(event) => setSelectedDevice(event.target.value)}
              className="min-h-11 rounded-md border border-white/20 bg-card px-3 text-sm"
            >
              <option value="all">All paired cameras</option>
              {devices.map((device) => (
                <option value={device.id} key={device.id}>
                  {device.label} · {device.angle.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">
              Recorded segments ({filteredClips.length})
            </h3>
            {filteredClips.length === 0 && !loading && (
              <p className="mt-2 text-sm text-slate-400">
                No playable uploaded recordings yet. Live sharing and recording are separate.
              </p>
            )}
            <div className="mt-2 max-h-52 space-y-1 overflow-auto">
              {filteredClips.map((clip) => (
                <button
                  type="button"
                  key={clip.id}
                  disabled={busy}
                  onClick={() => void play(clip)}
                  aria-pressed={clip.id === selectedClipId}
                  className={
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs " +
                    (clip.id === selectedClipId
                      ? "bg-amber-300/15 text-amber-100"
                      : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]")
                  }
                >
                  <span className="truncate">
                    {deviceName(clip.device_id)} · {new Date(clip.started_at).toLocaleTimeString()}
                  </span>
                  <span className="shrink-0 capitalize">{clip.status}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
              <Clock3 className="size-4" /> Estimated delivery cues ({cues.length})
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Matches the scorer’s recorded time with camera segment times; check the footage before
              relying on the cue.
            </p>
            <div className="mt-2 max-h-64 space-y-1 overflow-auto">
              {cues.slice(0, 100).map((cue) => {
                const clip = clips.find((item) => item.id === cue.clipId);
                if (!clip) return null;
                return (
                  <button
                    type="button"
                    key={cue.clipId + ":" + cue.deliveryId}
                    disabled={busy}
                    onClick={() => void play(clip, cue.seekSeconds)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-white/[0.04] px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08]"
                  >
                    <span className="min-w-0 truncate">{cue.label}</span>
                    <span className="shrink-0 text-amber-200">{deviceName(cue.deviceId)}</span>
                  </button>
                );
              })}
              {cues.length === 0 && !loading && (
                <p className="py-3 text-sm text-slate-400">
                  No delivery timestamps overlap the available recordings.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <HighlightReel roomId={roomId} clips={clips} deliveries={deliveries} devices={devices} />
      <CameraReplayWorkbench
        roomId={roomId}
        clips={clips}
        deliveries={deliveries}
        devices={devices}
      />
    </section>
  );
}
