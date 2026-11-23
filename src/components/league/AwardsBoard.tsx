import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Gift, Pencil, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { awardBoard, tournamentAwards, type AwardSetting, type TournamentAwardCategory } from "@/lib/awards";
import type { CricketMatch } from "@/lib/cricket";

/** Tournament awards worked out from the scorecards, with prizes and organiser overrides. */
export function AwardsBoard({ matches, competitionId, organisationId, onPlayer }: { matches: readonly CricketMatch[]; competitionId: string; organisationId: string; onPlayer: (id: string) => void }) {
  const [settings, setSettings] = useState<AwardSetting[]>([]);
  const [editing, setEditing] = useState<TournamentAwardCategory | null>(null);
  const [draft, setDraft] = useState({ prize: "", winner: "" });
  const automatic = useMemo(() => tournamentAwards(matches), [matches]);
  const rows = awardBoard(automatic, settings);
  const players = useMemo(() => {
    const map = new Map<string, string>();
    for (const match of matches) for (const team of match.teams) for (const player of team.players) map.set(player.id, `${player.name} (${team.name})`);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [matches]);

  const load = useCallback(async () => {
    if (!competitionId) return;
    const { data } = await supabase.from("competition_awards").select("category,prize,winner_player_id,winner_name").eq("competition_id", competitionId);
    setSettings((data ?? []).map((row) => ({ category: row.category, prize: row.prize, winnerPlayerId: row.winner_player_id, winnerName: row.winner_name })));
  }, [competitionId]);
  useEffect(() => void load(), [load]);

  async function save(category: TournamentAwardCategory) {
    const winnerName = draft.winner ? players.find(([id]) => id === draft.winner)?.[1].replace(/ \(.*\)$/, "") ?? null : null;
    const { error } = await supabase.from("competition_awards").upsert(
      { competition_id: competitionId, organisation_id: organisationId, category, prize: draft.prize.trim() || null, winner_player_id: draft.winner || null, winner_name: winnerName },
      { onConflict: "competition_id,category" },
    );
    if (error) return void toast.error("Only owners, league admins and club admins can change awards.");
    toast.success("Award saved.");
    setEditing(null);
    void load();
  }

  if (!competitionId) return <p className="text-sm text-slate-400">Pick a competition to see its awards.</p>;
  return (
    <ul className="space-y-2" aria-label="Tournament awards">
      {rows.map((row) => (
        <li key={row.category} className="broadcast-panel space-y-2 p-3">
          <div className="award-row">
            <span className="award-icon" aria-hidden="true">{row.category === "player-of-tournament" ? <Trophy className="size-4" /> : <Award className="size-4" />}</span>
            <span className="min-w-0">
              <span className="panel-kicker block">{row.label}</span>
              {row.winner ? (
                <button type="button" className="block truncate text-left font-semibold underline-offset-2 hover:underline" onClick={() => onPlayer(row.winner!.playerId)}>
                  {row.winner.name}
                  <span className="ml-1 text-xs font-normal text-slate-400">{row.winner.team ? `${row.winner.team} · ` : ""}{row.winner.value}</span>
                </button>
              ) : (
                <span className="block text-sm text-slate-400">Nobody yet</span>
              )}
              {row.prize && <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-gold"><Gift className="size-3.5" aria-hidden="true" /> {row.prize}</span>}
            </span>
            <button type="button" className="workspace-nav-item inline-flex min-h-9 items-center gap-1 text-xs" aria-label={`Edit ${row.label}`}
              onClick={() => { setEditing(row.category); setDraft({ prize: row.prize ?? "", winner: settings.find((item) => item.category === row.category)?.winnerPlayerId ?? "" }); }}>
              <Pencil className="size-3.5" aria-hidden="true" /> Edit
            </button>
          </div>
          {editing === row.category && (
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs">Prize
                <input className="scout-input" maxLength={200} value={draft.prize} onChange={(event) => setDraft({ ...draft, prize: event.target.value })} placeholder="e.g. Trophy + PKR 10,000" />
              </label>
              <label className="text-xs">Winner
                <select className="scout-input" value={draft.winner} onChange={(event) => setDraft({ ...draft, winner: event.target.value })}>
                  <option value="">Automatic{row.automatic ? ` (${row.automatic.name})` : ""}</option>
                  {players.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button type="button" className="action-primary" onClick={() => void save(row.category)}>Save</button>
                <button type="button" className="action-secondary" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
