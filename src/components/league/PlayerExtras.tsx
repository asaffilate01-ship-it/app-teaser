import { useEffect, useState } from "react";
import { Bell, BellOff, Film, Share2, UserCheck } from "lucide-react";
import { clipUrl } from "@/lib/analysis-cloud";
import { shareAwardCard } from "@/lib/award-card";
import { useCloudSession } from "@/hooks/use-cloud-session";
import {
  followPlayer,
  isCloudPlayerId,
  isFollowing,
  listPlayerClips,
  requestProfileClaim,
  type PlayerClip,
} from "@/lib/player-hub-cloud";

/** Share one badge as a picture card or a printable certificate. */
export function ShareAwardButton({ title, detail, playerName, team, date }: { title: string; detail: string; playerName: string; team: string; date?: string | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button type="button" className="app-chip-button" aria-label={`Share ${title}`} onClick={() => setOpen(!open)}>
        <Share2 className="size-3.5" />
      </button>
      {open && (
        <span className="absolute right-0 top-full z-10 mt-1 flex w-44 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-lg">
          {(["card", "certificate"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className="app-chip-button justify-start"
              onClick={() => {
                setOpen(false);
                void shareAwardCard({ kind, title, detail, playerName, team, date });
              }}
            >
              {kind === "card" ? "Social card" : "Certificate"}
            </button>
          ))}
          <small className="px-1 text-[10px] text-muted-foreground">Check you have permission before sharing a junior's name.</small>
        </span>
      )}
    </span>
  );
}

/** Follow, claim "this is me", and the clips this player is in. */
export function PlayerExtras({ playerId, playerName }: { playerId: string; playerName: string }) {
  const { session } = useCloudSession();
  const cloud = isCloudPlayerId(playerId);
  const [following, setFollowing] = useState(false);
  const [clips, setClips] = useState<PlayerClip[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ url: string; label: string } | null>(null);
  const [claimText, setClaimText] = useState("");
  const [claimOpen, setClaimOpen] = useState(false);

  useEffect(() => {
    if (!cloud || !session) return;
    void isFollowing(playerId).then(setFollowing).catch(() => undefined);
    void listPlayerClips(playerId).then(setClips).catch(() => setClips([]));
  }, [cloud, playerId, session]);

  if (!cloud || !session) return null;
  const toggleFollow = async () => {
    setMessage(null);
    try {
      await followPlayer(playerId, !following);
      setFollowing(!following);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change follow.");
    }
  };
  const claim = async () => {
    setMessage(null);
    try {
      await requestProfileClaim(playerId, claimText);
      setClaimOpen(false);
      setMessage("Sent. A club admin will check it and link this profile to your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The claim could not be sent.");
    }
  };
  const play = async (clip: PlayerClip) => {
    setMessage(null);
    try {
      const url = await clipUrl(clip.assetId);
      setPlaying({ url: `${url}#t=${(clip.startMs / 1000).toFixed(1)},${(clip.endMs / 1000).toFixed(1)}`, label: `${clip.over + 1}.${clip.ball}` });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That clip isn't available.");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <article className="broadcast-panel space-y-3">
        <h3 className="panel-kicker">Follow &amp; profile</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="action-secondary" onClick={() => void toggleFollow()}>
            {following ? <BellOff className="size-4" /> : <Bell className="size-4" />} {following ? "Unfollow" : `Follow ${playerName.split(" ")[0]}`}
          </button>
          <button type="button" className="action-secondary" onClick={() => setClaimOpen(!claimOpen)}>
            <UserCheck className="size-4" /> This is me
          </button>
        </div>
        {claimOpen && (
          <div className="space-y-2">
            <textarea className="scorer-input min-h-20" maxLength={300} placeholder="Anything to help the club check it's you (optional)" value={claimText} onChange={(e) => setClaimText(e.target.value)} />
            <button type="button" className="action-primary" onClick={() => void claim()}>Ask the club to link it</button>
            <p className="text-[11px] text-muted-foreground">Once linked, your runs and wickets from every club you play for show together under "My career".</p>
          </div>
        )}
        {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
      </article>
      <article className="broadcast-panel space-y-3">
        <h3 className="panel-kicker flex items-center gap-2"><Film className="size-4" aria-hidden="true" /> Clip library</h3>
        {playing && (
          <figure className="space-y-1">
            <video src={playing.url} controls autoPlay playsInline className="aspect-video w-full rounded-xl bg-black" />
            <figcaption className="text-[11px] text-muted-foreground">Ball {playing.label}</figcaption>
          </figure>
        )}
        {clips === null ? (
          <p className="text-sm text-muted-foreground">Loading clips…</p>
        ) : clips.length ? (
          <ul className="flex flex-wrap gap-2">
            {clips.map((clip) => (
              <li key={`${clip.deliveryId}-${clip.assetId}`}>
                <button type="button" className="app-chip-button" onClick={() => void play(clip)}>
                  {clip.role === "batting" ? "Bat" : "Bowl"} {clip.over + 1}.{clip.ball} · {clip.wicket ? "W" : clip.runs}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No saved camera clips yet. Clips recorded on match cameras and matched to balls appear here.</p>
        )}
      </article>
    </div>
  );
}
