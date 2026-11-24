import { useCallback, useEffect, useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { parseHistoricCsv, type HistoricRow } from "@/lib/historic-import";
import { Empty, OfficeCard, OfficeField } from "@/components/office/ui";
import { attempt, must, type DeskProps } from "./shared";

interface Saved {
  id: string;
  player_id: string;
  season: string;
  matches: number;
  runs: number;
  wickets: number;
  high_score: number | null;
  source: string;
}

/** Bring in figures from old scorecards or another app, season by season. */
export function OldStatsPanel({ organisationId, role, club }: DeskProps) {
  const db = getCloudClient();
  const canImport = ["owner", "club_admin", "coach"].includes(role);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [preview, setPreview] = useState<{
    rows: HistoricRow[];
    unknownNames: string[];
    error: string | null;
  } | null>(null);
  const [season, setSeason] = useState(String(new Date().getFullYear() - 1));
  const [source, setSource] = useState("Old scorecards");
  const load = useCallback(async () => {
    const { data } = await db
      .from("historic_player_stats")
      .select("id,player_id,season,matches,runs,wickets,high_score,source")
      .eq("organisation_id", organisationId)
      .order("season", { ascending: false })
      .limit(500);
    setSaved((data ?? []) as Saved[]);
  }, [db, organisationId]);
  useEffect(() => void load(), [load]);
  const read = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000)
      return setPreview({ rows: [], unknownNames: [], error: "Choose a file under 2 MB." });
    setPreview(parseHistoricCsv(await file.text(), club.players, season));
  };
  const save = () =>
    attempt(
      () =>
        must(
          db.from("historic_player_stats").upsert(
            preview!.rows.map((r) => ({
              organisation_id: organisationId,
              player_id: r.playerId,
              season: r.season,
              matches: r.matches,
              innings: r.innings,
              not_outs: r.notOuts,
              runs: r.runs,
              balls_faced: r.ballsFaced,
              high_score: r.highScore,
              fours: r.fours,
              sixes: r.sixes,
              balls_bowled: r.ballsBowled,
              runs_conceded: r.runsConceded,
              wickets: r.wickets,
              catches: r.catches,
              stumpings: r.stumpings,
              source: source.trim().slice(0, 60) || "import",
            })),
            { onConflict: "player_id,season,source" },
          ),
        ),
      `${preview!.rows.length} season records imported`,
      async () => {
        setPreview(null);
        await load();
      },
    );
  const name = (id: string) => club.players.find((p) => p.id === id)?.name ?? "Player";
  return (
    <div className="space-y-4">
      {canImport && (
        <OfficeCard
          title="Import old scorecards"
          description="A spreadsheet (CSV) with a row per player: Name, Season, M, Inns, NO, Runs, HS, Balls, 4s, 6s, O, R, W, Ct, St. Names must match your player list."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <OfficeField label="Season (if not in the file)">
              <input
                className="scorer-input"
                maxLength={40}
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              />
            </OfficeField>
            <OfficeField label="Where it's from">
              <input
                className="scorer-input"
                maxLength={60}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </OfficeField>
            <OfficeField label="File">
              <input
                type="file"
                accept=".csv,text/csv,.txt"
                className="scorer-input"
                onChange={(e) => void read(e.target.files?.[0])}
              />
            </OfficeField>
          </div>
          {preview?.error && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {preview.error}
            </p>
          )}
          {preview && !preview.error && (
            <div className="mt-3 space-y-2">
              <p className="text-sm">
                {preview.rows.length} rows ready.
                {preview.unknownNames.length
                  ? ` Not matched (add them as players first): ${preview.unknownNames.slice(0, 10).join(", ")}${preview.unknownNames.length > 10 ? "…" : ""}`
                  : ""}
              </p>
              <button
                type="button"
                className="action-primary"
                disabled={!preview.rows.length}
                onClick={() => void save()}
              >
                <FileUp className="size-4" /> Import {preview.rows.length} rows
              </button>
            </div>
          )}
        </OfficeCard>
      )}
      <OfficeCard
        title="Imported seasons"
        description="Shown alongside each player's CricLume career."
      >
        {saved.length === 0 ? (
          <Empty>Nothing imported yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="office-meta">
              <tr>
                <th className="text-left">Player</th>
                <th className="text-left">Season</th>
                <th className="text-right">M</th>
                <th className="text-right">Runs</th>
                <th className="text-right">HS</th>
                <th className="text-right">Wkts</th>
                <th />
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {saved.map((s) => (
                <tr key={s.id} className="border-t border-border/60">
                  <td className="py-1">{name(s.player_id)}</td>
                  <td>{s.season}</td>
                  <td className="text-right">{s.matches}</td>
                  <td className="text-right">{s.runs}</td>
                  <td className="text-right">{s.high_score ?? "–"}</td>
                  <td className="text-right">{s.wickets}</td>
                  <td className="text-right">
                    {canImport && (
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() =>
                          void attempt(
                            () => must(db.from("historic_player_stats").delete().eq("id", s.id)),
                            "Removed",
                            load,
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </OfficeCard>
    </div>
  );
}
