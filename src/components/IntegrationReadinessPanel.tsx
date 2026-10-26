import { useState } from "react";
import { invokePlatformFunction } from "@/lib/cloud";
type Report = {
  checkedAt: string;
  checks: Array<{ id: string; label: string; status: string; detail: string }>;
};
export function IntegrationReadinessPanel({ organisationId }: { organisationId: string }) {
  const [report, setReport] = useState<Report | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      setReport(await invokePlatformFunction<Report>("integration-readiness", { organisationId }));
    } catch {
      setError(
        "Readiness could not be checked. Verify administrator access and function deployment.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl border border-white/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Integration readiness</h3>
        <button className="action-primary" disabled={busy} onClick={() => void refresh()}>
          {busy ? "Checking…" : "Check configuration"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Read-only checks. Configuration presence does not establish a working provider or a
        recoverable backup.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-200">
          {error}
        </p>
      )}
      {report && (
        <>
          <p className="mt-3 text-xs text-slate-400">
            Checked {new Date(report.checkedAt).toLocaleString()}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.checks.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 p-3">
                <p className="text-sm font-semibold">
                  {c.label} · <span className="text-emerald-300">{c.status}</span>
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
