import { useEffect, useMemo, useState } from "react";
import {
  filterDeliveries,
  summarizeDeliveries,
  deliveryCsv,
  defaultAnalysisFilters,
  type AnalysisFilters,
} from "@/lib/analysis";
import {
  loadAnalysis,
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
      <header className="rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-950/50 to-slate-950 p-6">
        <p className="text-xs uppercase tracking-widest text-emerald-300">
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [junior, setJunior] = useState(true);
  const [preview, setPreview] = useState<{ url: string; kind: string; label: string } | null>(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [delivery, setDelivery] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    void loadAnalysis(org, match)
      .then((r) => {
        if (active) setData(r);
      })
      .catch(() => {
        if (active)
          setError("Evidence could not be loaded. Check your access and database deployment.");
      });
    return () => {
      active = false;
    };
  }, [org, match, version]);
  useEffect(() => {
    if (!preview) return;
    const t = window.setTimeout(() => setPreview(null), 60000);
    return () => window.clearTimeout(t);
  }, [preview]);
  const rows = useMemo(
    () => filterDeliveries(data?.deliveries ?? [], filters, data?.mediaIds),
    [data, filters],
  );
  const summary = summarizeDeliveries(rows);
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
      <select className={field} value={filters[key]} onChange={(e) => update(key, e.target.value)}>
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
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Check your permissions.");
    } finally {
      setBusy(false);
    }
  };
  const showFile = (f: EvidenceFile) =>
    action(async () => setPreview({ url: await evidenceUrl(f), kind: f.kind, label: f.label }));
  const showClip = (id: string) =>
    action(async () => {
      const c = data?.clips.find((c) => c.delivery_id === id);
      if (c)
        setPreview({
          url: `${await clipUrl(c.asset_id)}#t=${c.offset_start_ms / 1000},${c.offset_end_ms / 1000}`,
          kind: "video",
          label: "Delivery clip",
        });
    });
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([deliveryCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `criclume-${filters.discipline}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl border border-amber-400/30 p-3 text-amber-200">
          {error}
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        {select(
          "Zone",
          "zone",
          options(filters.discipline === "fielding" ? "fielding_zone" : "shot_zone").map((v) => [
            v,
            v,
          ]),
        )}
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
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs text-slate-400">
            <tr>
              {["Ball", "Batter", "Bowler", "Runs", "Outcome", "Evidence"].map((x) => (
                <th key={x} className="p-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 30, page * 30 + 30).map((d) => (
              <tr key={d.id} className="border-t border-white/5">
                <td className="p-3">
                  {d.over_number}.{d.ball_in_over}
                </td>
                <td className="p-3">{names.get(d.striker_id) ?? "Player"}</td>
                <td className="p-3">{names.get(d.bowler_id) ?? "Player"}</td>
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
                      Play clip
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
        <span>{rows.length} matching deliveries</span>
        <button
          className={field}
          disabled={(page + 1) * 30 >= rows.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
        <button className={field} disabled={!rows.length} onClick={exportCsv}>
          Export filtered CSV
        </button>
      </div>
      <section className="rounded-2xl border border-white/10 p-5">
        <h3 className="text-lg font-semibold">Private photos and videos</h3>
        <p className="mt-1 text-xs text-slate-400">
          Up to 50 MB per file. 90-day retention. Latest 100 files shown. Uploading does not send
          media to an AI provider.
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
                      setVersion((v) => v + 1);
                    }
                  })
                }
              >
                Upload evidence
              </button>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.files.map((f) => (
                  <article key={f.id} className="rounded-xl border border-white/10 p-3">
                    <button
                      disabled={busy}
                      className="block max-w-full truncate text-left text-emerald-300"
                      onClick={() => void showFile(f)}
                    >
                      {f.label}
                    </button>
                    <p className="mt-1 text-xs text-slate-400">
                      {f.kind} ·{" "}
                      {f.includes_junior
                        ? "Junior/uncertain — external AI blocked"
                        : "Adult evidence — provider consent still required"}
                    </p>
                    <button
                      disabled={busy}
                      className="mt-2 text-xs text-slate-400 underline"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Remove this private evidence? Only the uploader can remove it.",
                          )
                        )
                          void action(async () => {
                            setPreview(null);
                            await removeEvidence(f);
                            setVersion((v) => v + 1);
                          });
                      }}
                    >
                      Remove my upload
                    </button>
                  </article>
                ))}
              </div>
            </>
          )
        )}
        {preview && (
          <div className="mt-4">
            <div className="mb-2 flex justify-between">
              <span>{preview.label}</span>
              <button onClick={() => setPreview(null)}>Close</button>
            </div>
            {preview.kind === "image" ? (
              <img
                src={preview.url}
                alt={preview.label}
                className="max-h-96 rounded-xl object-contain"
              />
            ) : (
              <video
                src={preview.url}
                controls
                preload="metadata"
                className="max-h-96 w-full rounded-xl"
              />
            )}
          </div>
        )}
      </section>
      <section className="rounded-2xl border border-white/10 p-5">
        <h3 className="text-lg font-semibold">Coaching observations</h3>
        <p className="mt-1 text-xs text-slate-400">
          Human notes, separate from official scores. Latest 100 notes shown.
        </p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            Delivery (optional)
            <select
              className={field}
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            >
              <option value="">Whole match</option>
              {(data?.deliveries ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.over_number}.{d.ball_in_over} · {names.get(d.striker_id) ?? "Player"}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Observation
            <textarea
              className={field}
              maxLength={3000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Tags: shot type, line, length or fielding action
            <input
              className={field}
              maxLength={300}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </label>
          <button
            className="action-primary justify-self-start"
            disabled={busy || !data?.workspaceAvailable || note.trim().length < 3}
            onClick={() =>
              void action(async () => {
                await saveNote(org, match, filters.discipline, note, tags, delivery);
                setNote("");
                setVersion((v) => v + 1);
              })
            }
          >
            Save {filters.discipline} note
          </button>
          <label className="grid gap-1 text-sm">
            Search notes and tags
            <input className={field} value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 space-y-3">
          {data?.notes
            .filter(
              (n) =>
                n.discipline === filters.discipline &&
                `${n.note} ${n.tags}`.toLowerCase().includes(search.toLowerCase()),
            )
            .map((n) => (
              <article key={n.id} className="rounded-xl border border-white/10 p-4">
                <p className="whitespace-pre-wrap text-sm">{n.note}</p>
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
