import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { fetchGroundNames } from "@/lib/ground-screen-cloud";
import { fanVoteStandings, fanVoterId } from "@/lib/fan-vote";

interface Tally {
  enabled: boolean;
  open?: boolean;
  votes?: Record<string, number>;
  total?: number;
}

const myVoteKey = (slug: string) => `criclume.fan-vote.${slug}`;

/** Fans pick their Player of the Match. Only shown when the club lets names appear on public boards. */
export function FanVote({ slug }: { slug: string }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [tally, setTally] = useState<Tally>({ enabled: false });
  const [mine, setMine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setMine(window.localStorage.getItem(myVoteKey(slug)));
    const load = async () => {
      const [list, result] = await Promise.all([
        fetchGroundNames(slug),
        getCloudClient().rpc("potm_vote_tally", { p_slug: slug }),
      ]);
      if (!active) return;
      setNames(list);
      if (!result.error && result.data) setTally(result.data as unknown as Tally);
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug]);

  if (!tally.enabled || Object.keys(names).length === 0) return null;
  const rows = fanVoteStandings(tally.votes ?? {}, names);

  const vote = async (ref: string) => {
    setBusy(true);
    setError(null);
    const voter = fanVoterId(window.localStorage, () => crypto.randomUUID().replace(/-/g, ""));
    const { data, error: requestError } = await getCloudClient().rpc("cast_potm_vote", { p_slug: slug, p_ref: ref, p_voter: voter });
    setBusy(false);
    if (requestError) return setError(requestError.message);
    setTally(data as unknown as Tally);
    setMine(ref);
    window.localStorage.setItem(myVoteKey(slug), ref);
  };

  return (
    <section className="broadcast-panel" aria-label="Fans' Player of the Match">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="panel-kicker flex items-center gap-2">
          <Trophy className="size-4" aria-hidden="true" /> Fans' Player of the Match
        </p>
        <span className="scoreboard-muted text-[11px]">
          {tally.total ?? 0} vote{tally.total === 1 ? "" : "s"} · {tally.open ? "voting open" : "voting closed"}
        </span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {rows.slice(0, 12).map((row) => (
          <li key={row.ref}>
            <button
              type="button"
              disabled={!tally.open || busy}
              aria-pressed={mine === row.ref}
              onClick={() => void vote(row.ref)}
              className="fan-vote-row"
              style={{ ["--share" as string]: `${row.share}%` }}
            >
              <span className="truncate font-semibold">{row.name}</span>
              <span className="tabular-nums">{row.share}%</span>
            </button>
          </li>
        ))}
      </ul>
      {mine && tally.open && <p className="scoreboard-muted mt-2 text-[11px]">Thanks for voting. Tap another player to change your vote.</p>}
      {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
    </section>
  );
}
