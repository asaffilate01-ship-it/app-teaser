import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, Plus, Star, Trash2 } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import type { AppointmentRow } from "@/lib/umpires-cloud";
import {
  assessmentCriteria, averageMark, decisionKinds, decisionLabels, decisionSummary, overallPercent, readDecisions,
  type AssessmentScores, type DecisionKind, type UmpireDecision,
} from "@/lib/umpire-reports";
import { Empty, OfficeCard, OfficeField, Pill } from "@/components/office/ui";

type Act = (action: () => Promise<void>, done?: string) => Promise<boolean>;
interface ReportRow { id: string; appointment_id: string; decisions: unknown; incidents: string | null; pitch_comment: string | null; conduct_concern: boolean; submitted_at: string | null }
interface AssessmentRow { id: string; umpire_id: string; appointment_id: string | null; assessed_on: string; scores: unknown; overall: number; recommended_grade: string | null; notes: string | null; assessor_id: string }

const shortDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/* ---------------- Umpire's own screen ---------------- */

/** The umpire keeps a record of decisions during or after each match and sends a short report to the club or league. */
export function MyMatchRecords({ appointments, act }: { appointments: AppointmentRow[]; act: Act }) {
  const db = getCloudClient();
  const recent = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((row) => ["accepted", "completed"].includes(row.status) && new Date(row.starts_at).getTime() <= now + 6 * 3_600_000 && new Date(row.starts_at).getTime() > now - 90 * 86_400_000)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  }, [appointments]);
  const [reports, setReports] = useState<Map<string, ReportRow>>(new Map());
  const [open, setOpen] = useState<string | null>(null);
  const [marks, setMarks] = useState<{ mark: number }[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const load = useCallback(async () => {
    const ids = recent.map((r) => r.id);
    const [r, m, a] = await Promise.all([
      ids.length ? db.from("umpire_match_reports").select("id,appointment_id,decisions,incidents,pitch_comment,conduct_concern,submitted_at").in("appointment_id", ids) : Promise.resolve({ data: [] }),
      db.rpc("my_umpire_marks"),
      db.from("umpire_assessments").select("*").order("assessed_on", { ascending: false }).limit(20),
    ]);
    setReports(new Map(((r.data ?? []) as ReportRow[]).map((row) => [row.appointment_id, row])));
    setMarks(Array.isArray(m.data) ? (m.data as { mark: number }[]) : []);
    setAssessments((a.data ?? []) as AssessmentRow[]);
  }, [db, recent]);
  useEffect(() => void load(), [load]);
  const avg = averageMark(marks);
  const latest = assessments[0];
  return (
    <OfficeCard title="Match records & reports" description="Log appeals and decisions as you go, then send a short report. Only you and the appointments officer see it.">
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <Pill tone={avg.average !== null && avg.average >= 3.5 ? "good" : undefined}>Captains' marks: {avg.average ?? "—"}{avg.average !== null ? "/5" : ""} · {avg.count} match{avg.count === 1 ? "" : "es"}</Pill>
        {latest && <Pill tone={latest.overall >= 70 ? "good" : "warn"}>Last assessment {latest.overall}/100 · {shortDay(latest.assessed_on)}</Pill>}
      </div>
      {recent.length === 0 ? <Empty>Your match records appear here on match day.</Empty> : (
        <ul className="space-y-2">
          {recent.map((row) => {
            const report = reports.get(row.id);
            return (
              <li key={row.id} className="rounded-lg border border-border p-3">
                <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOpen(open === row.id ? null : row.id)} aria-expanded={open === row.id}>
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                  <strong className="flex-1">{row.title}</strong>
                  <span className="office-meta">{shortDay(row.starts_at)}</span>
                  <Pill tone={report?.submitted_at ? "good" : report ? "warn" : undefined}>{report?.submitted_at ? "Report sent" : report ? "Draft" : "No record yet"}</Pill>
                </button>
                {open === row.id && <ReportEditor appointment={row} report={report} act={act} onSaved={load} />}
              </li>
            );
          })}
        </ul>
      )}
      {assessments.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">Your assessments ({assessments.length})</summary>
          <ul className="mt-2 space-y-2">{assessments.map((a) => <AssessmentItem key={a.id} row={a} />)}</ul>
        </details>
      )}
    </OfficeCard>
  );
}

