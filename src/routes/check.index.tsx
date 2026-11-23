import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ClipboardCheck, LoaderCircle, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { CheckSignIn } from "@/components/check/CheckSignIn";
import { Empty, OfficeCard, Pill, when } from "@/components/office/ui";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { addCheckScorer, friendlyCheck, loadCheckMatches, type CheckMatchRow } from "@/lib/check-scoring-cloud";

export const Route = createFileRoute("/check/")({
  head: () => ({
    meta: [
      { title: "Check scoring — CricLume" },
      { name: "description", content: "Away-club check scoring: follow every ball, query anything that looks wrong and confirm the scorecard." },
      { property: "og:title", content: "Check scoring — CricLume" },
      { property: "og:description", content: "Follow every ball as the away club's check scorer and confirm the scorecard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckHome,
});

function CheckHome() {
  const { configured, session, loading, requestLink, signOut } = useCloudSession();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader
        area="Check scoring"
        right={
          session ? (
            <span className="flex items-center gap-2">
              <Link to="/platform" className="app-chip-button hidden sm:inline-flex">
                My club
              </Link>
              <button type="button" className="app-chip-button" onClick={() => void signOut()}>
                Sign out
              </button>
            </span>
          ) : (
            <Link to="/" className="app-chip-button">
              Back to site
            </Link>
          )
        }
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl space-y-5 px-4 py-6 pb-24 md:px-8 md:py-10">
        {!configured || loading ? (
          <p className="office-meta flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Loading…
          </p>
        ) : !session ? (
          <CheckSignIn requestLink={requestLink} />
        ) : (
          <MatchList key={session.user.id} />
        )}
      </main>
    </div>
  );
}

function MatchList() {
  const [rows, setRows] = useState<CheckMatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setRows(await loadCheckMatches());
      setError(null);
    } catch (reason) {
      setError(friendlyCheck(reason));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (error) return <p role="alert" className="office-meta">{error}</p>;
  if (!rows) {
    return (
      <p className="office-meta flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> Loading your matches…
      </p>
    );
  }
  const checking = rows.filter((row) => row.checker);
  const toName = rows.filter((row) => !row.checker);
  return (
    <>
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold md:text-3xl">
          <ClipboardCheck className="size-6 text-gold" aria-hidden="true" /> Check scoring
        </h1>
        <p className="office-meta">
          When both teams use CricLume, the away club can send a check scorer. They see every ball as it's scored,
          query anything that looks wrong and confirm the scorecard. Only the home scorers can add or change balls.
        </p>
      </header>

      <OfficeCard title="Matches you're checking">
        {checking.length === 0 ? (
          <Empty>You're not checking any matches yet. Your club's admin or team manager can name you.</Empty>
        ) : (
          <ul className="space-y-2">
            {checking.map((row) => (
              <li key={row.match_id}>
                <Link
                  to="/check/$matchId"
                  params={{ matchId: row.match_id }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 hover:border-gold/50"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {row.home} v {row.away}
                    </span>
                    <span className="office-meta">{when(row.when_at)}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <Pill tone={row.status === "live" ? "good" : undefined}>{row.status.replaceAll("_", " ")}</Pill>
                    {row.open_flags > 0 && <Pill tone="warn">{row.open_flags} open {row.open_flags === 1 ? "query" : "queries"}</Pill>}
                    {row.confirmed && <Pill tone="good">Confirmed</Pill>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>

      {toName.length > 0 && (
        <OfficeCard
          title="Your club's away matches"
          description="Name a check scorer from your club for matches another CricLume club is hosting. They need a CricLume account with this email."
        >
          <ul className="space-y-3">
            {toName.map((row) => (
              <NameRow key={row.match_id} row={row} onDone={() => void reload()} />
            ))}
          </ul>
        </OfficeCard>
      )}
    </>
  );
}

function NameRow({ row, onDone }: { row: CheckMatchRow; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await addCheckScorer(row.match_id, email.trim());
      toast.success("Check scorer named. They'll see the match on their Check scoring page.");
      setEmail("");
      onDone();
    } catch (reason) {
      toast.error(friendlyCheck(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="block font-semibold">
            {row.home} v {row.away}
          </span>
          <span className="office-meta">{when(row.when_at)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Pill>{row.checkers === 0 ? "No check scorer" : `${row.checkers} check ${row.checkers === 1 ? "scorer" : "scorers"}`}</Pill>
          {row.checkers > 0 && (
            <Link to="/check/$matchId" params={{ matchId: row.match_id }} className="app-chip-button">
              Open
            </Link>
          )}
        </span>
      </div>
      {row.checkers < 2 && (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`check-email-${row.match_id}`}>
            Check scorer's email
          </label>
          <input
            id={`check-email-${row.match_id}`}
            type="email"
            required
            placeholder="Check scorer's email"
            className="scorer-input flex-1"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="action-secondary inline-flex items-center justify-center gap-2" disabled={busy}>
            <UserPlus className="size-4" aria-hidden="true" /> {busy ? "Adding…" : "Name check scorer"}
          </button>
        </form>
      )}
    </li>
  );
}
