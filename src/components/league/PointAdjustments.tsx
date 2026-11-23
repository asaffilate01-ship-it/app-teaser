import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MinusCircle, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AdjustmentRow {
  id: string;
  team_id: string;
  points: number;
  reason: string;
  created_at: string;
}

/**
 * Points the league adds or takes away (late result, unregistered player, conceded match…).
 * Everyone who can see the table sees the list; the database only lets the league's owner or
 * league admins add or remove one.
 */
export function PointAdjustments({
  competitionId,
  teamIds,
  teamName,
  canManage,
  onChanged,
}: {
  competitionId: string;
  teamIds: string[];
  teamName: (id: string | null) => string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<AdjustmentRow[]>([]);
  const [teamId, setTeamId] = useState("");
  const [points, setPoints] = useState("-1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase
      .from("competition_point_adjustments")
      .select("id,team_id,points,reason,created_at")
      .eq("competition_id", competitionId)
      .order("created_at");
    setRows((data ?? []).map((row) => ({ ...row, points: Number(row.points) })));
  }, [competitionId]);
  useEffect(() => void load(), [load]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(points);
    if (!teamId || !Number.isFinite(value) || value === 0 || Math.abs(value) > 100) return void toast.error("Pick a team and a points change between -100 and 100 (not 0).");
    if (reason.trim().length < 3) return void toast.error("Say why, so teams can see the reason.");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("competition_point_adjustments").insert({
      competition_id: competitionId,
      team_id: teamId,
      points: value,
      reason: reason.trim(),
      created_by: auth.user?.id ?? null,
    });
    setBusy(false);
    if (error) return void toast.error(/row-level/i.test(error.message) ? "Only the league's owner or league admins can change points, and only for teams in this competition." : error.message);
    toast.success(value < 0 ? "Points deducted — the table is updated" : "Points added — the table is updated");
    setReason("");
    await load();
    onChanged();
  };
  const remove = async (row: AdjustmentRow) => {
    if (!window.confirm(`Remove the ${row.points > 0 ? "+" : ""}${row.points} for ${teamName(row.team_id)}?`)) return;
    const { error } = await supabase.from("competition_point_adjustments").delete().eq("id", row.id);
    if (error) return void toast.error("Only the league's owner or league admins can remove it.");
    await load();
    onChanged();
  };

  if (!rows.length && !canManage) return null;
  return (
    <section className="broadcast-panel space-y-3 p-4" aria-label="Points added or deducted">
      <div>
        <p className="panel-kicker">Points changes</p>
        <p className="text-xs text-slate-400">Deductions and awards made by the league. They're already inside the points above.</p>
      </div>
      {rows.length > 0 ? (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} className="office-row">
              <span className="min-w-0">
                <strong className={row.points < 0 ? "text-rose-300" : "text-emerald-300"}>
                  {row.points > 0 ? "+" : ""}
                  {row.points} pts
                </strong>{" "}
                {teamName(row.team_id)}
                <span className="block text-xs text-slate-400">{row.reason}</span>
              </span>
              {canManage && (
                <button type="button" className="app-chip-button" aria-label={`Remove points change for ${teamName(row.team_id)}`} onClick={() => void remove(row)}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">No points changes.</p>
      )}
      {canManage && (
        <form onSubmit={(event) => void add(event)} className="grid gap-2 sm:grid-cols-[1fr_7rem_2fr_auto]">
          <select className="scorer-input" aria-label="Team" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <option value="">Team…</option>
            {teamIds.map((id) => (
              <option key={id} value={id}>
                {teamName(id)}
              </option>
            ))}
          </select>
          <input className="scorer-input" aria-label="Points (minus to deduct)" type="number" step="0.5" min="-100" max="100" value={points} onChange={(event) => setPoints(event.target.value)} />
          <input className="scorer-input" aria-label="Reason" maxLength={300} placeholder="Reason, e.g. unregistered player v Riverside" value={reason} onChange={(event) => setReason(event.target.value)} />
          <button className="action-primary" disabled={busy}>
            {Number(points) < 0 ? <MinusCircle className="size-4" /> : <PlusCircle className="size-4" />} Save
          </button>
        </form>
      )}
    </section>
  );
}
