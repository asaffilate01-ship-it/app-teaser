import { useState } from "react";
import { Copy, Megaphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CompetitionRecord, PlatformDashboardData } from "@/lib/platform-cloud";
import { fixturePost, fixtureWhen } from "@/lib/social-posts";
import { fixturePoster, sharePoster } from "@/lib/posters";
import logoAsset from "@/assets/criclume-logo-on-dark.png.asset.json";

const upcoming = new Set(["draft", "scheduled", "postponed", "live"]);

/** Match-day posters and ready-to-paste posts for a competition's next fixtures. */
export function MatchDayPosts({
  data,
  competition,
}: {
  data: PlatformDashboardData;
  competition: CompetitionRecord;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const name = (id: string) => data.teams.find((team) => team.id === id)?.name ?? "Team";
  const ground = (id: string | null) =>
    id ? (data.grounds.find((item) => item.id === id)?.name ?? null) : null;
  const now = Date.now();
  const fixtures = data.fixtures
    .filter((fixture) => fixture.competitionId === competition.id && upcoming.has(fixture.status))
    .filter((fixture) => !fixture.startsAt || Date.parse(fixture.startsAt) > now - 12 * 3600_000)
    .sort((a, b) => (a.startsAt ?? "9999").localeCompare(b.startsAt ?? "9999"))
    .slice(0, 8);
  // A published live scoreboard for the same two teams in this competition gives the "follow live" link.
  const liveLink = (home: string, away: string) => {
    const match = data.matches.find(
      (item) =>
        item.competitionId === competition.id &&
        item.homeTeamId === home &&
        item.awayTeamId === away &&
        item.scoreboard?.enabled &&
        item.status !== "completed",
    );
    return match?.scoreboard
      ? `${window.location.origin}/scoreboard/${match.scoreboard.slug}`
      : null;
  };
  const input = (fixture: (typeof fixtures)[number]) => ({
    home: name(fixture.homeTeamId),
    away: name(fixture.awayTeamId),
    startsAt: fixture.startsAt,
    ground: ground(fixture.groundId),
    competition: competition.name,
    round: fixture.roundName,
    link: liveLink(fixture.homeTeamId, fixture.awayTeamId) ?? undefined,
  });
  const copy = async (fixture: (typeof fixtures)[number]) => {
    try {
      await navigator.clipboard.writeText(fixturePost(input(fixture)));
      toast.success("Match-day post copied");
    } catch {
      toast.error("Could not copy the post.");
    }
  };
  const poster = async (fixture: (typeof fixtures)[number]) => {
    setBusy(fixture.id);
    try {
      const details = input(fixture);
      const blob = await fixturePoster({
        ...details,
        when: fixtureWhen(details),
        link: details.link ?? null,
        competition: [competition.name, fixture.roundName].filter(Boolean).join(" · "),
        logoUrl: logoAsset.url,
      });
      const how = await sharePoster(
        blob,
        `match-day-${fixture.id.slice(0, 8)}.png`,
        `${details.home} v ${details.away}`,
      );
      if (how === "downloaded") toast.success("Match-day poster downloaded");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast.error("The poster could not be created.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        className="workspace-nav-item"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Megaphone className="size-4" aria-hidden="true" /> Match-day posts
      </button>
      {open && (
        <ul
          className="mt-3 grid gap-2"
          aria-label={`${competition.name} upcoming fixtures to share`}
        >
          {fixtures.length === 0 && (
            <li className="text-xs text-slate-400">No upcoming fixtures yet.</li>
          )}
          {fixtures.map((fixture) => (
            <li
              key={fixture.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <span className="min-w-0 text-sm">
                <strong className="block truncate">
                  {name(fixture.homeTeamId)} v {name(fixture.awayTeamId)}
                </strong>
                <span className="text-xs text-slate-400">
                  {fixtureWhen({ startsAt: fixture.startsAt }) ?? "Date to be set"}
                </span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="app-chip-button"
                  disabled={busy === fixture.id}
                  onClick={() => void poster(fixture)}
                >
                  <Sparkles className="size-4" /> Poster
                </button>
                <button
                  type="button"
                  className="app-chip-button"
                  onClick={() => void copy(fixture)}
                >
                  <Copy className="size-4" /> Post
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
