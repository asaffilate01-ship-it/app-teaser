import { useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { createPlayer, createTeam, type PlatformDashboardData } from "@/lib/platform-cloud";
import { planSquadImport, SQUAD_TEMPLATE_CSV } from "@/lib/squad-import";

type RunAction = <T>(action: () => Promise<T>) => Promise<T>;

/** Paste or upload a spreadsheet (CSV) of teams and players; preview, then import in one go. */
export function SquadImport({ data, run }: { data: PlatformDashboardData; run: RunAction }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const plan = useMemo(() => (text.trim() ? planSquadImport(text, data) : null), [text, data]);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      toast.error("That file is over 1 MB. Save it as CSV and try again.");
      return;
    }
    setText(await file.text());
  };
  const template = () => {
    const url = URL.createObjectURL(new Blob([SQUAD_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "criclume-squad-template.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importAll = async () => {
    if (!plan || plan.players.length === 0) return;
    setBusy(true);
    try {
      await run(async () => {
        const teamIds = new Map(data.teams.filter((team) => !team.external).map((team) => [team.name.trim().toLowerCase(), team.id]));
        for (const team of plan.newTeams) {
          setProgress(`Creating ${team.name}…`);
          const id = await createTeam({ organisationId: data.organisationId, name: team.name, shortName: team.shortName, ...(team.ageGroup ? { ageGroup: team.ageGroup } : {}) });
          teamIds.set(team.name.toLowerCase(), id);
        }
        let done = 0;
        for (const player of plan.players) {
          setProgress(`Adding players ${++done} of ${plan.players.length}…`);
          const teamId = teamIds.get(player.team.toLowerCase());
          if (!teamId) continue;
          await createPlayer({ organisationId: data.organisationId, teamId, name: player.name, isJunior: player.isJunior, publicProfile: player.publicProfile });
        }
      });
      toast.success(`Imported ${plan.players.length} players${plan.newTeams.length ? ` and ${plan.newTeams.length} teams` : ""}.`);
      setText("");
    } catch {
      toast.error("The import stopped part-way. Anything already added is kept — import the same sheet again to add the rest.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10" aria-label="Import from a spreadsheet">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <FileSpreadsheet className="size-5 text-gold" aria-hidden="true" /> Import from a spreadsheet
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
            Columns: Team, Player, and optionally Junior and Public (yes/no). Save from Excel or Google Sheets as CSV, or paste the cells straight in. Juniors are never made public.
          </p>
        </div>
        <button type="button" className="action-secondary" onClick={template}>
          <Download className="size-4" aria-hidden="true" /> Template
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <textarea
          className="scorer-input min-h-28 font-mono text-xs"
          placeholder={"Team,Player,Junior,Public\nFirst XI,Sam Patel,no,yes"}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="Spreadsheet rows"
        />
        <label className="action-secondary h-fit cursor-pointer">
          Choose CSV file
          <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
        </label>
      </div>
      {plan && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="hero-chip">{plan.players.length} player{plan.players.length === 1 ? "" : "s"} to add</span>
            <span className="hero-chip">{plan.newTeams.length} new team{plan.newTeams.length === 1 ? "" : "s"}</span>
            {plan.skipped.length > 0 && <span className="hero-chip">{plan.skipped.length} row{plan.skipped.length === 1 ? "" : "s"} skipped</span>}
          </div>
          {plan.newTeams.length > 0 && <p className="text-xs text-slate-300">New teams: {plan.newTeams.map((team) => team.name).join(", ")}</p>}
          {plan.skipped.length > 0 && (
            <ul className="max-h-32 overflow-auto rounded-lg border border-white/10 p-2 text-xs text-slate-400">
              {plan.skipped.slice(0, 50).map((row) => (
                <li key={`${row.line}-${row.reason}`}>
                  Row {row.line}: {row.reason}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="action-primary" disabled={busy || plan.players.length === 0} onClick={() => void importAll()}>
            {busy ? progress || "Importing…" : `Import ${plan.players.length} players`}
          </button>
        </div>
      )}
    </section>
  );
}
