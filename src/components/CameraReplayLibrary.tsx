import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CirclePlay, Clock3, RefreshCw, ShieldCheck, Video } from "lucide-react";
import { CameraReplayWorkbench } from "@/components/CameraReplayWorkbench";
import { HighlightReel } from "@/components/HighlightReel";
import { CameraSpeedReview } from "@/components/CameraSpeedReview";
import {
  currentReplaySource,
  estimateDeliveryCues,
  privateReplayDeadline,
  replaySeekPosition,
  type CameraClip,
} from "@/lib/camera-review";
import { loadCameraRoomReview, signedRoomClipUrl } from "@/lib/camera-review-cloud";
import {
  makeReviewWindow,
  nextCueLimit,
  reviewClipLimit,
  reviewCuePageSize,
  reviewDeliveryLimit,
  reviewWindowMinutes,
  type ReviewWindow,
} from "@/lib/replay-window";

interface DeviceLabel {
  id: string;
  label: string;
  angle: string;
}

type ReplayLibraryProps = {
  roomId: string;
  matchId: string;
  devices: DeviceLabel[];
};

export function CameraReplayLibrary(props: ReplayLibraryProps) {
  return <WindowedReplayLibrary key={`${props.roomId}:${props.matchId}`} {...props} />;
}

function WindowedReplayLibrary(props: ReplayLibraryProps) {
  const [reviewWindow, setReviewWindow] = useState<ReviewWindow | null>(null);
  const [start, setStart] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [windowError, setWindowError] = useState("");
  return (
    <>
      <section className="mt-6 space-y-3 rounded-xl border border-white/10 bg-card p-4">
        <h2 className="font-semibold">Recording time window</h2>
        <p className="text-xs text-slate-400">
          Review earlier overs using recorded local timestamps. Each window includes overlapping
          completed recordings and scored deliveries in that time range.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const next = makeReviewWindow(start, minutes);
            if (!next) {
              setWindowError("Choose a valid local start time and window length.");
              return;
            }
            setWindowError("");
            setReviewWindow(next);
          }}
        >
          <label className="grid min-w-0 gap-1 text-xs">
            Start (your device time zone)
            <input
              type="datetime-local"
              required
              value={start}
              className="min-h-11 w-full min-w-0 rounded-md border border-white/20 bg-card px-2 text-sm"
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Duration
            <select
              value={minutes}
              className="min-h-11 rounded-md border border-white/20 bg-card px-2 text-sm"
              onChange={(event) => setMinutes(Number(event.target.value))}
            >
              {reviewWindowMinutes.map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
            </select>
          </label>
          <button className="action-primary self-end">Review window</button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-xs text-slate-300">
            {reviewWindow
              ? `${new Date(reviewWindow.start).toLocaleString()} – ${new Date(reviewWindow.end).toLocaleString()}`
              : "Latest available recording segments and deliveries"}
          </p>
          {reviewWindow && (
            <button
              type="button"
              className="action-secondary"
              onClick={() => {
                setReviewWindow(null);
                setWindowError("");
              }}
            >
              Return to latest
            </button>
          )}
        </div>
        {windowError && (
          <p role="alert" className="text-xs text-amber-200">
            {windowError}
          </p>
        )}
      </section>
      <ScopedReplayLibrary
        key={reviewWindow ? `${reviewWindow.start}:${reviewWindow.end}` : "latest"}
        {...props}
        reviewWindow={reviewWindow}
      />
    </>
  );
}

