import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleHelp, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { CheckSignIn } from "@/components/check/CheckSignIn";
import { FlagList } from "@/components/check/CheckParts";
import { Empty, OfficeCard, Pill, when } from "@/components/office/ui";
import { useCloudSession } from "@/hooks/use-cloud-session";
import {
  ballLabel,
  ballText,
  canConfirmScorecard,
  openFlags,
  oversOf,
  oversText,
  type CheckBall,
  type CheckView,
} from "@/lib/check-scoring";
import {
  confirmScorecard,
  friendlyCheck,
  loadCheckView,
  raiseCheckFlag,
  removeCheckScorer,
} from "@/lib/check-scoring-cloud";

export const Route = createFileRoute("/check/$matchId")({
  head: () => ({
    meta: [
      { title: "Check the scorecard — CricLume" },
      {
        name: "description",
        content:
          "Follow every ball as the away check scorer, query anything that looks wrong and confirm the scorecard.",
      },
      { property: "og:title", content: "Check the scorecard — CricLume" },
      { property: "og:description", content: "Away-club check scoring on CricLume." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckMatchPage,
});

function CheckMatchPage() {
  const { matchId } = Route.useParams();
  const { configured, session, loading, requestLink, signOut } = useCloudSession();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader
        area="Check scoring"
        right={
          <span className="flex items-center gap-2">
            <Link to="/check" className="app-chip-button">
              All matches
            </Link>
            {session && (
              <button
                type="button"
                className="app-chip-button hidden sm:inline-flex"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            )}
          </span>
        }
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-4xl space-y-5 px-4 py-6 pb-24 md:px-8 md:py-10"
      >
        {!configured || loading ? (
          <p className="office-meta flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Loading…
          </p>
        ) : !session ? (
          <CheckSignIn requestLink={requestLink} />
        ) : (
          <CheckMatch
            key={`${session.user.id}:${matchId}`}
            matchId={matchId}
            myUserId={session.user.id}
          />
        )}
      </main>
    </div>
  );
}

function CheckMatch({ matchId, myUserId }: { matchId: string; myUserId: string }) {
  const [view, setView] = useState<CheckView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<{ ball: CheckBall | null } | null>(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const next = await loadCheckView(matchId);
      if (id === request.current) {
        setView(next);
        setError(null);
      }
    } catch (reason) {
      if (id === request.current) setError(friendlyCheck(reason));
    }
  }, [matchId]);
  useEffect(() => {
    void reload();
    // Follow the match as it's scored.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const [inningsId, setInningsId] = useState<string | null>(null);
  const innings = view?.innings ?? [];
  const current =
    innings.find((row) => row.id === inningsId) ?? innings[innings.length - 1] ?? null;
  const overs = useMemo(
    () => (view && current ? oversOf(view.balls, current.id) : []),
    [view, current],
  );
  const flaggedBalls = useMemo(
    () => new Set((view?.flags ?? []).filter((f) => f.status === "open").map((f) => f.delivery_id)),
    [view],
  );

  if (error)
    return (
      <p role="alert" className="office-card office-meta">
        {error}
      </p>
    );
  if (!view?.match) {
    return (
      <p className="office-meta flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> Loading the match…
      </p>
    );
  }
  const { match, me } = view;
  const teamName = (teamId: string) => (teamId === match.home_team_id ? match.home : match.away);
  const open = openFlags(view.flags);
  const mine = view.checkers.find((checker) => checker.user_id === myUserId);

  return (
    <>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={match.status === "live" ? "good" : undefined}>
            {match.status.replaceAll("_", " ")}
          </Pill>
          {me.checker && (
            <Pill>
              <ShieldCheck className="mr-1 inline size-3.5" aria-hidden="true" />
              You're the check scorer — view and query only
            </Pill>
          )}
        </div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          {match.home} v {match.away}
        </h1>
        <div className="flex flex-wrap gap-2">
          {innings.map((row) => (
            <button
              key={row.id}
              type="button"
              aria-pressed={current?.id === row.id}
              onClick={() => setInningsId(row.id)}
              className={`rounded-xl border px-3 py-2 text-left text-sm ${current?.id === row.id ? "border-gold bg-gold/10" : "border-border"}`}
            >
              <span className="block text-xs text-muted-foreground">
                Innings {row.number} · {teamName(row.batting_team_id)}
              </span>
              <span className="font-display text-lg font-bold">
                {row.runs}/{row.wickets}
              </span>{" "}
              <span className="text-xs text-muted-foreground">
                ({oversText(row.legal_balls)} ov)
              </span>
            </button>
          ))}
          {innings.length === 0 && (
            <p className="office-meta">No balls scored yet. This page updates by itself.</p>
          )}
        </div>
      </header>

      {me.checker && (
        <OfficeCard
          title="Confirm the scorecard"
          description={
            mine?.confirmed_at
              ? `You confirmed this scorecard ${when(mine.confirmed_at)}. A new query will undo that.`
              : "When you agree with every ball, confirm the scorecard. All queries need an answer first."
          }
          action={
            <button
              type="button"
              className="app-chip-button"
              onClick={() => setQuery({ ball: null })}
            >
              <CircleHelp className="size-4" aria-hidden="true" /> Query the scorecard
            </button>
          }
        >
          <ConfirmBox
            disabled={!canConfirmScorecard(view.flags)}
            openCount={open.length}
            confirmed={Boolean(mine?.confirmed_at)}
            onConfirm={async (note) => {
              await confirmScorecard(matchId, note);
              await reload();
            }}
          />
        </OfficeCard>
      )}

      <OfficeCard
        title={`Queries${open.length ? ` · ${open.length} open` : ""}`}
        {...(me.home
          ? {
              description:
                "Answer each query once you've checked it. Fix the ball on the scoring screen if it was wrong.",
            }
          : {})}
      >
        <FlagList flags={view.flags} canAnswer={me.home} onChanged={() => void reload()} />
      </OfficeCard>

      <OfficeCard
        title="Ball by ball"
        {...(me.checker ? { description: "Tap Query on any ball you disagree with." } : {})}
      >
        {overs.length === 0 ? (
          <Empty>No balls in this innings yet.</Empty>
        ) : (
          <ol className="space-y-3">
            {overs.map((over) => (
              <li key={over.over} className="rounded-xl border border-border">
                <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm">
                  <span className="font-semibold">Over {over.over + 1}</span>
                  <span className="text-muted-foreground">
                    {over.runs} {over.runs === 1 ? "run" : "runs"}
                    {over.wickets ? ` · ${over.wickets} wkt` : ""}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {[...over.balls].reverse().map((ball) => (
                    <li
                      key={ball.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          {ballLabel(ball)}
                        </span>
                        <span
                          className={`text-sm font-semibold ${ball.wicket ? "text-destructive" : ""}`}
                        >
                          {ballText(ball)}
                        </span>
                        {(ball.bowler || ball.striker) && (
                          <span className="block text-xs text-muted-foreground">
                            {[ball.bowler, ball.striker].filter(Boolean).join(" to ")}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        {flaggedBalls.has(ball.id) && <Pill tone="warn">Queried</Pill>}
                        {me.checker && (
                          <button
                            type="button"
                            className="app-chip-button"
                            onClick={() => setQuery({ ball })}
                          >
                            Query
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </OfficeCard>

      <OfficeCard
        title="Check scorers"
        description="From the away club. They can follow and query the scoring, but never change it."
      >
        {view.checkers.length === 0 ? (
          <Empty>No check scorer for this match.</Empty>
        ) : (
          <ul className="space-y-2">
            {view.checkers.map((checker) => (
              <li
                key={checker.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
              >
                <span>
                  <span className="block font-semibold">
                    {checker.name}
                    {checker.user_id === myUserId ? " (you)" : ""}
                  </span>
                  <span className="office-meta">
                    {checker.confirmed_at
                      ? `Confirmed the scorecard ${when(checker.confirmed_at)}`
                      : "Not confirmed yet"}
                  </span>
                </span>
                {(me.can_name || checker.user_id === myUserId) && (
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() => {
                      void removeCheckScorer(matchId, checker.user_id)
                        .then(() => {
                          toast.success("Check scorer removed.");
                          return reload();
                        })
                        .catch((reason: unknown) => toast.error(friendlyCheck(reason)));
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />{" "}
                    {checker.user_id === myUserId ? "Stop checking" : "Remove"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>

      {query && (
        <QueryDialog
          ball={query.ball}
          onClose={() => setQuery(null)}
          onSend={async (note) => {
            await raiseCheckFlag(matchId, query.ball?.id ?? null, note);
            setQuery(null);
            toast.success("Query sent to the home scorers.");
            await reload();
          }}
        />
      )}
    </>
  );
}

function ConfirmBox({
  disabled,
  openCount,
  confirmed,
  onConfirm,
}: {
  disabled: boolean;
  openCount: number;
  confirmed: boolean;
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onConfirm(note);
      toast.success("Scorecard confirmed.");
    } catch (reason) {
      toast.error(friendlyCheck(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="confirm-note">
        Note (optional)
      </label>
      <input
        id="confirm-note"
        className="scorer-input flex-1"
        placeholder="Note (optional)"
        maxLength={500}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <button
        type="submit"
        className="action-primary inline-flex items-center justify-center gap-2"
        disabled={disabled || busy}
      >
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {disabled
          ? `${openCount} open ${openCount === 1 ? "query" : "queries"}`
          : confirmed
            ? "Confirm again"
            : "Confirm scorecard"}
      </button>
    </form>
  );
}

function QueryDialog({
  ball,
  onClose,
  onSend,
}: {
  ball: CheckBall | null;
  onClose: () => void;
  onSend: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onSend(note.trim());
    } catch (reason) {
      toast.error(friendlyCheck(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="query-title"
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="office-card w-full max-w-md space-y-3"
      >
        <h2 id="query-title" className="font-display text-xl font-bold">
          {ball ? `Query ball ${ballLabel(ball)}` : "Query the scorecard"}
        </h2>
        {ball && <p className="office-meta">Scored as: {ballText(ball)}</p>}
        <label className="block">
          <span className="office-label">What looks wrong?</span>
          <textarea
            required
            minLength={3}
            maxLength={500}
            rows={3}
            className="scorer-input min-h-24"
            placeholder="e.g. I had this as a leg-bye, not a run to the batter"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="action-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="action-primary"
            disabled={busy || note.trim().length < 3}
          >
            {busy ? "Sending…" : "Send query"}
          </button>
        </div>
      </form>
    </div>
  );
}
