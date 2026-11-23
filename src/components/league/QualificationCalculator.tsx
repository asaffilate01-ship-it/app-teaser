import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { ballsToPassNrr, marginToPassNrr, netRunRate, qualificationReport, type QualTableRow, type RemainingFixture } from "@/lib/qualification";

const statusText = {
  through: "Through, whatever happens",
  out: "Can no longer qualify",
  "in-hand": "In their own hands",
  "needs-help": "Need other results to go their way",
} as const;

/** "What do we need to qualify?" for any team: scenarios from the remaining fixtures plus run-rate targets. */
export function QualificationCalculator({
  rows,
  remaining,
  teamName,
  winPoints,
  lossPoints,
  oversPerInnings,
  ballsPerOver,
}: {
  rows: QualTableRow[];
  remaining: RemainingFixture[];
  teamName: (id: string) => string;
  winPoints: number;
  lossPoints: number;
  oversPerInnings: number | null;
  ballsPerOver: number;
}) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.points - a.points || netRunRate(b, ballsPerOver) - netRunRate(a, ballsPerOver)), [rows, ballsPerOver]);
  const [teamId, setTeamId] = useState(sorted[Math.min(sorted.length - 1, 4)]?.teamId ?? sorted[0]?.teamId ?? "");
  const [spots, setSpots] = useState(Math.max(1, Math.min(4, sorted.length - 1)));
  const [score, setScore] = useState(oversPerInnings ? Math.round(oversPerInnings * 7.5) : 150);
  if (sorted.length < 2) return null;
  const team = sorted.find((row) => row.teamId === teamId) ?? sorted[0]!;
  const report = qualificationReport({ rows: sorted, remaining, teamId: team.teamId, spots, winPoints, lossPoints });
  // The side to catch: the team in the last qualifying place (or the next one up if we are already in it).
  const position = sorted.findIndex((row) => row.teamId === team.teamId);
  const rival = sorted[position < spots ? spots : spots - 1];
  const rivalNrr = rival && rival.teamId !== team.teamId ? netRunRate(rival, ballsPerOver) : null;
  const margin = rivalNrr !== null && oversPerInnings ? marginToPassNrr(team, rivalNrr, score, oversPerInnings, ballsPerOver) : null;
  const chaseBalls = rivalNrr !== null && oversPerInnings ? ballsToPassNrr(team, rivalNrr, score + 1, oversPerInnings, ballsPerOver) : null;
  const oversText = (balls: number) => `${Math.floor(balls / ballsPerOver)}.${balls % ballsPerOver}`;

  return (
    <section className="broadcast-panel" aria-label="What do we need to qualify">
      <h3 className="panel-kicker inline-flex items-center gap-2">
        <Calculator className="size-4" aria-hidden="true" /> What do we need?
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-semibold">
          Team
          <select className="scorer-input min-h-10" value={team.teamId} onChange={(event) => setTeamId(event.target.value)}>
            {sorted.map((row) => (
              <option key={row.teamId} value={row.teamId}>
                {teamName(row.teamId)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Places that qualify
          <input
            className="scorer-input min-h-10"
            type="number"
            min={1}
            max={sorted.length - 1}
            value={spots}
            onChange={(event) => setSpots(Math.max(1, Math.min(sorted.length - 1, Math.round(Number(event.target.value) || 1))))}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Typical score for run-rate maths
          <input
            className="scorer-input min-h-10"
            type="number"
            min={1}
            max={999}
            value={score}
            onChange={(event) => setScore(Math.max(1, Math.min(999, Math.round(Number(event.target.value) || 1))))}
          />
        </label>
      </div>

      <div className={`qual-status is-${report.status}`} role="status">
        <strong>{statusText[report.status]}</strong>
        <span>
          {report.remaining} game{report.remaining === 1 ? "" : "s"} left · up to {report.maxPoints} points
        </span>
      </div>

      <ul className="mt-3 grid gap-1.5 text-sm">
        {report.ifWinAll !== "no-games" && (
          <li>
            Win every game left:{" "}
            <strong>
              {report.ifWinAll === "through"
                ? "they qualify"
                : report.ifWinAll === "nrr"
                  ? "level on points at the cut-off, so net run rate decides"
                  : "still need other results"}
            </strong>
          </li>
        )}
        {report.winsNeeded !== null && report.remaining > 0 && (
          <li>
            Fewest wins that can still be enough: <strong>{report.winsNeeded}</strong>
          </li>
        )}
        <li className="text-xs text-slate-400">
          {report.estimated ? "About " : ""}
          {Math.round((report.qualifies / report.scenarios) * 100)}% of the ways the remaining games could go put them through outright
          {report.onNrr ? `, and ${Math.round((report.onNrr / report.scenarios) * 100)}% leave it to net run rate` : ""}.
        </li>
      </ul>

      {rival && rivalNrr !== null && oversPerInnings && (
        <div className="mt-4 border-t border-white/10 pt-3 text-sm">
          <p className="text-xs text-slate-400">
            To pass {teamName(rival.teamId)}’s net run rate ({rivalNrr >= 0 ? "+" : ""}
            {rivalNrr.toFixed(3)}) next game:
          </p>
          <ul className="mt-2 grid gap-1.5">
            <li>
              Batting first ({score} in {oversPerInnings} overs):{" "}
              <strong>{margin !== null ? `win by ${margin}+ run${margin === 1 ? "" : "s"}` : "not possible in one game"}</strong>
            </li>
            <li>
              Chasing {score + 1}:{" "}
              <strong>{chaseBalls !== null ? `win within ${oversText(chaseBalls)} overs` : "not possible in one game"}</strong>
            </li>
          </ul>
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-500">
        Uses signed-off results only. Ties, washouts and bonus points in future games are not modelled.
      </p>
    </section>
  );
}
