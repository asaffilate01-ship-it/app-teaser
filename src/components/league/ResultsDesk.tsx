import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, LoaderCircle, RotateCcw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendly } from "@/lib/club-office-cloud";
import {
  deskState,
  deskStateLabels,
  describeResult,
  resultProblem,
  sortForAction,
  suggestedResult,
  type DeskState,
  type FixtureResult,
  type InboxFixture,
} from "@/lib/results-desk";

const tone: Record<DeskState, "good" | "warn" | "bad" | undefined> = {
  "signed-off": "good",
  ready: "good",
  disputed: "bad",
  overdue: "bad",
  "awaiting-one": "warn",
  "awaiting-both": "warn",
  upcoming: undefined,
};

async function loadInbox(organisationId: string): Promise<InboxFixture[]> {
  const { data, error } = await supabase.rpc("fixture_results_inbox", { p_org: organisationId });
  if (error) throw new Error(friendly(error.message));
  return (data as unknown as InboxFixture[]) ?? [];
}

/**
 * Results desk: each team sends its result, the league signs it off. The "Needs action" list puts
 * disputes and overdue results first — the database decides who may report or sign off.
 */
export function ResultsDesk({ organisationId, onChanged }: { organisationId: string; onChanged?: () => void }) {
  const [rows, setRows] = useState<InboxFixture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<"action" | "all">("action");
  const [open, setOpen] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setRows(await loadInbox(organisationId));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Results could not load.");
    }
  }, [organisationId]);
  useEffect(() => void reload(), [reload]);
  const now = Date.now();
  const sorted = useMemo(() => (rows ? sortForAction(rows, now) : []), [rows, now]);
  const needsAction = sorted.filter((f) => ["disputed", "overdue", "ready", "awaiting-one", "awaiting-both"].includes(deskState(f, now)));
  const shown = show === "action" ? needsAction : sorted;
  const counts = needsAction.reduce<Record<string, number>>((acc, f) => ((acc[deskState(f, now)] = (acc[deskState(f, now)] ?? 0) + 1), acc), {});

  if (error && !rows) return <section className="office-card"><p className="office-meta">{error}</p></section>;
  if (!rows) {
    return (
      <section className="office-card flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> Loading results…
      </section>
    );
  }
  if (rows.length === 0) return null;
  return (
    <section className="office-card" aria-label="Results desk">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-kicker">Results desk</p>
          <h3 className="text-xl font-bold">Confirm results</h3>
          <p className="office-meta">Each team sends its result. When both agree the league signs it off and the table updates.</p>
        </div>
        <div className="office-tabs" role="tablist" aria-label="Show results">
          <button type="button" role="tab" aria-selected={show === "action"} className="office-tab" onClick={() => setShow("action")}>
            Needs action · {needsAction.length}
          </button>
          <button type="button" role="tab" aria-selected={show === "all"} className="office-tab" onClick={() => setShow("all")}>
            All · {rows.length}
          </button>
        </div>
      </div>
      {needsAction.length > 0 && (
        <div className="desk-summary">
          {(["disputed", "overdue", "ready", "awaiting-one", "awaiting-both"] as const).map((state) =>
            counts[state] ? (
              <span key={state} className={`office-pill office-pill-${tone[state] ?? ""}`}>
                {counts[state]} {deskStateLabels[state].toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="office-meta rounded-xl border border-dashed border-border p-4 text-center">
          <CheckCircle2 className="mr-1 inline size-4" /> All caught up — nothing needs action.
        </p>
      ) : (
        <ul className="grid gap-2">
          {shown.map((fixture) => (
            <DeskRow
              key={fixture.fixtureId}
              fixture={fixture}
              now={now}
              open={open === fixture.fixtureId}
              onToggle={() => setOpen((id) => (id === fixture.fixtureId ? null : fixture.fixtureId))}
              onDone={async () => {
                await reload();
                onChanged?.();
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DeskRow({ fixture, now, open, onToggle, onDone }: { fixture: InboxFixture; now: number; open: boolean; onToggle: () => void; onDone: () => Promise<void> }) {
  const state = deskState(fixture, now);
  const names = { home: fixture.home, away: fixture.away, homeTeamId: fixture.homeTeamId };
  const Icon = state === "disputed" || state === "overdue" ? AlertTriangle : state === "signed-off" || state === "ready" ? CheckCircle2 : Clock3;
  const reportFor = (teamId: string) => fixture.reports.find((r) => r.teamId === teamId);
  const canAct = fixture.isLeagueAdmin || fixture.myTeamIds.length > 0;
  return (
    <li className="desk-row" data-state={state}>
      <button type="button" className="desk-row-head" aria-expanded={open} onClick={onToggle}>
        <Icon className="size-5 flex-none" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-left">
          <strong className="block truncate">
            {fixture.home} v {fixture.away}
          </strong>
          <span className="office-meta block truncate">
            {[fixture.competition, fixture.round, fixture.startsAt ? new Date(fixture.startsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={`office-pill office-pill-${tone[state] ?? ""}`}>{deskStateLabels[state]}</span>
      </button>
      {open && (
        <div className="desk-row-body">
          {fixture.signedOffAt && <p className="font-bold">Official: {describeResult(fixture.officialResult, names)}</p>}
          <dl className="desk-reports">
            {[fixture.homeTeamId, fixture.awayTeamId].map((teamId) => {
              const report = reportFor(teamId);
              return (
                <div key={teamId}>
                  <dt>{teamId === fixture.homeTeamId ? fixture.home : fixture.away} says</dt>
                  <dd>{report ? describeResult(report.result, names) : "Not sent yet"}</dd>
                  {report?.note && <dd className="office-meta">“{report.note}”</dd>}
                </div>
              );
            })}
          </dl>
          {fixture.suggested?.status === "completed" && (
            <p className="office-meta">From the scored match: {describeResult(suggestedResult(fixture), names)}</p>
          )}
          {canAct ? <ResultForm fixture={fixture} onDone={onDone} /> : <p className="office-meta">Only the teams' admins, managers or scorers and the league can act on this.</p>}
        </div>
      )}
    </li>
  );
}

function ResultForm({ fixture, onDone }: { fixture: InboxFixture; onDone: () => Promise<void> }) {
  const mine = fixture.myTeamIds[0] ?? null;
  const start: FixtureResult =
    (mine && fixture.reports.find((r) => r.teamId === mine)?.result) ||
    fixture.reports[0]?.result ||
    suggestedResult(fixture) ||
    fixture.officialResult ||
    {};
  const [outcome, setOutcome] = useState<string>(start.noResult ? "nr" : start.tied ? "tie" : (start.winnerTeamId ?? ""));
  const [nums, setNums] = useState({
    homeRuns: start.homeRuns?.toString() ?? "",
    homeOvers: ballsToOvers(start.homeLegalBalls),
    awayRuns: start.awayRuns?.toString() ?? "",
    awayOvers: ballsToOvers(start.awayLegalBalls),
    homeBonus: start.homeBonusPoints?.toString() ?? "",
    awayBonus: start.awayBonusPoints?.toString() ?? "",
  });
  const [note, setNote] = useState("");
  const [abandoned, setAbandoned] = useState(false);
  const [busy, setBusy] = useState(false);
  const signedOff = Boolean(fixture.signedOffAt);

  const build = (): FixtureResult => {
    const r: FixtureResult = {};
    if (outcome === "nr") r.noResult = true;
    else if (outcome === "tie") r.tied = true;
    else if (outcome) r.winnerTeamId = outcome;
    if (outcome !== "nr") {
      const values = {
        homeRuns: toInt(nums.homeRuns),
        awayRuns: toInt(nums.awayRuns),
        homeLegalBalls: oversToBalls(nums.homeOvers),
        awayLegalBalls: oversToBalls(nums.awayOvers),
      };
      for (const [key, value] of Object.entries(values) as [keyof typeof values, number | undefined][]) {
        if (value !== undefined) r[key] = value;
      }
    }
    if (nums.homeBonus) r.homeBonusPoints = Number(nums.homeBonus);
    if (nums.awayBonus) r.awayBonusPoints = Number(nums.awayBonus);
    return r;
  };
  const run = async (action: () => PromiseLike<{ error: { message: string } | null }>, done: string, needsValid = true) => {
    if (needsValid) {
      const problem = resultProblem(build(), fixture.homeTeamId, fixture.awayTeamId);
      if (problem) {
        toast.error(problem);
        return;
      }
    }
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) {
      toast.error(friendly(error.message));
      return;
    }
    toast.success(done);
    await onDone();
  };

  if (signedOff) {
    return fixture.isLeagueAdmin ? (
      <button type="button" className="action-secondary" disabled={busy} onClick={() => void run(() => supabase.rpc("reopen_fixture_result", { p_fixture_id: fixture.fixtureId }), "Result reopened", false)}>
        <RotateCcw className="size-4" /> Reopen result
      </button>
    ) : null;
  }
  return (
    <fieldset disabled={busy} className="grid gap-3">
      <div className="office-tabs" role="radiogroup" aria-label="Outcome">
        {[
          [fixture.homeTeamId, `${fixture.home} won`],
          [fixture.awayTeamId, `${fixture.away} won`],
          ["tie", "Tie"],
          ["nr", "No result"],
        ].map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={outcome === value} aria-selected={outcome === value} className="office-tab" onClick={() => setOutcome(value!)}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["home", "away"] as const).map((side) => (
          <fieldset key={side} className="desk-side">
            <legend>{side === "home" ? fixture.home : fixture.away}</legend>
            <div className="grid grid-cols-3 gap-2">
              {outcome !== "nr" && (
                <>
                  <NumField label="Runs" value={nums[`${side}Runs`]} onChange={(v) => setNums((n) => ({ ...n, [`${side}Runs`]: v }))} />
                  <NumField label="Overs" value={nums[`${side}Overs`]} decimal onChange={(v) => setNums((n) => ({ ...n, [`${side}Overs`]: v }))} />
                </>
              )}
              <NumField label="Bonus pts" value={nums[`${side}Bonus`]} decimal onChange={(v) => setNums((n) => ({ ...n, [`${side}Bonus`]: v }))} />
            </div>
          </fieldset>
        ))}
      </div>
      <p className="office-meta">Overs as bowled, e.g. 19.4. For an all-out side, use the overs your league counts for net run rate.</p>
      {fixture.myTeamIds.length > 0 && (
        <label className="block">
          <span className="office-label">Note to the league (optional)</span>
          <input className="scorer-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {fixture.myTeamIds.map((teamId) => (
          <button
            key={teamId}
            type="button"
            className="action-primary"
            onClick={() =>
              void run(
                () => supabase.rpc("report_fixture_result", { p_fixture_id: fixture.fixtureId, p_team_id: teamId, p_result: build() as never, p_note: note }),
                "Result sent to the league",
              )
            }
          >
            <Send className="size-4" /> Send as {teamId === fixture.homeTeamId ? fixture.home : fixture.away}
          </button>
        ))}
        {fixture.isLeagueAdmin && (
          <>
            {outcome === "nr" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={abandoned} onChange={(e) => setAbandoned(e.target.checked)} /> Abandoned
              </label>
            )}
            <button
              type="button"
              className="action-primary"
              onClick={() =>
                void run(
                  () => supabase.rpc("sign_off_fixture_result", { p_fixture_id: fixture.fixtureId, p_result: build() as never, p_abandoned: outcome === "nr" && abandoned }),
                  "Result signed off — the table is updated",
                )
              }
            >
              <ClipboardCheck className="size-4" /> Sign off result
            </button>
          </>
        )}
      </div>
    </fieldset>
  );
}

function NumField({ label, value, onChange, decimal = false }: { label: string; value: string; onChange: (v: string) => void; decimal?: boolean }) {
  return (
    <label className="block min-w-0">
      <span className="office-label truncate">{label}</span>
      <input
        className="scorer-input"
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, ""))}
      />
    </label>
  );
}

function toInt(value: string): number | undefined {
  return value === "" ? undefined : Number.parseInt(value, 10);
}
function ballsToOvers(balls: number | undefined): string {
  if (balls == null) return "";
  return `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""}`;
}
/** "19.4" → 118 balls (six-ball overs). Invalid ball counts (.6 or more) come back undefined. */
export function oversToBalls(value: string): number | undefined {
  if (!value) return undefined;
  const [whole, part = "0"] = value.split(".");
  const overs = Number.parseInt(whole ?? "", 10);
  const balls = Number.parseInt(part, 10);
  if (!Number.isFinite(overs) || !Number.isFinite(balls) || balls > 5 || part.length > 1) return undefined;
  return overs * 6 + balls;
}