function ReportEditor({ appointment, report, act, onSaved }: { appointment: AppointmentRow; report: ReportRow | undefined; act: Act; onSaved: () => Promise<void> }) {
  const db = getCloudClient();
  const [decisions, setDecisions] = useState<UmpireDecision[]>(readDecisions(report?.decisions));
  const [kind, setKind] = useState<DecisionKind>("lbw");
  const [over, setOver] = useState("");
  const [incidents, setIncidents] = useState(report?.incidents ?? "");
  const [pitch, setPitch] = useState(report?.pitch_comment ?? "");
  const [concern, setConcern] = useState(report?.conduct_concern ?? false);
  const sent = Boolean(report?.submitted_at);
  const summary = decisionSummary(decisions);
  const add = (given: boolean) => {
    setDecisions([...decisions, { kind, given, ...(over.trim() ? { over: over.trim().slice(0, 10) } : {}) }]);
    setOver("");
  };
  const save = (submit: boolean) =>
    act(async () => {
      const row = {
        appointment_id: appointment.id, organisation_id: appointment.organisation_id, umpire_id: appointment.umpire_id,
        decisions: decisions.slice(0, 300) as unknown as never, incidents: incidents.trim() || null, pitch_comment: pitch.trim() || null,
        conduct_concern: concern, ...(submit ? { submitted_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString(),
      };
      const { error } = report ? await db.from("umpire_match_reports").update(row).eq("id", report.id) : await db.from("umpire_match_reports").insert(row);
      if (error) throw new Error(error.message);
      await onSaved();
    }, submit ? "Report sent" : "Saved");
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Decision type">
        {(decisionKinds as readonly DecisionKind[]).map((k) => (
          <button key={k} type="button" className="app-chip-button" aria-pressed={kind === k} onClick={() => setKind(k)}>{decisionLabels[k]}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <OfficeField label="Over (optional)"><input className="scorer-input w-24" value={over} onChange={(e) => setOver(e.target.value)} placeholder="14.3" /></OfficeField>
        {kind === "wide" || kind === "no_ball" ? (
          <button type="button" className="action-secondary" onClick={() => add(true)}><Plus className="size-4" /> Called</button>
        ) : (
          <>
            <button type="button" className="action-primary" onClick={() => add(true)}>Out</button>
            <button type="button" className="action-secondary" onClick={() => add(false)}>Not out</button>
          </>
        )}
      </div>
      <p className="office-meta">{summary.appeals} appeal{summary.appeals === 1 ? "" : "s"} · {summary.given} given · {summary.notGiven} not out · LBW {summary.lbwGiven}/{summary.lbwAppeals} · {summary.wides} wides · {summary.noBalls} no-balls</p>
      {decisions.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {decisions.map((d, i) => (
            <li key={i}><Pill tone={d.given ? "bad" : undefined}>{d.over ? `${d.over} · ` : ""}{decisionLabels[d.kind]}{["wide", "no_ball"].includes(d.kind) ? "" : d.given ? " — out" : " — not out"}
              <button type="button" aria-label="Remove" className="ml-1" onClick={() => setDecisions(decisions.filter((_, j) => j !== i))}><Trash2 className="inline size-3" /></button></Pill></li>
          ))}
        </ul>
      )}
      <OfficeField label="Incidents or comments"><textarea className="scorer-input min-h-20" maxLength={3000} value={incidents} onChange={(e) => setIncidents(e.target.value)} placeholder="Ball changes, injuries, delays, anything the league should know" /></OfficeField>
      <OfficeField label="Pitch and ground"><input className="scorer-input" maxLength={500} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="e.g. Good, even bounce; outfield slow" /></OfficeField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={concern} onChange={(e) => setConcern(e.target.checked)} /> <AlertTriangle className="size-4" /> Report a player or team conduct concern</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="action-secondary" onClick={() => void save(false)}>Save draft</button>
        <button type="button" className="action-primary" onClick={() => void save(true)}>{sent ? "Send update" : "Send report"}</button>
      </div>
    </div>
  );
}

function AssessmentItem({ row, name }: { row: AssessmentRow; name?: string }) {
  const scores = (row.scores && typeof row.scores === "object" ? row.scores : {}) as Record<string, number>;
  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="flex-1">{name ?? "Assessment"} · {shortDay(row.assessed_on)}</strong>
        <Pill tone={row.overall >= 70 ? "good" : row.overall >= 50 ? "warn" : "bad"}>{row.overall}/100</Pill>
        {row.recommended_grade && <Pill>Recommended: {row.recommended_grade}</Pill>}
      </div>
      <p className="office-meta mt-1">{assessmentCriteria.map(([key, label]) => (scores[key] ? `${label} ${scores[key]}/5` : null)).filter(Boolean).join(" · ")}</p>
      {row.notes && <p className="mt-1 whitespace-pre-wrap">{row.notes}</p>}
    </li>
  );
}

/* ---------------- Appointments officer ---------------- */

/** Reports umpires sent in, and assessments by observers — for the panel's managers. */
export function UmpireReportsDesk({ organisationId, umpires, appointments, act }: {
  organisationId: string;
  umpires: { id: string; display_name: string; grade: string }[];
  appointments: AppointmentRow[];
  act: Act;
}) {
  const db = getCloudClient();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const nameOf = (id: string) => umpires.find((u) => u.id === id)?.display_name ?? "Umpire";
  const appointmentOf = (id: string | null) => appointments.find((a) => a.id === id);
  const load = useCallback(async () => {
    const [r, a] = await Promise.all([
      db.from("umpire_match_reports").select("id,appointment_id,umpire_id,decisions,incidents,pitch_comment,conduct_concern,submitted_at").eq("organisation_id", organisationId).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(50),
      db.from("umpire_assessments").select("*").eq("organisation_id", organisationId).order("assessed_on", { ascending: false }).limit(50),
    ]);
    setReports((r.data ?? []) as (ReportRow & { umpire_id: string })[]);
    setAssessments((a.data ?? []) as AssessmentRow[]);
  }, [db, organisationId]);
  useEffect(() => void load(), [load]);
  return (
    <div className="space-y-4">
      <OfficeCard title="Umpire match reports" description="Sent in by your umpires after each match.">
        {reports.length === 0 ? <Empty>No reports yet. Umpires send them from criclume.com/umpire.</Empty> : (
          <ul className="space-y-2">
            {(reports as (ReportRow & { umpire_id: string })[]).map((r) => {
              const s = decisionSummary(readDecisions(r.decisions));
              const appt = appointmentOf(r.appointment_id);
              return (
                <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="flex-1">{appt?.title ?? "Match"} · {nameOf(r.umpire_id)}</strong>
                    {r.conduct_concern && <Pill tone="bad"><AlertTriangle className="mr-1 inline size-3" />Conduct concern</Pill>}
                    {appt && <span className="office-meta">{shortDay(appt.starts_at)}</span>}
                  </div>
                  <p className="office-meta">{s.appeals} appeals · {s.given} given · LBW {s.lbwGiven}/{s.lbwAppeals} · {s.wides} wides · {s.noBalls} no-balls</p>
                  {r.pitch_comment && <p className="mt-1"><strong>Pitch:</strong> {r.pitch_comment}</p>}
                  {r.incidents && <p className="mt-1 whitespace-pre-wrap">{r.incidents}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </OfficeCard>
      <NewAssessment umpires={umpires} appointments={appointments} organisationId={organisationId} act={act} onSaved={load} />
      <OfficeCard title="Assessment history">
        {assessments.length === 0 ? <Empty>No assessments recorded.</Empty> : <ul className="space-y-2">{assessments.map((a) => <AssessmentItem key={a.id} row={a} name={nameOf(a.umpire_id)} />)}</ul>}
      </OfficeCard>
    </div>
  );
}

function NewAssessment({ umpires, appointments, organisationId, act, onSaved }: {
  umpires: { id: string; display_name: string; grade: string }[]; appointments: AppointmentRow[]; organisationId: string; act: Act; onSaved: () => Promise<void>;
}) {
  const db = getCloudClient();
  const [umpireId, setUmpireId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [scores, setScores] = useState<AssessmentScores>({});
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState("");
  const theirs = appointments.filter((a) => a.umpire_id === umpireId && new Date(a.starts_at).getTime() <= Date.now()).slice(0, 30);
  const overall = overallPercent(scores);
  const save = () =>
    act(async () => {
      if (!umpireId || overall === 0) throw new Error("Choose an umpire and mark at least one area.");
      const { error } = await db.from("umpire_assessments").insert({
        organisation_id: organisationId, umpire_id: umpireId, appointment_id: appointmentId || null,
        scores: scores as never, overall, recommended_grade: grade.trim() || null, notes: notes.trim() || null,
      });
      if (error) throw new Error(error.message);
      setScores({}); setNotes(""); setGrade(""); setAppointmentId("");
      await onSaved();
    }, "Assessment saved");
  return (
    <OfficeCard title="Assess an umpire" description="For observers and appointments officers. The umpire can see their own assessments.">
      <div className="grid gap-3 sm:grid-cols-2">
        <OfficeField label="Umpire">
          <select className="scorer-input" value={umpireId} onChange={(e) => { setUmpireId(e.target.value); setAppointmentId(""); }}>
            <option value="">Choose…</option>
            {umpires.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
        </OfficeField>
        <OfficeField label="Match (optional)">
          <select className="scorer-input" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} disabled={!umpireId}>
            <option value="">Not linked to a match</option>
            {theirs.map((a) => <option key={a.id} value={a.id}>{a.title} · {shortDay(a.starts_at)}</option>)}
          </select>
        </OfficeField>
      </div>
      <div className="mt-3 space-y-2">
        {assessmentCriteria.map(([key, label]) => (
          <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-52">{label}</span>
            <span className="flex gap-1" role="radiogroup" aria-label={label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={scores[key] === n} aria-label={`${n} of 5`} className="p-0.5" onClick={() => setScores({ ...scores, [key]: n })}>
                  <Star className={`size-5 ${(scores[key] ?? 0) >= n ? "fill-current text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <OfficeField label="Recommended grade (optional)"><input className="scorer-input" maxLength={40} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. Ready for Premier division" /></OfficeField>
        <OfficeField label="Notes"><textarea className="scorer-input min-h-16" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></OfficeField>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="action-primary" onClick={() => void save()}>Save assessment</button>
        <span className="office-meta">Overall {overall}/100</span>
      </div>
    </OfficeCard>
  );
}
