import { useMemo, useState } from "react";
import { academyCohortsCsv, academyOverview } from "@/lib/academy-dashboard";
import { can, type PlatformRole } from "@/lib/platform";
import type { PlatformDashboardData } from "@/lib/platform-cloud";

const field = "rounded-lg border border-white/15 bg-card px-3 py-2 text-sm text-white";

export function AcademyDashboard({
  data,
  role,
  onOpenPlayers,
  onOpenCompetitions,
}: {
  data: PlatformDashboardData;
  role: PlatformRole;
  onOpenPlayers: () => void;
  onOpenCompetitions: () => void;
}) {
  const [ageFilter, setAgeFilter] = useState("all");
  const snapshot = useMemo(() => academyOverview(data), [data]);
  if (!can(role, "player.manage")) {
    return (
      <section className="workspace-empty" role="status">
        <h2>Academy management is restricted</h2>
        <p>Ask a club administrator for appropriate coaching or player management access.</p>
      </section>
    );
  }

  const options = [...new Set(snapshot.cohorts.map((team) => team.ageGroup))];
  const cohorts = snapshot.cohorts.filter(
    (team) => ageFilter === "all" || team.ageGroup === ageFilter,
  );
  const download = () => {
    const contents = academyCohortsCsv(cohorts);
    const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "criclume-academy-cohorts.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const cards = [
    { label: "Teams and cohorts", count: snapshot.teams },
    { label: "Registered players", count: snapshot.registeredPlayers },
    { label: "Active coaches", count: snapshot.activeCoaches },
    { label: "Players without a team", count: snapshot.unassignedPlayers },
  ];

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
          CricLume · Academy workspace
        </p>
        <h2 className="mt-2 text-3xl font-bold">Your academy at a glance</h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">
          Review your registered teams, age-group cohorts and upcoming fixtures from live club
          records. Training-session attendance and guardian accounts are not represented by match
          data and are not yet tracked here.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="action-primary" onClick={onOpenPlayers}>
            Manage players and teams
          </button>
          <button type="button" className={field} onClick={onOpenCompetitions}>
            View fixtures
          </button>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {card.label}
            </p>
            <p className="mt-2 font-display text-4xl font-bold tabular-nums">{card.count}</p>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <h3 className="text-lg font-bold">Safeguarding readiness</h3>
        <p className="mt-2 text-sm text-slate-300">
          <span>{snapshot.juniorPlayers} registered junior player(s)</span>
          <span>
            {" · "}
            {snapshot.coachingConsentsToReview} coaching consent record(s) require review.
          </span>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Review consent before processing any junior media.
        </p>
      </section>
      <section className="rounded-2xl border border-white/10 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Cohort overview</h3>
            <p className="mt-1 text-xs text-slate-400">
              Counts come from registered players and scheduled fixtures; no private player
              information is included in the export.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-slate-400">
              Age group
              <select
                className={field}
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
              >
                <option value="all">All groups</option>
                {options.map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={field} onClick={download} disabled={!cohorts.length}>
              Export cohort CSV
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto" role="region" aria-label="Academy cohorts">
          <table className="min-w-[680px] w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs text-slate-400">
              <tr>
                {[
                  "Team",
                  "Age group",
                  "Registered",
                  "Juniors",
                  "Consent review",
                  "Upcoming fixtures",
                ].map((label) => (
                  <th key={label} scope="col" className="px-3 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort) => (
                <tr key={cohort.teamId} className="border-b border-white/5">
                  <th scope="row" className="px-3 py-3 text-slate-100">
                    {cohort.name}
                  </th>
                  <td className="px-3 py-3">{cohort.ageGroup}</td>
                  <td className="px-3 py-3 tabular-nums">{cohort.registered}</td>
                  <td className="px-3 py-3 tabular-nums">{cohort.juniors}</td>
                  <td className="px-3 py-3 tabular-nums">{cohort.coachingConsentsToReview}</td>
                  <td className="px-3 py-3 tabular-nums">{cohort.upcomingFixtures}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cohorts.length && (
            <p className="p-4 text-sm text-slate-400">
              No teams match this age group. Register a team from Players to begin.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}
