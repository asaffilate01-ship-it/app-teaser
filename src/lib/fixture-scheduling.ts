import type { FixtureRecord } from "./platform-cloud";

type ScheduledFixture = Pick<
  FixtureRecord,
  "id" | "startsAt" | "homeTeamId" | "awayTeamId" | "groundId" | "status"
>;

export type FixtureSchedulingAlert = {
  firstFixtureId: string;
  secondFixtureId: string;
  minutesApart: number;
  sharedTeamIds: string[];
  sharedGroundId: string | null;
};

const excludedStatuses = new Set(["cancelled", "canceled", "abandoned", "completed"]);

function absoluteStart(value: string | null): number | null {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(
      value)
  ) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Read-only advisory based on actual future fixture dates and identities.
 *
 * Cricket fixture rows do not define reliable match durations. A close start
 * time is therefore a *possible* scheduling issue, never a proven overlap.
 * Do not auto-cancel, move, block or publish a match based on these alerts.
 */
export function reviewFixtureSchedule(
  fixtures: readonly ScheduledFixture[],
  asOf: Date = new Date(),
  windowMinutes = 240,
) {
  const windowMs = Math.max(1, Math.min(720, Math.floor(windowMinutes))) * 60_000;
  const now = asOf.valueOf();
  const entries = fixtures
    .filter((fixture) => !excludedStatuses.has(fixture.status.toLowerCase()))
    .map((fixture) => ({ fixture, starts: absoluteStart(fixture.startsAt) }))
    .filter(
      (item): item is { fixture: ScheduledFixture; starts: number } =>
        item.starts !== null && item.starts >= now,
    )
    .sort((a, b) => a.starts - b.starts || a.fixture.id.localeCompare(b.fixture.id));
  const alerts: FixtureSchedulingAlert[] = [];
  const seen = new Set<string>();
  for (let first = 0; first < entries.length; first += 1) {
    const a = entries[first]!;
    for (let second = first + 1; second < entries.length; second += 1) {
      const b = entries[second]!;
      const difference = b.starts - a.starts;
      if (difference >= windowMs) break;
      if (a.fixture.id === b.fixture.id) continue;
      const teamIds = new Set([a.fixture.homeTeamId, a.fixture.awayTeamId]);
      const sharedTeamIds = [b.fixture.homeTeamId, b.fixture.awayTeamId].filter((id) =>
        teamIds.has(id),
      );
      const sharedGroundId =
        a.fixture.groundId && a.fixture.groundId === b.fixture.groundId ? a.fixture.groundId : null;
      if (!sharedTeamIds.length && !sharedGroundId) continue;
      const key = [a.fixture.id, b.fixture.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      alerts.push({
        firstFixtureId: a.fixture.id,
        secondFixtureId: b.fixture.id,
        minutesApart: Math.round(difference / 60_000),
        sharedTeamIds: [...new Set(sharedTeamIds)],
        sharedGroundId,
      });
      if (alerts.length >= 30) {
        return { alerts, truncated: true, checkedFixtures: entries.length };
      }
    }
  }
  return { alerts, truncated: false, checkedFixtures: entries.length };
}
