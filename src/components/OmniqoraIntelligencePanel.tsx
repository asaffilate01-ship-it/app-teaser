import { useEffect, useState, useRef } from "react";
import { LoaderCircle, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { buildCricketPreview } from "@/lib/cricket-insights";
import type { MatchRecord } from "@/lib/platform-cloud";
import {
  intelligenceTaskOptions,
  listIntelligence,
  readIntelligence,
  requestBudgetedIntelligence,
  verifyIntelligenceConnection,
  type IntelligenceConnection,
  type IntelligenceRequest,
  type IntelligenceTask,
} from "@/lib/omniqora";

const allowedRoles = new Set([
  "owner",
  "league_admin",
  "club_admin",
  "coach",
  "safeguarding_officer",
]);

export function OmniqoraIntelligencePanel({
  organisationId,
  role,
  matches,
}: {
  organisationId: string;
  role: string;
  matches: MatchRecord[];
}) {
  const [selection, setSelection] = useState(matches[0]?.id ?? "");
  const matchId = matches.some((match) => match.id === selection)
    ? selection
    : (matches[0]?.id ?? "");
  return (
    <ScopedIntelligencePanel
      key={`${organisationId}:${role}:${matchId}`}
      organisationId={organisationId}
      role={role}
      matches={matches}
      matchId={matchId}
      setMatchId={setSelection}
    />
  );
}

function ScopedIntelligencePanel({
  organisationId,
  role,
  matches,
  matchId,
  setMatchId,
}: {
  organisationId: string;
  role: string;
  matches: MatchRecord[];
  matchId: string;
  setMatchId: (id: string) => void;
}) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [task, setTask] = useState<IntelligenceTask>("match_insights");
  const [history, setHistory] = useState<IntelligenceRequest[]>([]);
  const [historyWarning, setHistoryWarning] = useState("");
  const [report, setReport] = useState<IntelligenceRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [connection, setConnection] = useState<IntelligenceConnection | null>(null);
  const [checking, setChecking] = useState(false);
  const mayRequest = allowedRoles.has(role);
  const canStartPaid = connection?.modelExecutionReady === true;
  const selectedMatch = matches.find((item) => item.id === matchId);
  const preview = selectedMatch ? buildCricketPreview(selectedMatch, task) : null;

  useEffect(() => {
    let active = true;
    setReport(null);
    setHistory([]);
    setHistoryWarning("");
    setMessage("");
    setConnection(null);
    if (!matchId || !mayRequest) return;
    setLoading(true);
    void listIntelligence({ organisationId, matchId })
      .then((result) => {
        if (active) setHistory(result.requests);
      })
      .catch(() => {
        if (active)
          setHistoryWarning(
            "Cloud AI history is not available yet. Free match previews still work.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organisationId, matchId, mayRequest]);

  const reloadHistory = async () => {
    if (!matchId || !mayRequest) return;
    setLoading(true);
    setHistoryWarning("");
    try {
      const result = await listIntelligence({ organisationId, matchId });
      if (mounted.current) setHistory(result.requests);
    } catch {
      if (mounted.current)
        setHistoryWarning(
          "History could not be refreshed. Any confirmed run below is preserved. Retry history before starting another run.",
        );
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const verify = async () => {
    if (!matchId || !mayRequest || checking) return;
    setChecking(true);
    setMessage("");
    setConnection(null);
    try {
      const response = await verifyIntelligenceConnection({ organisationId, matchId });
      if (mounted.current) setConnection(response);
    } catch (error) {
      if (!mounted.current) return;
      setMessage(
        error instanceof Error ? error.message : "Omniqora connection is not yet verified.",
      );
    } finally {
      if (mounted.current) setChecking(false);
    }
  };

  const requestBudgeted = async () => {
    if (!matchId || !mayRequest || !canStartPaid || busy || loading) return;
    setBusy(true);
    setMessage("");
    setReport(null);
    try {
      const receipt = await requestBudgetedIntelligence({
        organisationId,
        matchId,
        task,
      });
      if (!mounted.current) return;
      setReport({ ...receipt, task });
      await reloadHistory();
    } catch (error) {
      if (!mounted.current) return;
      setMessage(
        error instanceof Error
          ? error.message
          : "The budgeted request could not be confirmed. Do not retry automatically.",
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const refresh = async (requestId: string) => {
    if (!matchId || !mayRequest || busy || loading) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await readIntelligence({ organisationId, matchId, requestId });
      if (!mounted.current) return;
      setReport(result);
      await reloadHistory();
    } catch (error) {
      if (!mounted.current) return;
      setMessage(error instanceof Error ? error.message : "Could not refresh this advisory.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-950/30 to-[#17111f] p-5 md:p-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-fuchsia-300">
          <Sparkles className="size-4" /> Intelligence by Omniqora
        </div>
        <h2 className="font-display text-3xl font-bold">Cricket AI and coaching</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          Review free, evidence-based cricket insights now. Scoped Omniqora GenAI and bounded
          analyst agents are prepared in the platform, but model execution remains blocked until
          budgeted admission, provider verification and safeguards are approved.
        </p>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          All results require human review. CricLume scoring, match publication, communications and
          player records remain outside autonomous AI control.
        </div>
      </div>

      {!mayRequest ? (
        <div className="rounded-xl border border-white/10 p-4 text-sm text-slate-300">
          A club administrator, authorised coach or safeguarding officer must request AI analysis.
        </div>
      ) : (
        <>
          {preview && (
            <div className="mb-5 space-y-3 rounded-2xl border border-emerald-400/20 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold">{preview.headline}</h3>
                <span className="rounded-full border border-emerald-300/20 px-3 py-1 text-xs text-emerald-200">
                  Free rules-based preview · No model calls
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Verified score facts
                  </p>
                  {preview.facts.map((fact) => (
                    <p key={fact} className="text-sm text-slate-200">
                      {fact}
                    </p>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    For coach discussion
                  </p>
                  {preview.coachingPrompts.map((tip) => (
                    <p key={tip} className="text-sm text-slate-200">
                      {tip}
                    </p>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400">
                {preview.limitations.join(" ")} Last match update: {preview.sourceUpdatedAt}.
              </p>
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-base font-bold">Start a reviewed AI task</h3>
              <label className="block text-xs font-medium text-slate-300" htmlFor="omniqora-match">
                Match
              </label>
              <select
                id="omniqora-match"
                value={matchId}
                onChange={(event) => setMatchId(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#17111f] px-3 py-3 text-sm"
                disabled={busy || !matches.length}
              >
                {matches.length === 0 && <option value="">No club matches yet</option>}
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.id.slice(0, 8)} · {match.status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <label className="block text-xs font-medium text-slate-300" htmlFor="omniqora-task">
                Intelligence task
              </label>
              <select
                id="omniqora-task"
                value={task}
                onChange={(event) => setTask(event.target.value as IntelligenceTask)}
                className="w-full rounded-xl border border-white/15 bg-[#17111f] px-3 py-3 text-sm"
                disabled={busy}
              >
                {intelligenceTaskOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={checking || !matchId}
                onClick={() => void verify()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-[#1d1520] disabled:opacity-50"
              >
                {checking ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                Verify Omniqora connection · No model charge
              </button>
              {connection && (
                <p
                  role="status"
                  className="rounded-xl border border-emerald-300/20 p-3 text-xs text-emerald-100"
                >
                  {canStartPaid
                    ? "Scoped access and budgeted worker readiness verified. Any run remains subject to server-side admission and budget checks."
                    : "Scoped Omniqora credential and entitlement verified. Paid execution remains disabled until the budgeted worker is ready."}
                </p>
              )}
              <button
                type="button"
                disabled={!canStartPaid || !matchId || busy || loading}
                onClick={() => void requestBudgeted()}
                title={
                  canStartPaid
                    ? "Request a capped, approved model run"
                    : "Requires independently verified budgeted Agent Factory execution"
                }
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:border-fuchsia-300"
              >
                {canStartPaid
                  ? "Request reviewed GenAI · Budget enforced"
                  : "Generate with Omniqora · Awaiting certified worker"}
              </button>
              {message && (
                <p
                  role="alert"
                  className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100"
                >
                  {message}
                </p>
              )}
              <p className="text-xs text-slate-400">
                The connection check verifies scoped access only; it does not execute a model.
                Pricing, worker availability and model suitability must be certified separately.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold">Analysis and agent history</h3>
                <button
                  type="button"
                  disabled={loading || busy || !matchId}
                  onClick={() => void reloadHistory()}
                  className="min-h-11 rounded-lg border border-white/15 px-3 text-xs disabled:opacity-50"
                >
                  {loading ? "Loading history…" : "Refresh history"}
                </button>
              </div>
              {historyWarning && (
                <p role="alert" className="text-xs text-amber-200">
                  {historyWarning}
                </p>
              )}
              {history.length === 0 && !historyWarning && !loading && Boolean(matchId) && (
                <p className="text-sm text-slate-400">No previous advisory runs for this match.</p>
              )}
              {history.map((item) => (
                <button
                  type="button"
                  key={item.requestId}
                  disabled={busy || loading}
                  onClick={() => void refresh(item.requestId)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-left text-xs hover:border-fuchsia-300/40 disabled:opacity-50"
                >
                  <span>
                    <strong className="block text-slate-100">
                      {intelligenceTaskOptions.find((option) => option.value === item.task)
                        ?.label ?? item.task}
                    </strong>
                    <span className="mt-1 block text-slate-400">
                      {item.requestedAt
                        ? new Date(item.requestedAt).toLocaleString()
                        : "Recent request"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-fuchsia-200">
                    {item.status.replaceAll("_", " ")} <RefreshCw className="size-3" />
                  </span>
                </button>
              ))}
              {report && (
                <div className="space-y-3 border-t border-white/10 pt-4 text-sm">
                  <p className="break-all text-xs text-slate-400">
                    Request reference: {report.requestId}
                  </p>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-white/15 px-3 text-xs disabled:opacity-50"
                    disabled={busy || loading}
                    onClick={() => void refresh(report.requestId)}
                  >
                    Refresh this run
                  </button>
                  <p className="text-xs font-semibold uppercase text-fuchsia-300">
                    {report.status.replaceAll("_", " ")} · Human review required
                  </p>
                  {report.summary ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-200">
                      {report.summary}
                    </p>
                  ) : (
                    <p className="text-slate-400">
                      {report.status === "stale"
                        ? "The match score has changed since this analysis was requested. The previous result is outdated."
                        : report.status === "completed"
                          ? "No structured summary was returned by the AI worker."
                          : "Omniqora has not returned a completed summary. Select this run again to refresh."}
                    </p>
                  )}
                  {report.recommendations?.length ? (
                    <ul className="list-inside list-disc space-y-2 text-slate-200">
                      {report.recommendations.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  ) : null}
                  {typeof report.reservedMinor === "number" && report.currency && (
                    <p className="rounded-xl border border-amber-300/20 p-3 text-xs text-amber-100">
                      Reserved maximum for this run:{" "}
                      {new Intl.NumberFormat("en-GB", {
                        style: "currency",
                        currency: report.currency,
                      }).format(report.reservedMinor / 100)}
                      . This is a reservation, not an actual model invoice; final usage requires a
                      verified receipt.
                    </p>
                  )}
                  {report.model && (
                    <p className="text-xs text-slate-400">
                      Model: {report.provider ? `${report.provider} /` : ""} {report.model}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
