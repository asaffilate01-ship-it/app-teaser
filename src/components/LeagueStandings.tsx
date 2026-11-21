import { useMemo } from "react";
import { BarChart3, Download } from "lucide-react";
import { buildLeagueStandings, leagueStandingsCsv } from "@/lib/league-standings";
import type { CompetitionRecord, FixtureRecord, TeamRecord } from "@/lib/platform-cloud";

export function LeagueStandings({
  competition,
  fixtures,
  teams,
}: {
  competition: CompetitionRecord;
  fixtures: FixtureRecord[];
  teams: TeamRecord[];
}) {
  const preview = useMemo(
    () => buildLeagueStandings({ competition, fixtures, teams }),
    [competition, fixtures, teams],
  );
  const names = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const download = () => {
    if (!preview.counted || preview.blockedReason) return;
    const csv = leagueStandingsCsv(preview.rows, names);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `criclume-${competition.id.slice(0, 8)}-provisional-table.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section
      aria-label={`${competition.name} league standings preview`}
      className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-amber-200" aria-hidden="true" />
            <h4 className="text-base font-bold text-slate-100">Provisional league table</h4>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-400">
            Based only on explicitly signed-off fixture results under the current rule version.
            CricLume does not infer winners or scores from incomplete fixtures.
            NRR uses recorded legal balls and may require adjustments for all-outs and rain.
            This preview does not publish official results.
          </p>
        </div>
        <button
          className="workspace-nav-item"
          type="button"
          onClick={download}
          disabled={!preview.counted || Boolean(preview.blockedReason)}
        >
          <Download className="size-4" aria-hidden="true" />
          Export table CSV
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-300">
        <span>{preview.counted} signed-off result(s) counted</span>
        <span>{preview.awaitingReview} completed/abandoned fixture(s) awaiting valid review</span>
        <span>{preview.scheduled} other fixture(s)</span>
      </div>
      {preview.blockedReason ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-amber-300/30 p-3 text-sm text-amber-200"
        >
          {preview.blockedReason} Standings are not calculated.
        </p>
      ) : !preview.counted ? (
        <p role="status" className="mt-4 text-sm text-slate-400">
          No eligible, signed-off results yet. The competition table will appear when results
          contain an unambiguous decision and complete scoring facts.
        </p>
      ) : (
        <div
          className="mt-4 overflow-x-auto"
          role="region"
          aria-label={`${competition.name} league table; scroll horizontally if needed`}
          tabIndex={0}
        >
          <table className="min-w-[650px] w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-slate-400">
              <tr>
                {["#", "Team", "P", "W", "T", "L", "NR", "Pts", "NRR"].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-3 py-2 font-semibold"
                    title={label === "NRR" ? "Net run rate" : label === "NR" ? "No result" : undefined}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, index) => (
                <tr key={row.teamId} className="border-b border-white/5">
                  <td className="px-3 py-3 tabular-nums">{index + 1}</td>
                  <th scope="row" className="px-3 py-3 font-semibold text-slate-100">
                    {names.get(row.teamId) ?? "Unknown team"}
                  </th>
                  {[row.played, row.won, row.tied, row.lost, row.noResult, row.points].map(
                    (value, metric) => (
                      <td key={metric} className="px-3 py-3 tabular-nums">
                        {value}
                      </td>
                    ),
                  )}
                  <td className="px-3 py-3 tabular-nums">
                    {row.netRunRate > 0 ? "+" : ""}
                    {row.netRunRate.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {preview.awaitingReview > 0 && !preview.blockedReason && (
        <p className="mt-3 text-xs text-amber-200">
          Some results were excluded. Rankings may change after organiser verification.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Only teams listed in the organisation's recorded competition fixtures are represented.
        Rule-version changes and unsupported tie-breakers require organiser review.
      </p>
    </section>
  );
}
