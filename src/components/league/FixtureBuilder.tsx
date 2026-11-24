import { useMemo, useState } from "react";
import { CalendarRange, Wand2 } from "lucide-react";
import { buildRoundRobin } from "@/lib/fixture-builder";
import { createFixtures, type PlatformDashboardData } from "@/lib/platform-cloud";

type RunAction = <T>(action: () => Promise<T>) => Promise<T>;

/** Generates a whole season of round-robin fixtures, previews them, then creates them in one go. */
export function FixtureBuilder({ data, run }: { data: PlatformDashboardData; run: RunAction }) {
  const [competitionId, setCompetitionId] = useState(data.competitions[0]?.id ?? "");
  const teamsFor = (id: string) =>
    data.teams.filter((team) => !team.external || (team.competitionIds ?? []).includes(id));
  const [selected, setSelected] = useState<string[]>(() =>
    teamsFor(data.competitions[0]?.id ?? "").map((team) => team.id),
  );
  const teams = teamsFor(competitionId);
  const [legs, setLegs] = useState<1 | 2>(1);
  const [firstDate, setFirstDate] = useState("");
  const [startTime, setStartTime] = useState("13:00");
  const [gap, setGap] = useState(7);
  const [groundMode, setGroundMode] = useState<"none" | "rotate" | string>("none");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const competition = data.competitions.find((item) => item.id === competitionId);
  const teamName = (id: string) => data.teams.find((team) => team.id === id)?.name ?? "Team";
  const groundName = (id: string | null) =>
    id ? (data.grounds.find((ground) => ground.id === id)?.name ?? "") : "";

  const plan = useMemo(
    () =>
      buildRoundRobin({
        teamIds: selected,
        doubleRoundRobin: legs === 2,
        firstDate,
        startTime,
        daysBetweenRounds: gap,
        groundIds:
          groundMode === "none"
            ? []
            : groundMode === "rotate"
              ? data.grounds.map((ground) => ground.id)
              : [groundMode],
      }),
    [selected, legs, firstDate, startTime, gap, groundMode, data.grounds],
  );
  const unallocated = groundMode === "none" ? 0 : plan.fixtures.filter((f) => !f.groundId).length;
  const existing = data.fixtures.filter(
    (fixture) => fixture.competitionId === competitionId,
  ).length;

  const toggleTeam = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const create = async () => {
    if (!competition?.ruleVersionId) {
      setMessage({ tone: "error", text: "Choose a competition with an active rule version." });
      return;
    }
    if (
      existing > 0 &&
      !window.confirm(
        `${competition.name} already has ${existing} fixtures. Add ${plan.fixtures.length} more?`,
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      const count = await run(() => createFixtures({ competition, fixtures: plan.fixtures }));
      setMessage({ tone: "ok", text: `${count} fixtures created for ${competition.name}.` });
    } catch (reason) {
      setMessage({
        tone: "error",
        text: reason instanceof Error ? reason.message : "The fixtures could not be created.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (data.competitions.length === 0 || teams.length < 2) return null;
  const rounds = Array.from({ length: plan.rounds }, (_, index) => index + 1);
  const when = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString([], {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Date to be set";

  return (
    <section
      className="rounded-xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10"
      aria-label="Fixture builder"
    >
      <div className="mb-4 flex items-start gap-3">
        <Wand2 className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold">Fixture builder</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Every team plays every other team, nobody plays twice in a round, and home games are
            shared fairly.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block space-y-2">
          <span className="builder-label">Competition</span>
          <select
            value={competitionId}
            onChange={(event) => {
              setCompetitionId(event.target.value);
              setSelected(teamsFor(event.target.value).map((team) => team.id));
            }}
            className="scorer-input"
          >
            {data.competitions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="builder-label">Format</span>
          <select
            value={legs}
            onChange={(event) => setLegs(Number(event.target.value) as 1 | 2)}
            className="scorer-input"
          >
            <option value={1}>Play each team once</option>
            <option value={2}>Home and away (twice)</option>
          </select>
        </label>
        <label className="block space-y-2">
          <span className="builder-label">Grounds</span>
          <select
            value={groundMode}
            onChange={(event) => setGroundMode(event.target.value)}
            className="scorer-input"
          >
            <option value="none">Set later</option>
            {data.grounds.length > 1 && <option value="rotate">Share all grounds</option>}
            {data.grounds.map((ground) => (
              <option key={ground.id} value={ground.id}>
                All at {ground.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="builder-label">First round</span>
          <input
            type="date"
            value={firstDate}
            onChange={(event) => setFirstDate(event.target.value)}
            className="scorer-input"
          />
        </label>
        <label className="block space-y-2">
          <span className="builder-label">Start time</span>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="scorer-input"
          />
        </label>
        <label className="block space-y-2">
          <span className="builder-label">Days between rounds</span>
          <input
            type="number"
            min={1}
            max={60}
            value={gap}
            onChange={(event) =>
              setGap(Math.max(1, Math.min(60, Math.round(Number(event.target.value) || 7))))
            }
            className="scorer-input"
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="builder-label">Teams ({selected.length})</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              aria-pressed={selected.includes(team.id)}
              onClick={() => toggleTeam(team.id)}
              className="builder-team"
            >
              {team.name}
            </button>
          ))}
        </div>
      </fieldset>

      {plan.fixtures.length > 0 ? (
        <>
          <p className="mt-4 text-sm">
            <CalendarRange className="mr-1.5 inline size-4 text-gold" aria-hidden="true" />
            <strong>{plan.fixtures.length} fixtures</strong> over {plan.rounds} rounds
            {plan.byes.length > 0 ? " · one team rests each round" : ""}
          </p>
          {unallocated > 0 && (
            <p role="status" className="mt-3 rounded-lg border border-amber-300/30 p-3 text-sm text-amber-200">
              {unallocated} matches have no available ground in their round. They will be saved as
              undated drafts so you can arrange another venue or time.
            </p>
          )}
          <div className="builder-preview mt-3" aria-label="Fixture preview">
            {rounds.map((round) => (
              <div key={round} className="builder-round">
                <p className="builder-round-head">
                  Round {round}
                  <span>
                    {when(
                      plan.fixtures.find((fixture) => fixture.round === round)?.startsAt ?? null,
                    )}
                  </span>
                </p>
                <ul>
                  {plan.fixtures
                    .filter((fixture) => fixture.round === round)
                    .map((fixture) => (
                      <li key={`${fixture.homeTeamId}-${fixture.awayTeamId}`}>
                        <span className="truncate">
                          {teamName(fixture.homeTeamId)} <span className="text-slate-500">v</span>{" "}
                          {teamName(fixture.awayTeamId)}
                        </span>
                        {fixture.groundId ? (
                          <small className="truncate">{groundName(fixture.groundId)}</small>
                        ) : groundMode !== "none" ? (
                          <small className="text-amber-200">Draft · venue needed</small>
                        ) : null}
                      </li>
                    ))}
                  {plan.byes
                    .filter((bye) => bye.round === round)
                    .map((bye) => (
                      <li key={`bye-${bye.teamId}`} className="text-slate-400">
                        {teamName(bye.teamId)} rest
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          {message && (
            <p
              role={message.tone === "error" ? "alert" : "status"}
              className={`mt-3 text-sm ${message.tone === "error" ? "text-rose-200" : "text-emerald-200"}`}
            >
              {message.text}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {plan.fixtures.length > 400 && (
              <span role="alert" className="text-xs text-amber-200">
                Select fewer teams or one leg: at most 400 fixtures can be created at once.
              </span>
            )}
            {!firstDate && (
              <span className="text-xs text-slate-400">
                No date chosen: fixtures are saved as drafts.
              </span>
            )}
            <button
              type="button"
              className="action-primary"
              disabled={busy || plan.fixtures.length > 400}
              onClick={() => void create()}
            >
              {busy ? "Creating…" : `Create ${plan.fixtures.length} fixtures`}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-400">Choose at least two teams.</p>
      )}
    </section>
  );
}
