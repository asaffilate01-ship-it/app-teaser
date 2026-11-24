import { useEffect, useRef, useState } from "react";
import { buildHighlightReel, type ReelDelivery } from "@/lib/highlight-reel";
import { signedRoomClipUrl } from "@/lib/camera-review-cloud";
import {
  loadMatchFootage,
  loadReplayCandidates,
  type MatchReplayFootage,
  type ReplayCandidate,
} from "@/lib/ground-screen-cloud";
import type { ReplayMode } from "@/lib/ground-board";

interface QueuedReplay {
  deliveryId: string;
  /** Give up when no recording covers the ball by then (phones upload 1-minute segments). */
  deadline: number;
}

interface PlayingReplay {
  url: string;
  start: number;
  end: number;
  label: string;
  tone: "four" | "six" | "wicket";
}

const asReelDelivery = (ball: ReplayCandidate): ReelDelivery => ({
  id: ball.id,
  sequence: ball.sequence,
  over_number: ball.over_number,
  ball_in_over: ball.ball_in_over,
  occurred_at: ball.occurred_at,
  total_runs: ball.batter_runs,
  wicket: ball.wicket,
  batter_runs: ball.batter_runs,
});

/**
 * Plays wicket and boundary replays full-screen on a ground screen that is signed in with a club account.
 * Only balls whose batter and bowler allow public highlights are ever offered (checked in the database),
 * and recordings go through the same private-recording and blurring checks as the review screens.
 */
export function GroundReplay({
  matchId,
  mode,
  requestedId,
  requestedAt,
  onStatus,
}: {
  matchId: string;
  mode: ReplayMode;
  requestedId: string | null;
  requestedAt: string | null;
  onStatus?: (text: string) => void;
}) {
  const [playing, setPlaying] = useState<PlayingReplay | null>(null);
  const candidates = useRef<ReplayCandidate[]>([]);
  const footage = useRef<MatchReplayFootage>({ clips: [], offsets: {} });
  const queue = useRef<QueuedReplay[]>([]);
  const baseline = useRef<number | null>(null);
  const mountedAt = useRef(Date.now());
  const lastRequest = useRef<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const playingRef = useRef<PlayingReplay | null>(null);
  playingRef.current = playing;

  // A replay request from the control panel joins the queue once.
  useEffect(() => {
    if (mode === "off" || !requestedId || !requestedAt) return;
    const key = `${requestedId}@${requestedAt}`;
    if (lastRequest.current === key || Date.parse(requestedAt) < mountedAt.current - 5_000) return;
    lastRequest.current = key;
    queue.current = [
      { deliveryId: requestedId, deadline: Date.now() + 3 * 60_000 },
      ...queue.current,
    ];
  }, [mode, requestedId, requestedAt]);

  useEffect(() => {
    if (mode === "off") {
      queue.current = [];
      setPlaying(null);
      return;
    }
    let active = true;
    let footageAt = 0;
    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        candidates.current = await loadReplayCandidates(matchId);
        const newest = Math.max(0, ...candidates.current.map((ball) => ball.sequence));
        if (baseline.current === null) baseline.current = newest;
        else if (mode === "auto") {
          for (const ball of [...candidates.current].reverse()) {
            if (ball.sequence > baseline.current) {
              queue.current.push({
                deliveryId: ball.id,
                deadline: Date.parse(ball.occurred_at) + 4 * 60_000,
              });
            }
          }
          baseline.current = Math.max(baseline.current, newest);
        }
        if (queue.current.length && Date.now() - footageAt > 20_000) {
          footage.current = await loadMatchFootage(matchId);
          footageAt = Date.now();
        }
        if (!active || queue.current.length === 0) return;
        if (playingRef.current) return;
        const next = queue.current[0]!;
        const ball = candidates.current.find((item) => item.id === next.deliveryId);
        const reel = ball
          ? buildHighlightReel({
              clips: footage.current.clips,
              deliveries: [asReelDelivery(ball)],
              kind: ball.wicket ? "wickets" : "boundaries",
              offsets: footage.current.offsets,
              nowMs: Date.now(),
            })
          : [];
        const item = reel[0];
        if (!item) {
          if (Date.now() > next.deadline || !ball) queue.current.shift();
          onStatus?.(
            ball
              ? "Waiting for the camera recording to upload…"
              : "That ball can't be replayed publicly.",
          );
          return;
        }
        queue.current.shift();
        const clip = footage.current.clips.find((entry) => entry.id === item.clipId)!;
        const url = await signedRoomClipUrl(clip);
        if (active)
          setPlaying({
            url,
            start: item.startSeconds,
            end: item.endSeconds,
            label: item.label,
            tone: item.tone,
          });
      } catch (error) {
        onStatus?.(error instanceof Error ? error.message : "Replay unavailable");
        queue.current.shift();
      } finally {
        busy.current = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 6_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [matchId, mode, onStatus]);

  useEffect(() => {
    if (!playing) return;
    const safety = window.setTimeout(
      () => setPlaying(null),
      (playing.end - playing.start + 10) * 1000,
    );
    return () => window.clearTimeout(safety);
  }, [playing]);

  if (!playing) return null;
  return (
    <div className="gs-replay" role="dialog" aria-label="Replay">
      <video
        ref={video}
        key={playing.url}
        src={playing.url}
        muted
        playsInline
        autoPlay
        onLoadedMetadata={(event) => {
          event.currentTarget.currentTime = playing.start;
          void event.currentTarget.play().catch(() => undefined);
        }}
        onTimeUpdate={(event) => {
          if (event.currentTarget.currentTime >= playing.end) setPlaying(null);
        }}
        onEnded={() => setPlaying(null)}
        onError={() => setPlaying(null)}
      />
      <div className={`gs-replay-tag is-${playing.tone}`}>
        <span>Replay</span>
        <strong>{playing.label}</strong>
      </div>
    </div>
  );
}
