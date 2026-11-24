import { useMemo, useState, type ReactNode } from "react";
import { Search, CalendarDays, Radio } from "lucide-react";
import type { MatchRecord, PlatformDashboardData } from "@/lib/platform-cloud";
import {
  matchDeskCounts,
  matchDeskFilters,
  selectDeskMatches,
  type MatchDeskFilter,
} from "@/lib/match-desk";

const labels: Record<MatchDeskFilter, string> = {
  all: "All matches",
  live: "In progress",
  scheduled: "Scheduled",
  draft: "Drafts",
  archive: "Archive",
};
const pageSize = 12;

export function MatchDayDesk({
  data,
  renderMatch,
}: {
  data: PlatformDashboardData;
  renderMatch: (match: MatchRecord) => ReactNode;
}) {
  const [filter, setFilter] = useState<MatchDeskFilter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(pageSize);
  const counts = useMemo(() => matchDeskCounts(data.matches), [data.matches]);
  const matches = useMemo(
    () => selectDeskMatches(data.matches, data.teams, data.grounds, filter, query),
    [data.matches, data.teams, data.grounds, filter, query],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block min-w-0">
          <span className="sr-only">Search matches by team or ground</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(pageSize);
            }}
            placeholder="Search teams or grounds"
            className="scorer-input w-full pl-10"
          />
        </label>
        <label className="block min-w-0">
          <span className="sr-only">Filter matches by status</span>
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as MatchDeskFilter);
              setLimit(pageSize);
            }}
            className="scorer-input w-full"
          >
            {matchDeskFilters.map((item) => (
              <option key={item} value={item}>
                {labels[item]} ({counts[item]})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span role="status" aria-live="polite">
          Showing {Math.min(limit, matches.length)} of {matches.length} matches
        </span>
        {counts.live > 0 && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-gold">
            <Radio className="size-4" aria-hidden="true" />
            {counts.live} in progress
          </span>
        )}
      </div>
      {matches.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {matches.slice(0, limit).map((match) => renderMatch(match))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 p-6 text-center">
          <CalendarDays className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">No matching fixtures</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search or clear the status filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
              setLimit(pageSize);
            }}
            className="action-secondary mt-4"
          >
            Clear filters
          </button>
        </div>
      )}
      {matches.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((current) => current + pageSize)}
          className="action-secondary w-full justify-center"
        >
          Show {Math.min(pageSize, matches.length - limit)} more matches
        </button>
      )}
    </div>
  );
}
