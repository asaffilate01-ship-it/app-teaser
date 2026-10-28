import { useEffect, useState } from "react";
import { listEvidence, type EvidenceFile } from "@/lib/analysis-cloud";
import { defaultEvidenceFilters, type EvidenceFilters } from "@/lib/evidence-library";
const field = "rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white";
export function EvidenceLibrary({
  organisationId,
  matchId,
  version,
  busy,
  onOpen,
  onSelect,
  onRemove,
}: {
  organisationId: string;
  matchId: string;
  version: number;
  busy: boolean;
  onOpen: (file: EvidenceFile) => void;
  onSelect: (file: EvidenceFile) => void;
  onRemove: (file: EvidenceFile) => void;
}) {
  const [draft, setDraft] = useState<EvidenceFilters>({ ...defaultEvidenceFilters });
  const [filters, setFilters] = useState<EvidenceFilters>({ ...defaultEvidenceFilters });
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ files: EvidenceFile[]; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setResult(null);
    setError("");
    void listEvidence(organisationId, matchId, filters, page)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Evidence could not be loaded. Check your connection and club access, then try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organisationId, matchId, filters, page, version, retry]);
  return (
    <div className="mt-5 space-y-4" aria-busy={loading}>
      <form
        aria-label="Evidence library filters"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...draft });
          setPage(0);
        }}
      >
        <label className="grid gap-1 text-sm">
          Search filenames
          <input
            className={field}
            maxLength={150}
            value={draft.search}
            onChange={(e) => setDraft((f) => ({ ...f, search: e.target.value }))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Media type
          <select
            aria-label="Media type"
            className={field}
            value={draft.kind}
            onChange={(e) =>
              setDraft((f) => ({ ...f, kind: e.target.value as EvidenceFilters["kind"] }))
            }
          >
            <option value="all">Photos and videos</option>
            <option value="image">Photos only</option>
            <option value="video">Videos only</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Recorded age category
          <select
            aria-label="Recorded age category"
            className={field}
            value={draft.people}
            onChange={(e) =>
              setDraft((f) => ({ ...f, people: e.target.value as EvidenceFilters["people"] }))
            }
          >
            <option value="all">All age categories</option>
            <option value="adult">Marked adult-only</option>
            <option value="junior">Juniors or uncertain</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button type="submit" className={field}>
            Search evidence
          </button>
          <button
            type="button"
            className={field}
            onClick={() => {
              setDraft({ ...defaultEvidenceFilters });
              setFilters({ ...defaultEvidenceFilters });
              setPage(0);
            }}
          >
            Reset library filters
          </button>
        </div>
      </form>
      <p className="text-xs text-slate-400">
        Search covers unexpired evidence for this match. Age categories are recorded by the
        uploader; they are not AI estimates or permission for external analysis.
      </p>
      {loading && <p role="status">Loading evidence library…</p>}
      {error && (
        <div role="alert" className="text-sm text-amber-200">
          {error}{" "}
          <button className="underline" onClick={() => setRetry((v) => v + 1)}>
            Retry library
          </button>
        </div>
      )}
      {!loading && result && (
        <>
          {!result.files.length && (
            <p role="status" className="text-sm text-slate-400">
              No evidence on this page. Change filters or return to the previous page.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {result.files.map((f) => (
              <article key={f.id} className="min-w-0 rounded-xl border border-white/10 p-3">
                <button
                  disabled={busy}
                  className="block max-w-full truncate text-left text-emerald-300"
                  title={f.label}
                  onClick={() => onOpen(f)}
                >
                  {f.label}
                </button>
                <p className="mt-2 text-xs text-slate-400">
                  {f.kind === "image" ? "Photo" : "Video"} ·{" "}
                  {f.includes_junior
                    ? "Junior/uncertain — external AI blocked"
                    : "Marked adult-only — provider consent still required"}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    disabled={busy}
                    className="text-sm text-amber-200 underline"
                    onClick={() => onSelect(f)}
                  >
                    Use in observation
                  </button>
                  <button
                    disabled={busy}
                    className="text-xs text-slate-400 underline"
                    onClick={() => onRemove(f)}
                  >
                    Remove my upload
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          className={field}
          disabled={loading || page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous evidence
        </button>
        <span aria-live="polite">
          Evidence page {page + 1}
          {result && !loading ? ` · ${result.files.length} files` : ""}
        </span>
        <button
          className={field}
          disabled={loading || !result?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Next evidence
        </button>
      </div>
    </div>
  );
}
