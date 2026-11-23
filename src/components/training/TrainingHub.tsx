import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, Dumbbell, LoaderCircle, MessageSquareText, Plus, Target, Timer, Trash2, X } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { can, type PlatformRole } from "@/lib/platform";
import type { PlatformDashboardData } from "@/lib/platform-cloud";
import { attendanceRate, drillLibrary, fitnessProgress, fitnessTest, fitnessTests, planMinutes, type Drill } from "@/lib/training";
import { Empty, OfficeCard, OfficeField, Pill, day, fromLocal, when } from "@/components/office/ui";

interface Session {
  id: string;
  team_id: string | null;
  title: string;
  starts_at: string;
  location: string | null;
  focus: string | null;
  plan: { drillId?: string; name: string; minutes: number; notes?: string }[];
  cancelled_at: string | null;
}
interface Attendance { session_id: string; player_id: string; status: string; effort: number | null }
interface Goal { id: string; player_id: string; title: string; detail: string | null; target_date: string | null; status: string; progress: number }
interface Feedback { id: string; player_id: string; author_id: string; kind: string; body: string; rating: number | null; created_at: string }
interface Fitness { id: string; player_id: string; test: string; value: number; recorded_on: string }

type Props = { organisationId: string; role: PlatformRole; club: PlatformDashboardData };

async function must(request: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await request;
  if (error) throw new Error(error.message);
}

/** Coaching: training sessions with a drill plan, attendance, and each player's goals, feedback and fitness. */
export function TrainingHub({ organisationId, role, club }: Props) {
  const coach = can(role, "events.manage");
  const [tab, setTab] = useState<"sessions" | "players">("sessions");
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const db = getCloudClient();

  const load = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
      const [s, a] = await Promise.all([
        db.from("training_sessions").select("id,team_id,title,starts_at,location,focus,plan,cancelled_at").eq("organisation_id", organisationId).gte("starts_at", since).order("starts_at", { ascending: false }).limit(100),
        db.from("training_attendance").select("session_id,player_id,status,effort").eq("organisation_id", organisationId),
      ]);
      if (s.error) throw s.error;
      setSessions((s.data ?? []) as unknown as Session[]);
      setAttendance((a.data ?? []) as Attendance[]);
    } catch {
      setError("Training could not load. Try again in a moment.");
    }
  }, [db, organisationId]);
  useEffect(() => void load(), [load]);

  const run = async (action: () => Promise<void>, done: string) => {
    try {
      await action();
      toast.success(done);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "That didn't work.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="panel-kicker">Training &amp; coaching</p>
        <h2 className="text-2xl font-bold tracking-tight">Sessions, goals and progress</h2>
        <p className="office-meta">Plan sessions from the drill library, take attendance, and keep each player's goals, feedback and fitness tests in one timeline.</p>
      </div>
      <div className="office-tabs" role="tablist" aria-label="Training">
        <button type="button" role="tab" aria-selected={tab === "sessions"} className="office-tab" onClick={() => setTab("sessions")}><CalendarPlus className="size-4" /> Sessions</button>
        <button type="button" role="tab" aria-selected={tab === "players"} className="office-tab" onClick={() => setTab("players")}><Target className="size-4" /> Players</button>
      </div>
      {error && <p className="office-meta">{error}</p>}
      {!sessions && !error && <p className="office-meta flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" /> Loading training…</p>}
      {sessions && tab === "sessions" && (
        <div className="space-y-4">
          {coach && <NewSession club={club} onAdd={(row) => run(() => must(db.from("training_sessions").insert({ ...row, organisation_id: organisationId })), "Session planned")} />}
          {sessions.length === 0 && <Empty>No training sessions yet.{coach ? " Plan one above." : ""}</Empty>}
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} club={club} coach={coach} attendance={attendance.filter((a) => a.session_id === session.id)}
              onMark={(playerId, status) => run(() => must(db.from("training_attendance").upsert({ session_id: session.id, organisation_id: organisationId, player_id: playerId, status, updated_at: new Date().toISOString() })), "Attendance saved")}
              onCancel={() => run(() => must(db.from("training_sessions").update({ cancelled_at: new Date().toISOString() }).eq("id", session.id)), "Session cancelled")}
              onDelete={() => run(() => must(db.from("training_sessions").delete().eq("id", session.id)), "Session removed")}
            />
          ))}
        </div>
      )}
      {sessions && tab === "players" && <PlayerDevelopment organisationId={organisationId} club={club} coach={coach} attendance={attendance} sessions={sessions} />}
    </div>
  );
}

