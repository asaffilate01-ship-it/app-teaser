import { analysisZoneOptions } from "@/lib/analysis-ground";
import { BowlingPlacement } from "@/components/BowlingPlacement";
import { AnalysisGround } from "@/components/AnalysisGround";
import { observationErrors } from "@/lib/observation-form";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { reviewReportHtml } from "@/lib/review-report";
import { EvidenceLibrary } from "@/components/EvidenceLibrary";
import {
  coachingKeys,
  coachingOptions,
  coachingLabels,
  coachingLabel,
  emptyCoachingFields,
  filterObservations,
  observationState,
  type ObservationHistory,
  coachingCsv,
  type CoachingFields,
} from "@/lib/coaching";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  filterDeliveries,
  summarizeDeliveries,
  deliveryCsv,
  defaultAnalysisFilters,
  type AnalysisFilters,
} from "@/lib/analysis";
import {
  loadAnalysis,
  readEvidenceFile,
  uploadEvidence,
  evidenceUrl,
  removeEvidence,
  clipUrl,
  saveNote,
  type EvidenceFile,
} from "@/lib/analysis-cloud";
import type { MatchRecord, PlayerRecord } from "@/lib/platform-cloud";
const roles = new Set(["owner", "club_admin", "league_admin", "coach", "safeguarding_officer"]);
const field = "rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white";
export function CricketAnalysisWorkspace({
  organisationId,
  role,
  matches,
  players,
}: {
  organisationId: string;
  role: string;
  matches: MatchRecord[];
  players: PlayerRecord[];
}) {
  const [match, setMatch] = useState(matches[0]?.id ?? "");
  return (
    <section className="space-y-5">
      <header className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-[#2c1429] via-[#17111f] to-[#2a210e] p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
          CricLume · Analysis room
        </p>
        <h2 className="mt-2 text-3xl font-bold">Every delivery. Every angle.</h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">
          Explore recorded batting, bowling and fielding events with private photos, clips and
          coaching notes. AI observations never change the official score.
        </p>
      </header>
      {!roles.has(role) ? (
        <p>Coaching access is required.</p>
      ) : (
        <>
          {matches.length === 0 && (
            <div className="workspace-empty">
              <h3 className="text-xl">Your first analysis starts with a match</h3>
              <p>
                Create a match in Competitions, record deliveries in the scorer, then return here to
                review your team’s performance.
              </p>
            </div>
          )}
          <label className="flex flex-col gap-2 text-sm">
            Match
            <select className={field} value={match} onChange={(e) => setMatch(e.target.value)}>
              <option value="">Choose a match</option>
              {matches.map((m, i) => (
                <option key={m.id} value={m.id}>
                  Match {i + 1} ·{" "}
                  {m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString() : m.id.slice(0, 8)}{" "}
                  · {m.status}
                </option>
              ))}
            </select>
          </label>
          {match && matches.some((m) => m.id === match) && (
            <MatchAnalysis
              key={`${organisationId}:${match}`}
              org={organisationId}
              match={match}
              players={players}
            />
          )}
        </>
      )}
    </section>
  );
}
function MatchAnalysis({
  org,
  match,
  players,
}: {
  org: string;
  match: string;
  players: PlayerRecord[];
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAnalysis>> | null>(null);
  const [filters, setFilters] = useState<AnalysisFilters>({ ...defaultAnalysisFilters });
  const [page, setPage] = useState(0);
  const [spatialDelivery, setSpatialDelivery] = useState("");
  const deliveryTable = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [clipSelection, setClipSelection] = useState<{ deliveryId: string; index: number } | null>(
    null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [junior, setJunior] = useState(true);
  const [preview, setPreview] = useState<{ url: string; kind: string; label: string } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewOrigin = useRef<HTMLElement | null>(null);
  const previewRequest = useRef(0);
  const closePreview = () => {
    previewRequest.current += 1;
    setPreview(null);
    setClipSelection(null);
  };
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState("");
  const errorSummary = useRef<HTMLDivElement>(null);
  const focusErrors = () => window.requestAnimationFrame(() => errorSummary.current?.focus());
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [delivery, setDelivery] = useState("");
  const [search, setSearch] = useState("");
  const [annotations, setAnnotations] = useState<CoachingFields>({ ...emptyCoachingFields });
  const [source, setSource] = useState("");
  const [sourceTime, setSourceTime] = useState("");
  const selectedSourceRef = useRef(source);
  selectedSourceRef.current = source;
  const [notePage, setNotePage] = useState(0);
  const [history, setHistory] = useState<ObservationHistory>("current");
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void loadAnalysis(org, match, selectedSourceRef.current)
      .then((r) => {
        if (active) {
          setData(r);
          setRefreshedAt(new Date().toISOString());
          setPreview(null);
          setClipSelection(null);
          setPage(0);
          setNotePage(0);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Evidence could not be loaded. Check your connection or ask your club administrator to confirm access.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [org, match, version]);
  useEffect(() => {
    setPreviewFailed(false);
    if (!preview) return;
    const t = window.setTimeout(() => {
      previewRequest.current += 1;
      setPreview(null);
      setNotice("Private preview closed after 60 seconds. Open the source again to continue.");
    }, 60000);
    return () => window.clearTimeout(t);
  }, [preview]);
  const rows = useMemo(
    () => filterDeliveries(data?.deliveries ?? [], filters, data?.mediaIds, data?.notes),
    [data, filters],
  );
  const summary = summarizeDeliveries(rows);
  const visibleDeliveryIds = new Set(rows.map((d) => d.id));
  const currentDeliveryIds = new Set((data?.deliveries ?? []).map((d) => d.id));
  const visibleNotes = filterObservations(
    data?.notes ?? [],
    filters.discipline,
    filters.coaching ?? emptyCoachingFields,
    search,
    history,
    currentDeliveryIds,
    visibleDeliveryIds,
  );
  const staleDelivery = Boolean(delivery && !currentDeliveryIds.has(delivery));
  const staleSource = Boolean(source && !data?.files.some((f) => f.id === source));
  const formErrors = submitted
    ? observationErrors({
        note,
        time: sourceTime,
        sourceKind: data?.files.find((f) => f.id === source)?.kind,
        staleSource,
        staleDelivery,
      })
    : {};
  const errorFor = (key: keyof typeof formErrors) =>
    formErrors[key] ? (
      <span id={`observation-${key}-error`} className="text-sm text-amber-200">
        {formErrors[key]}
      </span>
    ) : null;
  const fieldAccessibility = (key: keyof typeof formErrors) => ({
    id: `observation-${key}`,
    "aria-invalid": Boolean(formErrors[key]),
    "aria-describedby": formErrors[key] ? `observation-${key}-error` : undefined,
  });
  useEffect(() => {
    setNotePage(0);
  }, [filters, search, history]);
  const names = new Map(players.map((p) => [p.id, p.name]));
  const update = <K extends keyof AnalysisFilters>(k: K, v: AnalysisFilters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(0);
  };
  const options = (key: "innings_id" | "delivery_style" | "shot_zone" | "fielding_zone") =>
    Array.from(
      new Set((data?.deliveries ?? []).map((d) => d[key]).filter((v): v is string => Boolean(v))),
    );
  const select = (
    label: string,
    key: "player" | "innings" | "style" | "zone" | "outcome",
    items: Array<[string, string]>,
  ) => (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <select
        aria-label={label}
        className={field}
        value={filters[key]}
        onChange={(e) => update(key, e.target.value)}
      >
        <option value="">All</option>
        {items.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
  const action = async (fn: () => Promise<void>) => {
    if (!preview) previewOrigin.current = document.activeElement as HTMLElement;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Check your permissions.");
    } finally {
      setBusy(false);
    }
  };
  const showFile = (f: EvidenceFile, seconds: number | null = null) =>
    action(async () => {
      setClipSelection(null);
      const url = await evidenceUrl(f);
      setPreview({
        url: seconds !== null && f.kind === "video" ? `${url}#t=${seconds}` : url,
        kind: f.kind,
        label: f.label,
      });
    });
  const showClip = (id: string, index = 0) =>
    action(async () => {
      const request = ++previewRequest.current;
      const c = data?.clips.filter((c) => c.delivery_id === id)[index];
      setClipSelection({ deliveryId: id, index });
      if (c) {
        const url = await clipUrl(c.asset_id);
        if (request !== previewRequest.current) return;
        setPreview({
          url: `${url}#t=${c.offset_start_ms / 1000},${c.offset_end_ms / 1000}`,
          kind: "video",
          label: `Delivery clip · Camera view ${index + 1}`,
        });
      }
    });
  const exportCsv = (notes = false) => {
    const url = URL.createObjectURL(
      new Blob(
        [
          notes
            ? coachingCsv(
                visibleNotes.map((n) => ({
                  ...n,
                  delivery_state: observationState(n.delivery_id, currentDeliveryIds),
                })),
              )
            : deliveryCsv(rows),
        ],
        {
          type: "text/csv;charset=utf-8",
        },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `criclume-${filters.discipline}${notes ? "-observations" : ""}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportReport = () => {
    if (!data || !refreshedAt || !data.workspaceAvailable || loading) return;
    const html = reviewReportHtml({
      organisationId: org,
      matchId: match,
      loadedAt: refreshedAt,
      generatedAt: new Date().toISOString(),
      filters,
      history,
      search,
      deliveries: data.deliveries,
      notes: data.notes,
      mediaIds: data.mediaIds,
    });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `criclume-${filters.discipline}-review.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Review report downloaded. It includes saved private notes; open it in a browser to print or save as PDF.",
    );
  };
  if (!data)
    return (
      <section className="workspace-empty" aria-busy={loading} aria-live="polite">
        <h3 className="text-xl">
          {loading ? "Loading your match evidence" : "Match evidence unavailable"}
        </h3>
        <p>{loading ? "Preparing recorded deliveries, linked clips and coaching notes…" : error}</p>
        {loading ? (
          <div className="grid w-full grid-cols-3 gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/10" />
            ))}
          </div>
        ) : (
          <button className="action-primary" onClick={() => setVersion((v) => v + 1)}>
            Try again
          </button>
        )}
      </section>
    );
  return (
    <div className="space-y-5" aria-busy={loading || busy}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400" role="status">
          {loading
            ? "Refreshing match evidence…"
            : `Evidence loaded at ${refreshedAt ? new Date(refreshedAt).toLocaleTimeString() : "—"}. Refresh after scoring changes.`}
        </p>
        <button
          className={field}
          disabled={loading || busy}
          onClick={() => setVersion((v) => v + 1)}
        >
          Refresh match evidence
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-amber-400/30 p-3 text-amber-200">
          {error}{" "}
          <button
            type="button"
            className="ml-3 underline"
            disabled={loading}
            onClick={() => setVersion((v) => v + 1)}
          >
            Reload evidence
          </button>
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-200"
        >
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(["batting", "bowling", "fielding"] as const).map((d) => (
          <button
            type="button"
            key={d}
            aria-pressed={filters.discipline === d}
            className={`rounded-full border px-5 py-2 capitalize ${filters.discipline === d ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-white/15 text-slate-300"}`}
            onClick={() => {
              setFilters({ ...defaultAnalysisFilters, discipline: d });
              setPage(0);
            }}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-300">Refine the evidence you want to review.</p>
        <button
          type="button"
          className="rounded-lg border border-white/15 px-3 py-2 text-sm"
          onClick={() => {
            setFilters({ ...defaultAnalysisFilters, discipline: filters.discipline });
            setPage(0);
          }}
        >
          Reset filters
        </button>
      </div>
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-2 lg:grid-cols-4">
        {select(
          filters.discipline === "batting"
            ? "Batter"
            : filters.discipline === "bowling"
              ? "Bowler"
              : "Fielder",
          "player",
          players.map((p) => [p.id, p.name]),
        )}
        {select(
          "Innings",
          "innings",
          options("innings_id").map((id, i) => [id, `Innings ${i + 1}`]),
        )}
        {select(
          "Bowling style",
          "style",
          options("delivery_style").map((v) => [v, v]),
        )}
        {select("Zone", "zone", analysisZoneOptions(data.deliveries, filters.discipline))}
        {select("Outcome", "outcome", [
          ["wickets", "Wicket events"],
          ["boundaries", "Boundaries"],
          ["dots", "Dot deliveries"],
        ])}
        {(["fromOver", "toOver"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs text-slate-400">
            {k === "fromOver" ? "From over (0-based)" : "To over (0-based)"}
            <input
              className={field}
              type="number"
              min="0"
              value={filters[k]}
              onChange={(e) => update(k, e.target.value)}
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.mediaOnly}
            onChange={(e) => update("mediaOnly", e.target.checked)}
          />
          Linked clips only
        </label>
      </div>
      <fieldset className="rounded-2xl border border-white/10 p-4">
        <legend className="px-2 text-sm font-semibold">Coach observation filters</legend>
        <p className="mb-3 text-xs text-slate-400">
          Matches classifications recorded together in one human observation for this discipline.
          Unannotated deliveries are excluded when a filter is selected.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {coachingKeys.map((key) => (
            <label key={key} className="grid gap-1 text-xs text-slate-400">
              {coachingLabels[key]}
              <select
                aria-label={`Filter ${coachingLabels[key].toLowerCase()}`}
                className={field}
                disabled={!data.workspaceAvailable}
                value={filters.coaching?.[key] ?? ""}
                onChange={(e) =>
                  update("coaching", {
                    ...emptyCoachingFields,
                    ...filters.coaching,
                    [key]: e.target.value,
                  })
                }
              >
                <option value="">All recorded values</option>
                {coachingOptions[key].map((value) => (
                  <option key={value} value={value}>
                    {coachingLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Object.entries(summary).map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs capitalize text-slate-400">{k.replace(/([A-Z])/g, " $1")}</p>
            <strong className="text-2xl">{v}</strong>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        Recorded events only. Team runs include extras; wicket events include run-outs and are not
        bowler wickets.
      </p>
      <AnalysisGround
        inningsIds={options("innings_id")}
        playerNames={names}
        notes={data.notes}
        onReviewDelivery={(id) => {
          setSpatialDelivery(id);
          setPage(Math.max(0, Math.floor(rows.findIndex((r) => r.id === id) / 30)));
          window.requestAnimationFrame(() => {
            deliveryTable.current?.scrollIntoView({ block: "start" });
            document.getElementById(`delivery-${id}`)?.focus({ preventScroll: true });
          });
        }}
        rows={rows}
        discipline={filters.discipline}
        activeZone={filters.zone}
        onReviewZone={(zone) => {
          update("zone", zone);
          window.requestAnimationFrame(() => {
            deliveryTable.current?.scrollIntoView({ block: "start" });
            deliveryTable.current?.focus({ preventScroll: true });
          });
        }}
        onClearZone={() => {
          update("zone", "");
          window.requestAnimationFrame(() => {
            deliveryTable.current?.scrollIntoView({ block: "start" });
            deliveryTable.current?.focus({ preventScroll: true });
          });
        }}
      />
      {filters.discipline === "bowling" && (
        <BowlingPlacement
          rows={rows}
          notes={data.notes}
          inningsIds={options("innings_id")}
          names={names}
          mediaIds={data.mediaIds}
          busy={busy || loading}
          onPlayClip={(id) => void showClip(id)}
        />
      )}
      <div
        ref={deliveryTable}
        className="overflow-x-auto rounded-xl border border-white/10"
        role="region"
        aria-label="Recorded deliveries; scroll horizontally for more columns"
        tabIndex={0}
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs text-slate-400">
            <tr>
              {[
                "Ball",
                "Batter",
                filters.discipline === "fielding" ? "Fielder" : "Bowler",
                "Runs",
                "Outcome",
                "Evidence",
              ].map((x) => (
                <th key={x} className="p-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 30, page * 30 + 30).map((d) => (
              <tr
                key={d.id}
                id={`delivery-${d.id}`}
                tabIndex={-1}
                className={`border-t border-white/5 ${spatialDelivery === d.id ? "bg-amber-200/10" : ""}`}
              >
                <td className="p-3">
                  {d.over_number}.{d.ball_in_over}
                </td>
                <td className="p-3">{names.get(d.striker_id) ?? "Player"}</td>
                <td className="p-3">
                  {filters.discipline === "fielding"
                    ? d.fielder_id
                      ? (names.get(d.fielder_id) ?? "Fielder")
                      : "Not recorded"
                    : (names.get(d.bowler_id) ?? "Player")}
                </td>
                <td className="p-3">{d.total_runs}</td>
                <td className="p-3">{d.wicket ? "Wicket" : d.outcome}</td>
                <td className="p-3">
                  {data?.mediaIds.has(d.id) ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="text-emerald-300 underline"
                      onClick={() => void showClip(d.id)}
                    >
                      Play clip · {data.clips.filter((c) => c.delivery_id === d.id).length} view(s)
                    </button>
                  ) : (
                    "No linked clip"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-5 text-slate-400">
            {data
              ? "No deliveries match your filters."
              : error
                ? "Evidence unavailable."
                : "Loading recorded deliveries…"}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button className={field} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span role="status" aria-live="polite">
          {rows.length} matching deliveries · Page{" "}
          {Math.min(page + 1, Math.max(1, Math.ceil(rows.length / 30)))} of{" "}
          {Math.max(1, Math.ceil(rows.length / 30))}
        </span>
        <button
          className={field}
          disabled={(page + 1) * 30 >= rows.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
        <button className={field} disabled={!rows.length} onClick={() => exportCsv()}>
          Export filtered CSV
        </button>
      </div>
      <section className="rounded-2xl border border-white/10 p-5">
        <h3 className="text-lg font-semibold">Private photos and videos</h3>
        <p className="mt-1 text-xs text-slate-400">
          Up to 50 MB per file. 90-day retention. Browse all available evidence below. Uploading
          does not send media to an AI provider.
        </p>
        {data && !data.workspaceAvailable ? (
          <p className="mt-3 text-amber-200">Evidence storage needs the analysis migration.</p>
        ) : (
          data && (
            <>
              <label className="mt-4 block text-sm">
                Choose evidence
                <input
                  className="mt-2 block max-w-full"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="mt-3 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I have permission to upload and use this evidence for coaching.
              </label>
              <label className="mt-2 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={junior}
                  onChange={(e) => setJunior(e.target.checked)}
                />
                Contains juniors or age is uncertain
              </label>
              <button
                className="action-primary mt-4"
                disabled={!file || !consent || busy}
                onClick={() =>
                  void action(async () => {
                    if (file) {
                      await uploadEvidence(org, match, file, consent, junior);
                      setFile(null);
                      setNotice("Evidence uploaded. It is private and has not been sent to AI.");
                      setVersion((v) => v + 1);
                    }
                  })
                }
              >
                Upload evidence
              </button>
              <EvidenceLibrary
                organisationId={org}
                matchId={match}
                version={version}
                busy={busy || loading}
                onOpen={(f) => void showFile(f)}
                onSelect={(f) => {
                  setData((previous) =>
                    previous
                      ? {
                          ...previous,
                          files: previous.files.some((item) => item.id === f.id)
                            ? previous.files
                            : [...previous.files, f],
                        }
                      : previous,
                  );
                  setSource(f.id);
                  setSourceTime("");
                  setNotice(
                    `Source selected: ${f.label}. Continue in Coaching observations below.`,
                  );
                }}
                onRemove={(f) => {
                  if (
                    window.confirm("Remove this private evidence? Only the uploader can remove it.")
                  )
                    void action(async () => {
                      setPreview(null);
                      await removeEvidence(f);
                      setNotice("Evidence removed.");
                      setVersion((v) => v + 1);
                    });
                }}
              />
            </>
          )
        )}
        {preview && (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) closePreview();
            }}
          >
            <DialogContent
              className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl border-white/20 bg-slate-950 text-white"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (previewOrigin.current?.isConnected) previewOrigin.current.focus();
              }}
            >
              <DialogTitle className="break-words pr-12">{preview.label}</DialogTitle>
              <DialogDescription className="text-slate-300">
                Private evidence preview. Closes after 60 seconds; reopen the source to continue.
              </DialogDescription>
              {busy && (
                <p role="status" className="text-sm text-slate-300">
                  Loading camera view…
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-amber-200">
                  {error}
                </p>
              )}
              {clipSelection && (
                <label className="mb-3 grid gap-2 text-sm">
                  Camera view
                  <select
                    className={field}
                    value={clipSelection.index}
                    disabled={busy}
                    onChange={(e) =>
                      void showClip(clipSelection.deliveryId, Number(e.target.value))
                    }
                  >
                    {data.clips
                      .filter((c) => c.delivery_id === clipSelection.deliveryId)
                      .map((c, index) => (
                        <option key={`${c.asset_id}:${index}`} value={index}>
                          Camera view {index + 1}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {previewFailed && (
                <p role="alert" className="text-sm text-amber-200">
                  This media could not be played or displayed. Close and reopen the source for a
                  fresh link. If it still fails, check the file format and your connection.
                </p>
              )}
              {preview.kind === "image" ? (
                <img
                  src={preview.url}
                  onError={() => setPreviewFailed(true)}
                  alt={preview.label}
                  className="max-h-[60dvh] w-full rounded-xl object-contain"
                />
              ) : (
                <video
                  src={preview.url}
                  onError={() => setPreviewFailed(true)}
                  controls
                  preload="metadata"
                  className="max-h-96 w-full rounded-xl"
                />
              )}
            </DialogContent>
          </Dialog>
        )}
      </section>
      <section className="rounded-2xl border border-white/10 p-5">
        <h3 className="text-lg font-semibold">Coaching observations</h3>
        {!data.workspaceAvailable && (
          <p role="status" className="mt-3 text-sm text-amber-200">
            Coaching storage is unavailable. Ask your club administrator to confirm access and apply
            the latest workspace update.
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          Human observations, separate from official scores. Classifications describe what a coach
          recorded, not AI measurements. Delivery notes follow the filters above; whole-match notes
          remain visible.
        </p>
        <div className="mt-4 grid gap-3">
          <form
            aria-label="Save coaching observation"
            className="grid gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || loading || !data.workspaceAvailable) return;
              setSubmitted(true);
              setSaveError("");
              const invalid = observationErrors({
                note,
                time: sourceTime,
                sourceKind: data.files.find((f) => f.id === source)?.kind,
                staleSource,
                staleDelivery,
              });
              if (Object.keys(invalid).length) {
                focusErrors();
                return;
              }
              void action(async () => {
                try {
                  await saveNote(
                    org,
                    match,
                    filters.discipline,
                    note,
                    tags,
                    delivery,
                    annotations,
                    source,
                    sourceTime,
                  );
                  setNote("");
                  setTags("");
                  setAnnotations({ ...emptyCoachingFields });
                  setSource("");
                  setSourceTime("");
                  setSubmitted(false);
                  setNotice(
                    "Coaching observation saved. Clear filters if it is not visible below.",
                  );
                  setVersion((v) => v + 1);
                } catch {
                  setSaveError(
                    "Your observation was not saved. Your draft is preserved. Check your connection and club access, then try again.",
                  );
                  focusErrors();
                }
              });
            }}
          >
            {(Object.keys(formErrors).length > 0 || saveError) && (
              <div
                ref={errorSummary}
                tabIndex={-1}
                role="alert"
                aria-labelledby="observation-error-title"
                className="rounded-xl border border-amber-400/40 p-4 text-amber-100"
              >
                <h4 id="observation-error-title" className="font-semibold">
                  Check your observation
                </h4>
                {saveError && <p>{saveError}</p>}
                <ul className="mt-2 list-inside list-disc">
                  {Object.entries(formErrors).map(([key, message]) => (
                    <li key={key}>
                      <a
                        className="underline"
                        href={`#observation-${key}`}
                        onClick={(event) => {
                          event.preventDefault();
                          document.getElementById(`observation-${key}`)?.focus();
                        }}
                      >
                        {message}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <fieldset disabled={busy || loading} className="grid min-w-0 gap-3">
              <legend className="sr-only">Observation details</legend>
              <label className="grid gap-1 text-sm">
                Delivery (optional)
                <select
                  {...fieldAccessibility("delivery")}
                  className={field}
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                >
                  <option value="">Whole match</option>
                  {staleDelivery && (
                    <option value={delivery}>
                      Selected delivery is no longer current — choose another
                    </option>
                  )}
                  {(data?.deliveries ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.over_number}.{d.ball_in_over} · {names.get(d.striker_id) ?? "Player"}
                    </option>
                  ))}
                </select>
                {errorFor("delivery")}
              </label>
              <fieldset className="grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-2">
                <legend className="px-2 text-sm">Classify this observation (optional)</legend>
                {coachingKeys.map((key) => (
                  <label key={key} className="grid gap-1 text-sm">
                    {coachingLabels[key]}
                    <select
                      aria-label={`Record ${coachingLabels[key].toLowerCase()}`}
                      className={field}
                      value={annotations[key]}
                      onChange={(e) => setAnnotations((a) => ({ ...a, [key]: e.target.value }))}
                    >
                      <option value="">Not recorded</option>
                      {coachingOptions[key].map((value) => (
                        <option key={value} value={value}>
                          {coachingLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </fieldset>
              <label className="grid gap-1 text-sm">
                Source photo or video (optional)
                <select
                  {...fieldAccessibility("source")}
                  aria-label="Observation source"
                  className={field}
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setSourceTime("");
                  }}
                >
                  <option value="">No source linked</option>
                  {staleSource && (
                    <option value={source}>Selected source unavailable — choose another</option>
                  )}
                  {data.files.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} · {f.kind}
                    </option>
                  ))}
                </select>
                {errorFor("source")}
              </label>
              {data.files.find((f) => f.id === source)?.kind === "video" && (
                <label className="grid gap-1 text-sm">
                  Video time (whole seconds, optional)
                  <input
                    className={field}
                    {...fieldAccessibility("time")}
                    type="number"
                    min="0"
                    max="86400"
                    step="1"
                    value={sourceTime}
                    onChange={(e) => setSourceTime(e.target.value)}
                  />
                  {errorFor("time")}
                </label>
              )}
              <label className="grid gap-1 text-sm">
                Observation
                <textarea
                  {...fieldAccessibility("note")}
                  className={field}
                  maxLength={3000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {errorFor("note")}
                <span className="text-xs text-slate-400">
                  3–3000 characters · {note.length}/3000 used
                </span>
              </label>
              <label className="grid gap-1 text-sm">
                Additional tags
                <input
                  className={field}
                  maxLength={300}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </label>
              {(staleDelivery || staleSource) && (
                <p role="alert" className="text-sm text-amber-200">
                  Your draft is preserved. Choose a current delivery or available source before
                  saving.
                </p>
              )}
            </fieldset>
            <button
              type="submit"
              className="action-primary justify-self-start"
              disabled={busy || loading || !data.workspaceAvailable}
            >
              {busy ? "Saving…" : `Save ${filters.discipline} note`}
            </button>
          </form>
          <label className="grid gap-1 text-sm">
            Observation history
            <select
              className={field}
              aria-label="Observation history"
              value={history}
              onChange={(e) => setHistory(e.target.value as ObservationHistory)}
            >
              <option value="current">Current deliveries and whole match</option>
              <option value="historical">No-longer-current deliveries</option>
              <option value="all">Current and historical observations</option>
            </select>
          </label>
          {history !== "current" && (
            <p className="text-xs text-amber-200">
              Historical observations are preserved for review. They follow discipline,
              classification and text filters; current player, over and outcome filters cannot be
              applied to them. They never contribute to delivery statistics.
            </p>
          )}
          <label className="grid gap-1 text-sm">
            Search notes and tags
            <input className={field} value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className={field}
            disabled={notePage === 0}
            onClick={() => setNotePage((p) => p - 1)}
          >
            Previous observations
          </button>
          <p role="status" className="text-xs text-slate-300">
            {visibleNotes.length} matching observations · Page {notePage + 1} of{" "}
            {Math.max(1, Math.ceil(visibleNotes.length / 20))}
          </p>
          <button
            className={field}
            disabled={(notePage + 1) * 20 >= visibleNotes.length}
            onClick={() => setNotePage((p) => p + 1)}
          >
            Next observations
          </button>
          <button className={field} disabled={!visibleNotes.length} onClick={() => exportCsv(true)}>
            Export observations CSV
          </button>
          <button
            className={field}
            disabled={busy || loading || !data.workspaceAvailable}
            onClick={exportReport}
          >
            Download review report
          </button>
        </div>
        {data.workspaceAvailable && !visibleNotes.length && (
          <p className="mt-4 text-sm text-slate-400">
            No observations match this discipline and these filters.
          </p>
        )}
        <div className="mt-4 space-y-3">
          {visibleNotes.slice(notePage * 20, notePage * 20 + 20).map((n) => (
            <article key={n.id} className="rounded-xl border border-white/10 p-4">
              <p className="whitespace-pre-wrap text-sm">{n.note}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {coachingKeys
                  .filter((key) => n[key])
                  .map((key) => (
                    <span
                      key={key}
                      className="rounded-full border border-amber-300/20 px-2 py-1 text-xs text-amber-200"
                    >
                      {coachingLabels[key]}: {coachingLabel(n[key]!)}
                    </span>
                  ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {n.delivery_id
                  ? (() => {
                      const d = data.deliveries.find((d) => d.id === n.delivery_id);
                      return d
                        ? `Delivery ${d.over_number}.${d.ball_in_over}`
                        : "Delivery no longer current";
                    })()
                  : "Whole match"}
              </p>
              {n.evidence_file_id && (
                <button
                  className="mt-2 text-sm text-emerald-200 underline"
                  disabled={busy || loading}
                  onClick={() =>
                    void action(async () => {
                      const f = await readEvidenceFile(org, match, n.evidence_file_id!);
                      if (!f) throw new Error("Source unavailable, expired or removed.");
                      setClipSelection(null);
                      const url = await evidenceUrl(f);
                      setPreview({
                        url:
                          f.kind === "video" && n.evidence_time_seconds !== null
                            ? `${url}#t=${n.evidence_time_seconds}`
                            : url,
                        kind: f.kind,
                        label: f.label,
                      });
                    })
                  }
                >
                  Open linked source
                  {n.evidence_time_seconds !== null ? ` · ${n.evidence_time_seconds}s` : ""}
                </button>
              )}

              {!n.evidence_file_id && n.evidence_time_seconds !== null && (
                <p className="mt-2 text-xs text-slate-400">
                  Source removed · recorded time {n.evidence_time_seconds}s
                </p>
              )}

              <p className="mt-2 text-xs text-slate-400">
                {n.tags} · {new Date(n.created_at).toLocaleString()} · Human observation
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