function ScopedReplayLibrary({
  roomId,
  matchId,
  devices,
  reviewWindow,
}: ReplayLibraryProps & { reviewWindow: ReviewWindow | null }) {
  const player = useRef<HTMLVideoElement>(null);
  const [clips, setClips] = useState<CameraClip[]>([]);
  const [deliveries, setDeliveries] = useState<
    Awaited<ReturnType<typeof loadCameraRoomReview>>["deliveries"]
  >([]);
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [cueLimit, setCueLimit] = useState(reviewCuePageSize);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [deadline, setDeadline] = useState<number | null>(null);
  const sourceClip = useRef<CameraClip | null>(null);
  const playRequest = useRef(0);
  const loadRequest = useRef(0);
  const mounted = useRef(false);
  const speedRef = useRef(1);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const closePlayback = useCallback(() => {
    playRequest.current += 1;
    player.current?.pause();
    sourceClip.current = null;
    setSelectedClipId(null);
    setSource("");
    setDeadline(null);
    setBusy(false);
  }, []);

  const refresh = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true);
    setError("");
    try {
      const result = await loadCameraRoomReview(roomId, matchId, reviewWindow);
      if (!mounted.current || request !== loadRequest.current) return;
      const previous = sourceClip.current;
      if (previous) {
        const current = result.clips.find((clip) => clip.id === previous.id);
        if (!currentReplaySource(previous, current ?? null, Date.now())) {
          closePlayback();
        }
      }
      setClips(result.clips);
      setDeliveries(result.deliveries);
      setCueLimit(reviewCuePageSize);
      const limits: string[] = [];
      if (result.truncatedClips) limits.push(`latest ${reviewClipLimit} recording segments`);
      if (result.truncatedDeliveries) limits.push(`latest ${reviewDeliveryLimit} deliveries`);
      setMessage(
        limits.length
          ? `Showing the ${limits.join(" and ")} in this view. Choose a narrower or earlier time window for more coverage.`
          : "",
      );
    } catch (reason) {
      if (!mounted.current || request !== loadRequest.current) return;
      closePlayback();
      setClips([]);
      setDeliveries([]);
      setError(
        reason instanceof Error ? reason.message : "Private recording library could not be loaded.",
      );
    } finally {
      if (mounted.current && request === loadRequest.current) setLoading(false);
    }
  }, [roomId, matchId, reviewWindow, closePlayback]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      loadRequest.current += 1;
      playRequest.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    if (deadline === null) return;
    const expire = () => {
      if (Date.now() < deadline) return;
      closePlayback();
      setMessage("Private preview expired. Open the recording again to review access.");
    };
    const timer = window.setTimeout(expire, Math.max(0, deadline - Date.now()));
    document.addEventListener("visibilitychange", expire);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", expire);
    };
  }, [deadline, closePlayback]);

  const deviceName = (id: string) => {
    const device = devices.find((item) => item.id === id);
    return device ? device.label : "Camera " + id.slice(0, 6);
  };
  const filteredClips = useMemo(
    () => clips.filter((clip) => selectedDevice === "all" || clip.device_id === selectedDevice),
    [clips, selectedDevice],
  );
  const clipsById = useMemo(() => new Map(clips.map((clip) => [clip.id, clip])), [clips]);
  const cues = useMemo(
    () => estimateDeliveryCues(filteredClips, deliveries, Date.now()),
    [filteredClips, deliveries],
  );
  const selectedClip = selectedClipId ? clipsById.get(selectedClipId) : undefined;

  const play = async (clip: CameraClip, seconds = 0) => {
    const request = ++playRequest.current;
    const expires = privateReplayDeadline(clip, Date.now());
    if (expires === null) {
      closePlayback();
      setError("This recording is no longer eligible for private review.");
      return;
    }
    player.current?.pause();
    setSource("");
    setSelectedClipId(null);
    setDeadline(null);
    sourceClip.current = clip;
    setBusy(true);
    setError("");
    try {
      const url = await signedRoomClipUrl(clip);
      if (!mounted.current || request !== playRequest.current) return;
      if (expires <= Date.now()) throw new Error("Preview expired. Reopen this recording.");
      setSource(url);
      setSelectedClipId(clip.id);
      setPosition(seconds);
      setDeadline(expires);
    } catch (reason) {
      if (!mounted.current || request !== playRequest.current) return;
      closePlayback();
      setError(reason instanceof Error ? reason.message : "Recording cannot be played.");
    } finally {
      if (mounted.current && request === playRequest.current) setBusy(false);
    }
  };

  useEffect(() => {
    const video = player.current;
    if (!video || !source) return;
    const seek = () => {
      const target = replaySeekPosition(position, video.duration);
      if (target !== null) video.currentTime = target;
      video.playbackRate = speedRef.current;
      void video.play().catch(() => {});
    };
    video.addEventListener("loadedmetadata", seek);
    if (video.readyState >= 1) seek();
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [source, position]);

  useEffect(() => {
    speedRef.current = speed;
    if (player.current) player.current.playbackRate = speed;
  }, [speed, source]);

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
          disabled={loading || busy}
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
                  onError={() => {
                    closePlayback();
                    setError("Private video could not play. Reopen the clip to check access.");
                  }}
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
                <button type="button" className="action-secondary" onClick={closePlayback}>
                  Close preview
                </button>
              </div>
              {deadline !== null && (
                <CameraSpeedReview
                  key={selectedClip.id + source}
                  player={player}
                  deadline={deadline}
                />
              )}
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
              onChange={(event) => {
                closePlayback();
                setSelectedDevice(event.target.value);
                setCueLimit(reviewCuePageSize);
              }}
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
                  disabled={busy || loading}
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
              relying on the cue. Showing {Math.min(cueLimit, cues.length)} of {cues.length} cues.
            </p>
            <div className="mt-2 max-h-64 space-y-1 overflow-auto">
              {cues.slice(0, cueLimit).map((cue) => {
                const clip = clipsById.get(cue.clipId);
                if (!clip) return null;
                return (
                  <button
                    type="button"
                    key={cue.clipId + ":" + cue.deliveryId}
                    disabled={busy || loading}
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
            {cueLimit < cues.length && (
              <button
                type="button"
                className="action-secondary mt-2 w-full justify-center"
                onClick={() => setCueLimit((limit) => nextCueLimit(limit, cues.length))}
              >
                Show more delivery cues
              </button>
            )}
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