function NewSession({ club, onAdd }: { club: PlatformDashboardData; onAdd: (row: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Nets");
  const [startsAt, setStartsAt] = useState("");
  const [teamId, setTeamId] = useState("");
  const [location, setLocation] = useState("");
  const [focus, setFocus] = useState("");
  const [plan, setPlan] = useState<Drill[]>([]);
  if (!open) return <button type="button" className="action-primary" onClick={() => setOpen(true)}><Plus className="size-4" /> Plan a session</button>;
  const save = async () => {
    const iso = fromLocal(startsAt);
    if (!iso || title.trim().length < 2) {
      toast.error("Add a title and a start time.");
      return;
    }
    await onAdd({ title: title.trim(), starts_at: iso, team_id: teamId || null, location: location.trim() || null, focus: focus.trim() || null, plan: plan.map((d) => ({ drillId: d.id, name: d.name, minutes: d.minutes })) });
    setOpen(false);
    setPlan([]);
  };
  return (
    <OfficeCard title="Plan a session" description={`${plan.length} drills · ${planMinutes(plan)} minutes`} action={<button type="button" className="app-chip-button" onClick={() => setOpen(false)}><X className="size-4" /></button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <OfficeField label="Title"><input className="scorer-input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></OfficeField>
        <OfficeField label="Starts"><input type="datetime-local" className="scorer-input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></OfficeField>
        <OfficeField label="Team"><select className="scorer-input" value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">Whole club</option>{club.teams.filter((t) => !t.external).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></OfficeField>
        <OfficeField label="Where"><input className="scorer-input" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Indoor school, nets 1–3" /></OfficeField>
        <OfficeField label="Focus" className="sm:col-span-2"><input className="scorer-input" maxLength={200} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Death bowling and running between the wickets" /></OfficeField>
      </div>
      <p className="office-label mt-4">Drill library — tap to add</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {drillLibrary.map((drill) => (
          <button key={drill.id} type="button" className="app-chip-button" title={drill.detail} onClick={() => setPlan((p) => (p.length >= 30 ? p : [...p, drill]))}>
            <Plus className="size-3" /> {drill.name} <span className="text-[10px] text-muted-foreground">{drill.minutes}′</span>
          </button>
        ))}
      </div>
      {plan.length > 0 && (
        <ol className="mt-3 space-y-1">
          {plan.map((drill, index) => (
            <li key={`${drill.id}-${index}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
              <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
              <span className="flex-1">{drill.name} <small className="text-muted-foreground">· {drill.skill}</small></span>
              <span className="text-xs tabular-nums">{drill.minutes} min</span>
              <button type="button" aria-label={`Remove ${drill.name}`} onClick={() => setPlan((p) => p.filter((_, i) => i !== index))}><X className="size-3.5" /></button>
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="action-primary mt-3" onClick={() => void save()}><Check className="size-4" /> Save session</button>
    </OfficeCard>
  );
}

const statuses = ["present", "late", "absent", "excused"] as const;

function SessionCard({ session, club, coach, attendance, onMark, onCancel, onDelete }: {
  session: Session; club: PlatformDashboardData; coach: boolean; attendance: Attendance[];
  onMark: (playerId: string, status: string) => void; onCancel: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const team = club.teams.find((t) => t.id === session.team_id);
  const squad = club.players.filter((p) => !team || team.playerIds.includes(p.id));
  const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
  return (
    <OfficeCard
      title={session.title}
      description={`${when(session.starts_at)}${session.location ? ` · ${session.location}` : ""}${team ? ` · ${team.name}` : ""}`}
      action={session.cancelled_at ? <Pill tone="bad">Cancelled</Pill> : <Pill tone="good">{present} attended</Pill>}
    >
      {session.focus && <p className="office-meta mb-2">Focus: {session.focus}</p>}
      {session.plan.length > 0 && (
        <ol className="mb-3 flex flex-wrap gap-1.5">
          {session.plan.map((item, index) => <li key={index} className="office-pill"><Timer className="size-3" /> {item.name} · {item.minutes}′</li>)}
        </ol>
      )}
      {coach && !session.cancelled_at && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="action-secondary" onClick={() => setOpen(!open)}>{open ? "Hide register" : "Take attendance"}</button>
          <button type="button" className="app-chip-button" onClick={() => window.confirm("Cancel this session?") && onCancel()}>Cancel session</button>
          <button type="button" className="app-chip-button" aria-label="Remove session" onClick={() => window.confirm("Remove this session and its register?") && onDelete()}><Trash2 className="size-4" /></button>
        </div>
      )}
      {open && (
        <ul className="mt-3 space-y-1.5">
          {squad.map((player) => {
            const mark = attendance.find((a) => a.player_id === player.id)?.status;
            return (
              <li key={player.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
                {statuses.map((status) => (
                  <button key={status} type="button" className="app-chip-button capitalize" aria-pressed={mark === status} onClick={() => onMark(player.id, status)}>{status}</button>
                ))}
              </li>
            );
          })}
          {squad.length === 0 && <Empty>No players in this team yet.</Empty>}
        </ul>
      )}
    </OfficeCard>
  );
}

function PlayerDevelopment({ organisationId, club, coach, attendance, sessions }: { organisationId: string; club: PlatformDashboardData; coach: boolean; attendance: Attendance[]; sessions: Session[] }) {
  const db = getCloudClient();
  const [playerId, setPlayerId] = useState(club.players[0]?.id ?? "");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [fitness, setFitness] = useState<Fitness[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"coach" | "self">(coach ? "coach" : "self");
  const [testId, setTestId] = useState(fitnessTests[0]!.id);
  const [value, setValue] = useState("");

  const load = useCallback(async () => {
    if (!playerId) return;
    const [g, f, x] = await Promise.all([
      db.from("player_goals").select("id,player_id,title,detail,target_date,status,progress").eq("player_id", playerId).order("created_at", { ascending: false }),
      db.from("player_feedback").select("id,player_id,author_id,kind,body,rating,created_at").eq("player_id", playerId).order("created_at", { ascending: false }).limit(50),
      db.from("fitness_results").select("id,player_id,test,value,recorded_on").eq("player_id", playerId).order("recorded_on"),
    ]);
    setGoals((g.data ?? []) as Goal[]);
    setFeedback((f.data ?? []) as Feedback[]);
    setFitness((x.data ?? []) as Fitness[]);
  }, [db, playerId]);
  useEffect(() => void load(), [load]);

  const run = async (action: () => Promise<void>, done: string) => {
    try {
      await action();
      toast.success(done);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Only coaches, or the player and their parents, can add this.");
    }
  };
  const rate = attendanceRate(attendance.filter((a) => a.player_id === playerId).map((a) => a.status));
  const tests = useMemo(() => [...new Set(fitness.map((f) => f.test))], [fitness]);

  return (
    <div className="space-y-4">
      <OfficeField label="Player">
        <select className="scorer-input max-w-sm" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
          {club.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </OfficeField>
      {!playerId ? <Empty>Add players to the club first.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <OfficeCard title="Goals" description={rate == null ? "No training attendance yet" : `Training attendance ${rate}% (${sessions.length} recent sessions)`}>
            <ul className="space-y-2">
              {goals.map((goal) => (
                <li key={goal.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">{goal.title}</strong>
                    <Pill tone={goal.status === "achieved" ? "good" : goal.status === "dropped" ? "bad" : "warn"}>{goal.status}</Pill>
                  </div>
                  {goal.target_date && <p className="office-meta">By {day(goal.target_date)}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <input type="range" min={0} max={100} step={10} value={goal.progress} aria-label="Progress" className="flex-1"
                      onChange={(e) => void run(() => must(db.from("player_goals").update({ progress: Number(e.target.value), status: Number(e.target.value) === 100 ? "achieved" : goal.status, updated_at: new Date().toISOString() }).eq("id", goal.id)), "Progress saved")} />
                    <span className="w-10 text-right text-xs tabular-nums">{goal.progress}%</span>
                  </div>
                </li>
              ))}
              {goals.length === 0 && <Empty>No goals yet.</Empty>}
            </ul>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (goalTitle.trim().length < 2) return; void run(() => must(db.from("player_goals").insert({ organisation_id: organisationId, player_id: playerId, title: goalTitle.trim(), target_date: goalDate || null })), "Goal added").then(() => setGoalTitle("")); }}>
              <input className="scorer-input min-w-0 flex-1" maxLength={140} placeholder="e.g. Score a fifty this season" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
              <input type="date" className="scorer-input w-auto" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} aria-label="Target date" />
              <button className="action-secondary"><Plus className="size-4" /> Goal</button>
            </form>
          </OfficeCard>
          <OfficeCard title="Feedback timeline" description="Coach notes and the player's own reviews">
            <form className="mb-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (note.trim().length < 2) return; void run(() => must(db.from("player_feedback").insert({ organisation_id: organisationId, player_id: playerId, kind, body: note.trim() })), "Saved").then(() => setNote("")); }}>
              <div className="flex gap-1.5">
                {coach && <button type="button" className="app-chip-button" aria-pressed={kind === "coach"} onClick={() => setKind("coach")}>Coach note</button>}
                <button type="button" className="app-chip-button" aria-pressed={kind === "self"} onClick={() => setKind("self")}>Self-review</button>
              </div>
              <textarea className="scorer-input min-h-20" maxLength={2000} placeholder={kind === "coach" ? "What went well, what to work on next" : "How did it go? What will you try next time?"} value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="action-secondary"><MessageSquareText className="size-4" /> Add</button>
            </form>
            <ul className="space-y-2">
              {feedback.map((item) => (
                <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="office-meta">{item.kind === "coach" ? "Coach" : "Self-review"} · {day(item.created_at)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
                </li>
              ))}
              {feedback.length === 0 && <Empty>No feedback yet.</Empty>}
            </ul>
          </OfficeCard>
          <OfficeCard title="Fitness tests" description="Record a result; the chart shows progress over time">
            <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const v = Number(value); if (!Number.isFinite(v) || v < 0) return; void run(() => must(db.from("fitness_results").insert({ organisation_id: organisationId, player_id: playerId, test: testId, value: v })), "Result saved").then(() => setValue("")); }}>
              <select className="scorer-input w-auto" value={testId} onChange={(e) => setTestId(e.target.value)}>{fitnessTests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <input className="scorer-input w-28" inputMode="decimal" placeholder={fitnessTest(testId)?.unit} value={value} onChange={(e) => setValue(e.target.value)} />
              <button className="action-secondary"><Dumbbell className="size-4" /> Save</button>
            </form>
            {tests.length === 0 ? <Empty>No fitness results yet.</Empty> : tests.map((test) => <FitnessChart key={test} test={test} rows={fitness.filter((f) => f.test === test)} />)}
          </OfficeCard>
        </div>
      )}
    </div>
  );
}

function FitnessChart({ test, rows }: { test: string; rows: Fitness[] }) {
  const info = fitnessTest(test);
  const progress = fitnessProgress(rows.map((r) => ({ recorded_on: r.recorded_on, value: Number(r.value) })), test);
  const values = progress.points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const W = 280;
  const H = 70;
  const points = progress.points.map((p, i) => `${progress.points.length === 1 ? W / 2 : (i / (progress.points.length - 1)) * W},${H - 8 - ((p.value - min) / span) * (H - 16)}`).join(" ");
  return (
    <figure className="mb-3">
      <figcaption className="flex items-center justify-between text-xs">
        <strong>{info?.name ?? test}</strong>
        <span className={progress.improved ? "text-success" : progress.improved === false ? "text-destructive" : "text-muted-foreground"}>
          Latest {values.at(-1)} {info?.unit}{progress.change !== null ? ` (${progress.change > 0 ? "+" : ""}${progress.change})` : ""}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-16 w-full" role="img" aria-label={`${info?.name ?? test} over time`}>
        <polyline points={points} fill="none" stroke="var(--gold)" strokeWidth={2.5} strokeLinejoin="round" />
        {progress.points.map((p, i) => <circle key={i} cx={progress.points.length === 1 ? W / 2 : (i / (progress.points.length - 1)) * W} cy={H - 8 - ((p.value - min) / span) * (H - 16)} r={3.5} fill="var(--gold)" />)}
      </svg>
    </figure>
  );
}
