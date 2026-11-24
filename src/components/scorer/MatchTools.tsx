import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Coins,
  HeartPulse,
  Pencil,
  Repeat,
  UserPlus,
  Users,
} from "lucide-react";
import {
  addPlayer,
  availableBatters,
  currentInnings,
  findPlayer,
  findTeam,
  movePlayer,
  recordToss,
  renamePlayer,
  retireBatter,
  retiredHurtWaiting,
  setPlayerHand,
  substitutePlayer,
  tossSummary,
  type CricketMatch,
  type SubstituteKind,
  type RetirementKind,
  type YouthBand,
} from "@/lib/cricket";
import {
  bowlingWorkload,
  youthBandFrom,
  youthBands,
  youthBowlingLimits,
} from "@/lib/bowling-workload";
import { addCloudSquadPlayer } from "@/lib/cloud";

type Save = (match: CricketMatch) => void;

/** Who won the toss. The decision follows from who is batting first. */
export function TossPanel({ match, onSave }: { match: CricketMatch; onSave: Save }) {
  const [editing, setEditing] = useState(!match.toss);
  const summary = tossSummary(match);
  if (!editing && summary) {
    return (
      <section
        className="broadcast-panel flex flex-wrap items-center justify-between gap-2 p-4"
        aria-label="Toss"
      >
        <p className="flex items-center gap-2 text-sm">
          <Coins className="size-4 text-gold" aria-hidden="true" /> {summary}
        </p>
        <button type="button" className="app-chip-button" onClick={() => setEditing(true)}>
          <Pencil className="size-4" /> Change
        </button>
      </section>
    );
  }
  const first = findTeam(match, match.innings[0]!.battingTeamId);
  return (
    <section className="broadcast-panel space-y-3 p-4" aria-label="Toss">
      <div>
        <h2 className="panel-kicker">Toss</h2>
        <p className="text-xs text-muted-foreground">
          {first.name} are batting first. Who won the toss?
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {match.teams.map((team) => (
          <button
            key={team.id}
            type="button"
            className="app-chip-button"
            aria-pressed={match.toss?.winnerTeamId === team.id}
            onClick={() => {
              onSave(recordToss(match, team.id));
              setEditing(false);
            }}
          >
            {team.name} {team.id === first.id ? "(chose to bat)" : "(chose to bowl)"}
          </button>
        ))}
      </div>
    </section>
  );
}

const retireLabels: Record<RetirementKind, string> = {
  hurt: "Retired hurt",
  out: "Retired out",
  "timed-out": "Timed out",
};

