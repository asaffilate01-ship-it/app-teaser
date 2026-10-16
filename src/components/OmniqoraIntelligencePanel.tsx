import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { buildCricketPreview } from "@/lib/cricket-insights";
import type { MatchRecord } from "@/lib/platform-cloud";
import {
  intelligenceTaskOptions,
  listIntelligence,
  readIntelligence,
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
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
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
  const selectedMatch = matches.find((item) => item.id === matchId);
  const preview = selectedMatch ? buildCricketPreview(selectedMatch, task) : null;

  useEffect(() => {
    if (matches.some((entry) => entry.id === matchId)) return;
    setMatchId(matches[0]?.id ?? "");
  }, [matchId, matches]);

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
          setHistoryWarning("Cloud AI history is not available yet. Free match previews still work.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organisationId, matchId, mayRequest]);

  const verify = async () => {
    if (!matchId || !mayRequest || checking) return;
    setChecking(true);
    setMessage("");
    setConnection(null);
    try {
      const response = await verifyIntelligenceConnection({ organisationId, matchId });
      setConnection(response);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Omniqora connection is not yet verified.",
      );
    } finally {
      setChecking(false);
    }
  };

  const refresh = async (requestId: string) => {
    if (!matchId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await readIntelligence({ organisationId, matchId, requestId });
      setReport(result);
      const updated = await listIntelligence({ organisationId, matchId });
      setHistory(updated.requests);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh this advisory.");
    } finally {
      setBusy(false);
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
                  Scoped Omniqora credential and entitlement verified. Paid model execution remains
                  disabled until the budgeted Agent Factory worker is authorised.
                </p>
              )}
              <button
                type="button"
                disabled
                title="Requires independently verified budgeted Agent Factory execution"
                className="w-full cursor-not-allowed rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-slate-400"
              >
                Generate with Omniqora · Awaiting budgeted execution
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
                {loading && <LoaderCircle className="size-4 animate-spin" />}
              </div>
              {historyWarning && <p className="text-xs text-amber-200">{historyWarning}</p>}
              {history.length === 0 && !historyWarning && (
                <p className="text-sm text-slate-400">No previous advisory runs for this match.</p>
              )}
              {history.map((item) => (
                <button
                  type="button"
                  key={item.requestId}
                  disabled={busy}
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
