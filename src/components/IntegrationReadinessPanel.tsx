import { useEffect, useRef, useState } from "react";
import { invokePlatformFunction } from "@/lib/cloud";
import {
  integrationReportCurrent,
  integrationReportLifetimeMs,
  integrationStatusLabels,
  parseIntegrationReport,
  summarizeIntegrationReport,
  type IntegrationReport,
} from "@/lib/integration-report";

export function IntegrationReadinessPanel({ organisationId }: { organisationId: string }) {
  return <ScopedReadinessPanel key={organisationId} organisationId={organisationId} />;
}

function ScopedReadinessPanel({ organisationId }: { organisationId: string }) {
  const mounted = useRef(false);
  const request = useRef(0);
  const locked = useRef(false);
  const [report, setReport] = useState<IntegrationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current += 1;
      locked.current = false;
    };
  }, []);

  useEffect(() => {
    if (!report) return;
    const checkFreshness = () => {
      if (!integrationReportCurrent(report, Date.now())) setStale(true);
    };
    const expiresAt = Date.parse(report.checkedAt) + integrationReportLifetimeMs;
    const timer = window.setTimeout(checkFreshness, Math.max(0, expiresAt - Date.now()));
    document.addEventListener("visibilitychange", checkFreshness);
    window.addEventListener("focus", checkFreshness);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkFreshness);
      window.removeEventListener("focus", checkFreshness);
    };
  }, [report]);

  const refresh = async () => {
    if (!mounted.current || locked.current) return;
    locked.current = true;
    const id = ++request.current;
    const active = () => mounted.current && request.current === id;
    setReport(null);
    setStale(false);
    setBusy(true);
    setError("");
    try {
      const result = await invokePlatformFunction<unknown>("integration-readiness", {
        organisationId,
      });
      if (!active()) return;
      const parsed = parseIntegrationReport(result);
      if (!parsed || !integrationReportCurrent(parsed, Date.now())) {
        setError("Invalid or expired configuration report. Check the deployed function and retry.");
        return;
      }
      setReport(parsed);
    } catch {
      if (!active()) return;
      setError(
        "Readiness could not be checked. Verify administrator access and function deployment.",
      );
    } finally {
      if (active()) {
        locked.current = false;
        setBusy(false);
      }
    }
  };

  const summary = report && !stale ? summarizeIntegrationReport(report) : null;

  return (
    <section className="rounded-2xl border border-white/10 p-5" aria-busy={busy}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Integration readiness</h3>
        <button
          type="button"
          className="action-primary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "Checking…" : "Check configuration"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Read-only configuration checks, not production release approval. Live provider acceptance
        and recovery evidence must be verified separately.
      </p>
      {busy && (
        <p role="status" className="mt-3 text-sm text-slate-300">
          Requesting a fresh configuration report…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-200">
          {error}
        </p>
      )}
      {report && (
        <p className="mt-3 text-xs text-slate-400">
          Checked {new Date(report.checkedAt).toLocaleString()} · reports expire after 10 minutes.
        </p>
      )}
      {stale && (
        <p role="status" className="mt-3 text-sm text-amber-200">
          This configuration report is no longer current. Run the checks again before relying on the
          results.
        </p>
      )}
      {report && summary && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Checks responded", summary.responded],
              ["Configured", summary.configured],
              ["Need attention", summary.needsAttention],
              ["Disabled", summary.disabled],
              ["Unverified", summary.unverified],
            ].map(([label, count]) => (
              <div key={label} className="rounded-lg border border-white/10 p-3">
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{count}</dd>
              </div>
            ))}
          </dl>
          {summary.missingChecks.length > 0 && (
            <div role="alert" className="mt-3 rounded-lg border border-amber-300/20 p-3">
              <p className="text-sm font-semibold text-amber-200">Incomplete report</p>
              <p className="mt-1 text-xs text-slate-300">
                Not returned: {summary.missingChecks.join(", ")}. Verify the deployed function
                version before relying on this report.
              </p>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.checks.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 p-3">
                <p className="text-sm font-semibold">{c.label}</p>
                <p
                  className={
                    "mt-1 text-xs font-semibold " +
                    (c.status === "missing" || c.status === "unavailable"
                      ? "text-rose-200"
                      : c.status === "verified"
                        ? "text-emerald-300"
                        : "text-amber-200")
                  }
                >
                  {integrationStatusLabels[c.status]}
                </p>
                <p className="mt-1 text-xs text-slate-400">{c.detail}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