/** Retired hurt (can come back), retired out, timed out — without recording a ball. */
export function RetirePanel({ match, onSave }: { match: CricketMatch; onSave: Save }) {
  const innings = currentInnings(match);
  const team = findTeam(match, innings.battingTeamId);
  const atCrease = [...new Set([innings.strikerId, innings.nonStrikerId])].filter(Boolean);
  const [batterId, setBatterId] = useState(atCrease[0] ?? "");
  const [kind, setKind] = useState<RetirementKind>("hurt");
  const chosen = atCrease.includes(batterId) ? batterId : (atCrease[0] ?? "");
  const other = atCrease.find((id) => id !== chosen);
  const options = availableBatters(team, innings, [chosen, ...(other ? [other] : [])]);
  const [replacementId, setReplacementId] = useState("");
  const waiting = retiredHurtWaiting(innings);
  const faced = innings.deliveries.some((d) => d.strikerId === chosen || d.nonStrikerId === chosen);
  if (match.status !== "live" || !chosen) return null;
  const confirm = () => {
    const name = findPlayer(match, chosen)?.name ?? "Batter";
    if (
      !window.confirm(
        `${name}: ${retireLabels[kind].toLowerCase()}?${kind === "hurt" ? " They can come back in later." : " This counts as a wicket."}`,
      )
    )
      return;
    onSave(retireBatter(match, chosen, kind, replacementId || undefined));
    setReplacementId("");
  };
  return (
    <section className="broadcast-panel space-y-3 p-4" aria-label="Retire a batter">
      <div>
        <h2 className="panel-kicker flex items-center gap-2">
          <HeartPulse className="size-4" aria-hidden="true" /> Retire a batter
        </h2>
        <p className="text-xs text-muted-foreground">
          Between balls. Retired hurt is not a wicket and the batter can come back later; retired
          out and timed out are wickets.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs">
          Batter
          <select
            className="scorer-input mt-1"
            value={chosen}
            onChange={(e) => setBatterId(e.target.value)}
          >
            {atCrease.map((id) => (
              <option key={id} value={id}>
                {findPlayer(match, id)?.name ?? "Batter"}
                {id === innings.strikerId ? " (on strike)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          How
          <select
            className="scorer-input mt-1"
            value={kind}
            onChange={(e) => setKind(e.target.value as RetirementKind)}
          >
            {(Object.keys(retireLabels) as RetirementKind[])
              .filter((value) => value !== "timed-out" || !faced)
              .map((value) => (
                <option key={value} value={value}>
                  {retireLabels[value]}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-xs">
          Next in
          <select
            className="scorer-input mt-1"
            value={replacementId}
            onChange={(e) => setReplacementId(e.target.value)}
          >
            <option value="">
              {options[0]
                ? `${findPlayer(match, options[0])?.name ?? "Next batter"} (next in order)`
                : "Nobody left"}
            </option>
            {options.slice(1).map((id) => (
              <option key={id} value={id}>
                {findPlayer(match, id)?.name}
                {waiting.includes(id) ? " (returning)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {waiting.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Retired hurt, can come back:{" "}
          {waiting.map((id) => findPlayer(match, id)?.name ?? "Batter").join(", ")}. Pick them as
          the next batter, or as striker or non-striker.
        </p>
      )}
      <button type="button" className="action-secondary" onClick={confirm}>
        <HeartPulse className="size-4" /> Record {retireLabels[kind].toLowerCase()}
      </button>
    </section>
  );
}

/** Add or rename players, mark left-handers and change the batting order, without leaving the match. */
export function SquadPanel({
  match,
  onSave,
  cloudMatchId,
}: {
  match: CricketMatch;
  onSave: Save;
  cloudMatchId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState(match.teams[0].id);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const team = match.teams.find((item) => item.id === teamId) ?? match.teams[0];
  const add = async () => {
    const clean = name.trim();
    if (clean.length < 2) return setError("Enter the player's name.");
    setError(null);
    setBusy(true);
    try {
      // Cloud matches: the player joins the club's list and this match's squad first, so their balls are accepted.
      const id = cloudMatchId ? await addCloudSquadPlayer(cloudMatchId, team.id, clean) : undefined;
      onSave(addPlayer(match, team.id, clean, id));
      setName("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The player could not be added.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="broadcast-panel space-y-3 p-4" aria-label="Players">
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="panel-kicker flex items-center gap-2">
          <Users className="size-4" aria-hidden="true" /> Players and batting order
        </span>
        <span className="text-xs text-muted-foreground">
          {open ? "Hide" : "Add · rename · left-handers · order"}
        </span>
      </button>
      {open && (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Team">
            {match.teams.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === team.id}
                className="app-chip-button"
                aria-pressed={item.id === team.id}
                onClick={() => setTeamId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <ol className="space-y-1.5">
            {team.players.map((player, index) => (
              <li
                key={player.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2"
              >
                <span className="w-5 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                {renaming?.id === player.id ? (
                  <form
                    className="flex min-w-0 flex-1 gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onSave(renamePlayer(match, player.id, renaming.name));
                      setRenaming(null);
                    }}
                  >
                    <input
                      className="scorer-input min-w-0 flex-1"
                      aria-label="New name"
                      maxLength={60}
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: player.id, name: e.target.value })}
                      autoFocus
                    />
                    <button className="app-chip-button">Save</button>
                  </form>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {player.name}
                    {player.leftHanded && (
                      <span className="ml-1 text-[10px] font-bold text-gold">LH</span>
                    )}
                  </span>
                )}
                <button
                  type="button"
                  className="app-chip-button"
                  aria-pressed={Boolean(player.leftHanded)}
                  onClick={() => onSave(setPlayerHand(match, player.id, !player.leftHanded))}
                  title="Bats left-handed"
                >
                  LH
                </button>
                <button
                  type="button"
                  className="app-chip-button"
                  aria-label={`Rename ${player.name}`}
                  onClick={() => setRenaming({ id: player.id, name: player.name })}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="app-chip-button"
                  aria-label={`Move ${player.name} up`}
                  disabled={index === 0}
                  onClick={() => onSave(movePlayer(match, team.id, player.id, -1))}
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="app-chip-button"
                  aria-label={`Move ${player.name} down`}
                  disabled={index === team.players.length - 1}
                  onClick={() => onSave(movePlayer(match, team.id, player.id, 1))}
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </li>
            ))}
          </ol>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <input
              className="scorer-input min-w-0 flex-1"
              aria-label={`New player for ${team.name}`}
              placeholder={`Add a player to ${team.name}`}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="action-primary" disabled={busy}>
              <UserPlus className="size-4" /> {busy ? "Adding…" : "Add"}
            </button>
          </form>
          {error && (
            <p className="text-xs text-rose-300" role="alert">
              {error}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            The batting order is who comes in next after a wicket. Names you change here are for
            this match only.
          </p>
        </>
      )}
    </section>
  );
}

/** Junior fast-bowling limits: overs per spell and per day, and rest between spells. */
export function WorkloadPanel({ match, onSave }: { match: CricketMatch; onSave: Save }) {
  const band = match.settings.rules?.youthBowling ?? null;
  const suggested = youthBandFrom(match.teams.map((team) => team.name).join(" "));
  const loads = bowlingWorkload(match, band).filter((item) => item.pace);
  const setBand = (next: YouthBand | null) =>
    onSave({
      ...match,
      updatedAt: new Date().toISOString(),
      settings: { ...match.settings, rules: { ...match.settings.rules, youthBowling: next } },
    });
  return (
    <section className="broadcast-panel space-y-3 p-4" aria-label="Bowling workload">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="panel-kicker">Bowling workload</h2>
          <p className="text-xs text-muted-foreground">
            Junior fast-bowling limits (ECB directives). Warnings only — check your league's own
            rules.
          </p>
        </div>
        <select
          className="scorer-input w-auto"
          aria-label="Junior age group"
          value={band ?? ""}
          onChange={(e) => setBand((e.target.value || null) as YouthBand | null)}
        >
          <option value="">No junior limits</option>
          {youthBands.map((item) => (
            <option key={item} value={item}>
              {item}: {youthBowlingLimits[item].spell} per spell, {youthBowlingLimits[item].day} a
              day
            </option>
          ))}
        </select>
      </div>
      {!band && suggested && (
        <button type="button" className="app-chip-button" onClick={() => setBand(suggested)}>
          Looks like a {suggested} match — switch on {suggested} limits
        </button>
      )}
      {band && loads.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No pace bowlers have bowled in this innings yet.
        </p>
      )}
      {band && loads.length > 0 && (
        <ul className="space-y-1.5">
          {loads.map((load) => (
            <li
              key={load.bowlerId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              data-status={load.status}
            >
              <span className="font-semibold">
                {findPlayer(match, load.bowlerId)?.name ?? "Bowler"}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                Spell {load.spellOvers}/{youthBowlingLimits[band].spell} · Today {load.dayOvers}/
                {youthBowlingLimits[band].day}
              </span>
              {load.message && (
                <span
                  className={`w-full text-xs ${load.status === "limit" || load.status === "resting" ? "text-rose-300" : "text-amber-200"}`}
                >
                  {load.message}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const subLabels = {
  fielding: "Fielding substitute",
  concussion: "Concussion replacement",
  impact: "Impact player swap",
} as const;

/** Fielding subs (field only), concussion replacements and impact-player swaps (take over a player's place). */
export function SubstitutePanel({
  match,
  onSave,
  cloudMatchId,
}: {
  match: CricketMatch;
  onSave: Save;
  cloudMatchId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState(match.teams[0].id);
  const [kind, setKind] = useState<SubstituteKind>("fielding");
  const [outId, setOutId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const team = match.teams.find((item) => item.id === teamId) ?? match.teams[0];
  const replaceable = team.players.filter(
    (player) => !player.replacedBy && player.substitute !== "fielding",
  );
  const subs = match.teams.flatMap((item) =>
    item.players.filter((player) => player.substitute).map((player) => ({ player, team: item })),
  );
  const bring = async () => {
    setError(null);
    const check = substitutePlayer(
      match,
      team.id,
      kind,
      name,
      kind === "fielding" ? undefined : outId,
    );
    if ("error" in check) return setError(check.error);
    setBusy(true);
    try {
      const id = cloudMatchId
        ? await addCloudSquadPlayer(cloudMatchId, team.id, name.trim())
        : undefined;
      const result = substitutePlayer(
        match,
        team.id,
        kind,
        name,
        kind === "fielding" ? undefined : outId,
        id,
      );
      if ("error" in result) return setError(result.error);
      onSave(result.match);
      setName("");
      setOutId("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The substitute could not be added.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="broadcast-panel space-y-3 p-4" aria-label="Substitutes">
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="panel-kicker flex items-center gap-2">
          <Repeat className="size-4" aria-hidden="true" /> Substitutes
        </span>
        <span className="text-xs text-muted-foreground">
          {open ? "Hide" : "Fielding · concussion · impact player"}
        </span>
      </button>
      {open && (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Team">
            {match.teams.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === team.id}
                className="app-chip-button"
                aria-pressed={item.id === team.id}
                onClick={() => setTeamId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-xs">
              Type
              <select
                className="scorer-input mt-1"
                value={kind}
                onChange={(e) => setKind(e.target.value as SubstituteKind)}
              >
                {(Object.keys(subLabels) as SubstituteKind[]).map((value) => (
                  <option key={value} value={value}>
                    {subLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            {kind !== "fielding" && (
              <label className="block text-xs">
                Replacing
                <select
                  className="scorer-input mt-1"
                  value={outId}
                  onChange={(e) => setOutId(e.target.value)}
                >
                  <option value="">Choose a player</option>
                  {replaceable.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-xs">
              Substitute's name
              <input
                className="scorer-input mt-1"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kind === "fielding"
              ? "Fields only — cannot bat or bowl. Catches and run outs are credited to them."
              : "Takes over the player's place: can bat and bowl; the replaced player can't. Their earlier runs and wickets stay on the card."}
          </p>
          <button
            type="button"
            className="action-secondary"
            disabled={busy}
            onClick={() => void bring()}
          >
            <Repeat className="size-4" /> {busy ? "Adding…" : "Bring on substitute"}
          </button>
          {error && (
            <p className="text-xs text-rose-300" role="alert">
              {error}
            </p>
          )}
          {subs.length > 0 && (
            <ul className="space-y-1 text-xs">
              {subs.map(({ player, team: item }) => (
                <li key={player.id} className="rounded-lg border border-border px-3 py-1.5">
                  <strong>{player.name}</strong> ({item.name}) ·{" "}
                  {subLabels[player.substitute!].toLowerCase()}
                  {player.replaces
                    ? ` for ${findPlayer(match, player.replaces)?.name ?? "a player"}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
