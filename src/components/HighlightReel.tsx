import { useEffect, useMemo, useRef, useState } from "react";
import { Film, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { CameraClip } from "@/lib/camera-review";
import { loadClipOffsets, loadReelPlayerNames, signedRoomClipUrl } from "@/lib/camera-review-cloud";
import { buildHighlightReel, reelLength, type ReelDelivery, type ReelKind } from "@/lib/highlight-reel";

interface DeviceLabel {
  id: string;
  label: string;
  angle: string;
}

const kinds: Array<{ id: ReelKind; label: string }> = [
  { id: "boundaries", label: "Boundaries" },
  { id: "sixes", label: "Sixes" },
  { id: "wickets", label: "Wickets" },
  { id: "player", label: "Player reel" },
];

/** Plays an automatic reel of fours, sixes, wickets or one player's moments, cut from the room's recordings. */
export function HighlightReel({
  roomId,
  clips,
  deliveries,
  devices,
}: {
  roomId: string;
  clips: CameraClip[];
  deliveries: ReelDelivery[];
  devices: DeviceLabel[];
}) {
  const video = useRef<HTMLVideoElement>(null);
  const urlCache = useRef(new Map<string, { url: string; at: number }>());
  const [kind, setKind] = useState<ReelKind>("boundaries");
  const [playerId, setPlayerId] = useState("");
  const [angle, setAngle] = useState("");
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(-1);
  const [source, setSource] = useState("");
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadClipOffsets(roomId, clips.map((clip) => clip.id)).then(setOffsets);
  }, [roomId, clips]);

  const playerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ball of deliveries) {
      if (ball.striker_id) ids.add(ball.striker_id);
      if (ball.bowler_id) ids.add(ball.bowler_id);
    }
    return [...ids];
  }, [deliveries]);

  useEffect(() => {
    void loadReelPlayerNames(playerIds).then(setNames);
  }, [playerIds]);

  const reel = useMemo(
    () =>
      buildHighlightReel({
        clips,
        deliveries,
        kind,
        playerId: playerId || null,
        offsets,
        preferDeviceId: angle || null,
        nowMs: Date.now(),
      }),
    [clips, deliveries, kind, playerId, offsets, angle],
  );

  // A new reel choice stops whatever was playing.
  useEffect(() => {
    setIndex(-1);
    setSource("");
    setPlaying(false);
  }, [reel]);

  const current = index >= 0 ? reel[index] : undefined;

  const signed = async (clipId: string) => {
    const cached = urlCache.current.get(clipId);
    if (cached && Date.now() - cached.at < 240_000) return cached.url;
    const clip = clips.find((item) => item.id === clipId);
    if (!clip) throw new Error("This recording is no longer available.");
    const url = await signedRoomClipUrl(clip);
    urlCache.current.set(clipId, { url, at: Date.now() });
    return url;
  };

  const goTo = async (next: number) => {
    const item = reel[next];
    if (!item) {
      setPlaying(false);
      setIndex(-1);
      return;
    }
    setError("");
    try {
      const url = await signed(item.clipId);
      setIndex(next);
      setSource(url);
      setPlaying(true);
      const player = video.current;
      if (player && player.currentSrc === url) {
        player.currentTime = item.startSeconds;
        void player.play().catch(() => {});
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This clip could not be played.");
      setPlaying(false);
    }
  };

  useEffect(() => {
    const player = video.current;
    if (!player || !current || !source) return;
    const start = () => {
      player.currentTime = current.startSeconds;
      void player.play().catch(() => {});
    };
    const tick = () => {
      if (player.currentTime >= current.endSeconds) void goTo(index + 1);
    };
    player.addEventListener("loadedmetadata", start);
    player.addEventListener("timeupdate", tick);
    if (player.readyState >= 1) start();
    return () => {
      player.removeEventListener("loadedmetadata", start);
      player.removeEventListener("timeupdate", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, index]);

  const toggle = () => {
    const player = video.current;
    if (index < 0) return void goTo(0);
    if (!player) return;
    if (player.paused) {
      void player.play().catch(() => {});
      setPlaying(true);
    } else {
      player.pause();
      setPlaying(false);
    }
  };

  const deviceName = (id: string) => devices.find((item) => item.id === id)?.label ?? "Camera " + id.slice(0, 6);
  const seconds = reelLength(reel);

  return (
    <section aria-label="Automatic highlight reels" className="reel-panel">
      <header className="reel-head">
        <div>
          <h3>
            <Film className="size-5" aria-hidden="true" /> Highlight reels
          </h3>
          <p>
            Built automatically from the scorer’s balls and your recordings — 5 seconds before and after each
            moment.
          </p>
        </div>
        <span className="hero-chip">
          {reel.length} clips · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </header>

      <div className="reel-controls">
        <div className="reel-kinds" role="radiogroup" aria-label="Reel type">
          {kinds.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={kind === item.id}
              className={kind === item.id ? "is-active" : ""}
              onClick={() => setKind(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {kind === "player" && (
          <label>
            Player
            <select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              <option value="">Choose a player</option>
              {playerIds
                .map((id) => ({ id, name: names[id] ?? "Player " + id.slice(0, 4) }))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Preferred angle
          <select value={angle} onChange={(event) => setAngle(event.target.value)}>
            <option value="">Any camera</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label} · {device.angle.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="reel-body">
        <div className="reel-stage">
          {source ? (
            <video ref={video} src={source} playsInline muted={false} controls={false} preload="metadata" />
          ) : (
            <div className="reel-empty">
              <Film className="size-9" aria-hidden="true" />
              {reel.length === 0
                ? kind === "player" && !playerId
                  ? "Choose a player to build their reel."
                  : "No recorded moments match yet. Record with a camera while scoring to fill this reel."
                : "Press play to watch the reel."}
            </div>
          )}
          {current && (
            <div className={`reel-caption is-${current.tone}`}>
              <strong>{current.label}</strong>
              <span>
                {index + 1}/{reel.length} · {deviceName(current.deviceId)}
              </span>
            </div>
          )}
          <div className="reel-transport">
            <button type="button" aria-label="Previous clip" disabled={index <= 0} onClick={() => void goTo(index - 1)}>
              <SkipBack className="size-4" />
            </button>
            <button type="button" className="action-primary" disabled={reel.length === 0} onClick={toggle}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />} {playing ? "Pause" : index < 0 ? "Play reel" : "Resume"}
            </button>
            <button
              type="button"
              aria-label="Next clip"
              disabled={index < 0 || index >= reel.length - 1}
              onClick={() => void goTo(index + 1)}
            >
              <SkipForward className="size-4" />
            </button>
          </div>
        </div>
        <ol className="reel-list" aria-label="Clips in this reel">
          {reel.map((item, position) => (
            <li key={item.deliveryId}>
              <button
                type="button"
                aria-current={position === index}
                className={`is-${item.tone}`}
                onClick={() => void goTo(position)}
              >
                <span>{item.label}</span>
                <small>{deviceName(item.deviceId)}</small>
              </button>
            </li>
          ))}
        </ol>
      </div>
      {error && (
        <p role="alert" className="reel-error">
          {error}
        </p>
      )}
      <p className="reel-note">
        Cuts use each camera’s clock plus any timing correction saved below, so check a clip if it starts early or
        late. Reels stay private to your club staff.
      </p>
    </section>
  );
}
