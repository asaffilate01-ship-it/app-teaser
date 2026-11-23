import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClipboardCheck } from "lucide-react";
import { openFlags, type CheckView } from "@/lib/check-scoring";
import { addCheckScorer, friendlyCheck, loadCheckView } from "@/lib/check-scoring-cloud";

/**
 * On the home scorer's screen: the away club's check scorer, how many of their queries are waiting,
 * and a link to answer them. Hidden until the match is in the cloud.
 */
export function CheckScorerStrip({ matchId }: { matchId: string }) {
  const [view, setView] = useState<CheckView | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try {
      setView(await loadCheckView(matchId));
    } catch {
      setView(null);
    }
  }, [matchId]);
  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) void reload();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  if (!view?.match) return null;
  const waiting = openFlags(view.flags).length;
  const confirmed = view.checkers.some((checker) => checker.confirmed_at);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await addCheckScorer(matchId, email.trim());
      setEmail("");
      setMessage("Check scorer added.");
      await reload();
    } catch (reason) {
      setMessage(friendlyCheck(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="broadcast-panel mb-5 space-y-3" aria-label="Away check scorer">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ClipboardCheck className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Away check scorer</span>
          {view.checkers.length === 0 ? (
            <span className="text-xs text-slate-400">None named</span>
          ) : (
            view.checkers.map((checker) => (
              <span key={checker.user_id} className="hero-chip">
                {checker.name}
                {checker.confirmed_at ? " · confirmed" : ""}
              </span>
            ))
          )}
          {waiting > 0 && (
            <span role="status" className="hero-chip">
              {waiting} {waiting === 1 ? "query" : "queries"} waiting
            </span>
          )}
          {waiting === 0 && confirmed && <span className="text-xs text-emerald-300">Scorecard confirmed</span>}
        </div>
        <Link to="/check/$matchId" params={{ matchId }} className="workspace-nav-item min-h-11">
          {waiting > 0 ? "Answer queries" : "Open check view"}
        </Link>
      </div>
      {view.me.can_name && view.checkers.length < 2 && (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row">
          <label className="sr-only" htmlFor="check-scorer-email">
            Away check scorer's email
          </label>
          <input
            id="check-scorer-email"
            type="email"
            required
            className="scorer-input flex-1"
            placeholder="Away club scorer's email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="action-secondary" disabled={busy}>
            {busy ? "Adding…" : "Add check scorer"}
          </button>
        </form>
      )}
      <p className="text-[11px] text-slate-400">
        The away club's check scorer sees every ball and can query it, but can't add or change anything. Only your scorers can.
        {message ? ` ${message}` : ""}
      </p>
    </section>
  );
}
