import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Film, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import {
  privateReplayDeadline,
  privateReplaySelectionCurrent,
  replaySeekPosition,
  type CameraClip,
} from "@/lib/camera-review";
import { loadClipOffsets, loadReelPlayerNames, signedRoomClipUrl } from "@/lib/camera-review-cloud";
import {
  buildHighlightReel,
  reelLength,
  type ReelDelivery,
  type ReelKind,
} from "@/lib/highlight-reel";

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
  const requestRef = useRef(0);
  const openingLock = useRef(false);
  const [kind, setKind] = useState<ReelKind>("boundaries");
  const [playerId, setPlayerId] = useState("");
  const [angle, setAngle] = useState("");
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(-1);
  const [preview, setPreview] = useState<{
    url: string;
    clip: CameraClip;
    deadline: number;
  } | null>(null);
  const [opening, setOpening] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadClipOffsets(
      roomId,
      clips.map((clip) => clip.id),
    )
      .then((value) => {
        if (active) setOffsets(value);
      })
      .catch(() => {
        if (active) setOffsets({});
      });
    return () => {
      active = false;
    };
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
    let active = true;
    void loadReelPlayerNames(playerIds)
      .then((value) => {
        if (active) setNames(value);
      })
      .catch(() => {
        if (active) setNames({});
      });
    return () => {
      active = false;
    };
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

  const closeReel = useCallback(() => {
    requestRef.current += 1;
    openingLock.current = false;
    video.current?.pause();
    setIndex(-1);
    setPreview(null);
    setPlaying(false);
    setOpening(false);
  }, []);

  // A new selection or refreshed library invalidates playback and pending URL requests.
  useEffect(() => {
    closeReel();
    return () => {
      requestRef.current += 1;
    };
  }, [reel, roomId, closeReel]);

  const current = index >= 0 ? reel[index] : undefined;
  const currentClip = clips.find((clip) => clip.id === current?.clipId);
  const source =
    preview &&
    currentClip &&
    privateReplaySelectionCurrent([preview.clip], [currentClip], preview.deadline, Date.now())
      ? preview.url
      : "";

  useEffect(() => {
    if (!preview) return;
    const expire = () => {
      if (Date.now() < preview.deadline) return;
      closeReel();
      setError("Private reel preview expired. Open the moment again to review access.");
    };
    const timer = window.setTimeout(expire, Math.max(0, preview.deadline - Date.now()));
    document.addEventListener("visibilitychange", expire);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", expire);
    };
  }, [preview, closeReel]);

  const goTo = useCallback(
    async (next: number) => {
      if (openingLock.current) return;
      const item = reel[next];
      if (!item) {
        closeReel();
        return;
      }
      const clip = clips.find((candidate) => candidate.id === item.clipId);
      const deadline = clip ? privateReplayDeadline(clip, Date.now()) : null;
      if (!clip || deadline === null) {
        closeReel();
        setError("This recording is no longer eligible for private review.");
        return;
      }
      closeReel();
      const request = ++requestRef.current;
      openingLock.current = true;
      setOpening(true);
      setError("");
      try {
        // Authorise each moment against its current clip; never reuse cached private URLs.
        const url = await signedRoomClipUrl(clip);
        if (request !== requestRef.current) return;
        if (deadline <= Date.now()) throw new Error("Preview expired. Open the moment again.");
        setIndex(next);
        setPreview({ url, clip, deadline });
      } catch (reason) {
        if (request !== requestRef.current) return;
        setError(reason instanceof Error ? reason.message : "This clip could not be played.");
      } finally {
        if (request === requestRef.current) {
          openingLock.current = false;
          setOpening(false);
        }
      }
    },
    [clips, reel, closeReel],
  );

  useEffect(() => {
    const player = video.current;
    if (!player || !current || !source) return;
    const request = requestRef.current;
    const start = () => {
      const target = replaySeekPosition(current.startSeconds, player.duration);
      if (target === null || current.startSeconds >= player.duration) {
        closeReel();
        setError("This moment falls outside the playable recording.");
        return;
      }
      player.currentTime = target;
      void player.play().catch(() => {
        if (request === requestRef.current) setError("Playback was blocked. Press Resume.");
      });
    };
    const advance = () => {
      if (request !== requestRef.current || openingLock.current) return;
      player.pause();
      void goTo(index + 1);
    };
    const tick = () => {
      if (player.currentTime >= current.endSeconds) advance();
    };
    player.addEventListener("loadedmetadata", start);
    player.addEventListener("timeupdate", tick);
    player.addEventListener("ended", advance);
    if (player.readyState >= 1) start();
    return () => {
      player.removeEventListener("loadedmetadata", start);
      player.removeEventListener("timeupdate", tick);
      player.removeEventListener("ended", advance);
    };
  }, [source, current, index, goTo, closeReel]);

  const toggle = () => {
    if (openingLock.current) return;
    const player = video.current;
    if (!source || index < 0) return void goTo(Math.max(0, index));
    if (!player) return;
    if (player.paused) {
      const request = requestRef.current;
      void player.play().catch(() => {
        if (request === requestRef.current) setError("Playback was blocked. Press Resume.");
      });
    } else {
      player.pause();
    }
  };

  const deviceName = (id: string) =>
    devices.find((item) => item.id === id)?.label ?? "Camera " + id.slice(0, 6);
  const seconds = reelLength(reel);

  return (
    <section aria-label="Automatic highlight reels" className="reel-panel">
      <header className="reel-head">
        <div>
          <h3>
            <Film className="size-5" aria-hidden="true" /> Highlight reels
          </h3>
          <p>
            Built automatically from the scorer’s balls and your recordings — 5 seconds before and
            after each moment.
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
              onClick={() => {
                closeReel();
                setKind(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {kind === "player" && (
          <label>
            Player
            <select
              value={playerId}
              onChange={(event) => {
                closeReel();
                setPlayerId(event.target.value);
              }}
            >
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
          <select
            value={angle}
            onChange={(event) => {
              closeReel();
              setAngle(event.target.value);
            }}
          >
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
            <video
              ref={video}
              src={source}
              playsInline
              muted={false}
              controls={false}
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => {
                closeReel();
                setError("Private video could not play. Reopen this moment.");
              }}
            />
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
            <button
              type="button"
              aria-label="Previous clip"
              disabled={opening || index <= 0}
              onClick={() => void goTo(index - 1)}
            >
              <SkipBack className="size-4" />
            </button>
            <button
              type="button"
              className="action-primary"
              disabled={opening || reel.length === 0}
              onClick={toggle}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}{" "}
              {opening ? "Opening…" : playing ? "Pause" : index < 0 ? "Play reel" : "Resume"}
            </button>
            <button
              type="button"
              aria-label="Next clip"
              disabled={opening || index < 0 || index >= reel.length - 1}
              onClick={() => void goTo(index + 1)}
            >
              <SkipForward className="size-4" />
            </button>
          </div>
          {(preview || opening) && (
            <button type="button" className="action-secondary mt-2" onClick={closeReel}>
              Close private reel
            </button>
          )}
        </div>
        <ol className="reel-list" aria-label="Clips in this reel">
          {reel.map((item, position) => (
            <li key={item.deliveryId}>
              <button
                type="button"
                disabled={opening}
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
        Cuts use each camera’s clock plus any timing correction saved below, so check a clip if it
        starts early or late. Reels stay private to your club staff.
      </p>
    </section>
  );
}
