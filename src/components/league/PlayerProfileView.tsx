import { ArrowLeft, Award, Crown, Flame, Hand, Medal, Sparkles, Star, Target, Trophy, Zap } from "lucide-react";
import type { CricketMatch } from "@/lib/cricket";
import { teamInitials } from "@/lib/match-broadcast";
import { playerProfile, type BadgeKind } from "@/lib/player-profile";
import { figures } from "@/lib/season-stats";
import { PlayerExtras, ShareAwardButton } from "@/components/league/PlayerExtras";

const badgeIcon: Record<BadgeKind, typeof Award> = {
  fifty: Star,
  hundred: Crown,
  "five-for": Target,
  "hat-trick": Zap,
  "six-hitter": Flame,
  "safe-hands": Hand,
  "player-of-match": Trophy,
  "runs-500": Medal,
  "runs-1000": Medal,
  "wickets-25": Sparkles,
  "wickets-50": Sparkles,
};

const shortDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString([], { day: "numeric", month: "short" });
};

/** Career page: totals, recent form chart and milestone badges. */
export function PlayerProfileView({
  matches,
  playerId,
  onBack,
}: {
  matches: readonly CricketMatch[];
  playerId: string;
  onBack: () => void;
}) {
  const profile = playerProfile(matches, playerId);
  if (!profile) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onBack} className="workspace-nav-item inline-flex min-h-10 items-center gap-2">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to stats
        </button>
        <p className="text-sm text-slate-400">No scorecards found for this player.</p>
      </div>
    );
  }
  const { batting, bowling, fielding } = profile;
  const tiles: [string, string][] = [
    ["Runs", String(batting?.runs ?? 0)],
    ["Batting avg", batting?.average != null ? batting.average.toFixed(2) : "–"],
    ["Strike rate", batting?.balls ? batting.strikeRate.toFixed(1) : "–"],
    ["High score", batting ? `${batting.highScore}${batting.highScoreNotOut ? "*" : ""}` : "–"],
    ["Wickets", String(bowling?.wickets ?? 0)],
    ["Best", bowling ? figures(bowling.best) : "–"],
    ["Economy", bowling?.economy != null ? bowling.economy.toFixed(2) : "–"],
    ["Catches", String(fielding?.catches ?? 0)],
  ];
  const form = [...profile.form].slice(0, 10).reverse();
  const maxRuns = Math.max(10, ...form.map((line) => line.runs ?? 0));
  return (
    <section className="space-y-4" aria-label={`${profile.name} profile`}>
      <button type="button" onClick={onBack} className="workspace-nav-item inline-flex min-h-10 items-center gap-2">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to stats
      </button>
      <header className="broadcast-panel profile-head">
        <span className="profile-avatar" aria-hidden="true">
          {teamInitials(profile.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="panel-kicker">{profile.team}</p>
          <h2 className="truncate font-display text-3xl font-bold">{profile.name}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {profile.matches} match{profile.matches === 1 ? "" : "es"}
            {batting ? ` · ${batting.fifties} fifties · ${batting.hundreds} hundreds` : ""}
            {bowling?.fiveWickets ? ` · ${bowling.fiveWickets} five-fors` : ""}
          </p>
        </div>
        {profile.playerOfMatchAwards > 0 && (
          <div className="profile-potm" aria-label={`${profile.playerOfMatchAwards} Player of the Match awards`}>
            <Trophy className="size-5" aria-hidden="true" />
            <strong>{profile.playerOfMatchAwards}</strong>
            <span>Player of the Match</span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="broadcast-panel p-3">
            <p className="panel-kicker">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-gold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <article className="broadcast-panel">
          <h3 className="panel-kicker">Recent form</h3>
          {form.length ? (
            <div className="profile-form mt-3" role="list" aria-label="Runs and wickets in recent matches">
              {form.map((line) => (
                <div key={line.matchId} role="listitem" className="profile-form-col" title={`${line.opponent}: ${line.runs ?? "DNB"}${line.runs != null && !line.out ? "*" : ""}${line.wickets != null ? `, ${line.wickets}/${line.runsConceded}` : ""}`}>
                  <span className="profile-form-value">
                    {line.runs == null ? "–" : `${line.runs}${line.out ? "" : "*"}`}
                  </span>
                  <span className="profile-form-track">
                    <span className="profile-form-bar" style={{ height: `${((line.runs ?? 0) / maxRuns) * 100}%` }} />
                  </span>
                  <span className="profile-form-wkts">{line.wickets ? `${line.wickets}w` : ""}</span>
                  <span className="profile-form-label">{shortDate(line.date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No innings yet.</p>
          )}
          <p className="insights-muted mt-2 text-[11px]">Bars show runs; * not out; w = wickets. Oldest on the left.</p>
        </article>
        <article className="broadcast-panel">
          <h3 className="panel-kicker">Badges and milestones</h3>
          {profile.badges.length ? (
            <ul className="mt-3 grid gap-2">
              {profile.badges.slice(0, 12).map((badge, index) => {
                const Icon = badgeIcon[badge.kind];
                return (
                  <li key={`${badge.kind}-${badge.matchId}-${index}`} className="profile-badge">
                    <span className="profile-badge-icon" aria-hidden="true">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm">{badge.label}</strong>
                      <small className="block truncate text-xs text-slate-400">{badge.detail}</small>
                    </span>
                    {badge.date && <span className="text-[11px] text-slate-500">{shortDate(badge.date)}</span>}
                    <ShareAwardButton title={badge.label} detail={badge.detail} playerName={profile.name} team={profile.team} date={badge.date ? shortDate(badge.date) : undefined} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Fifties, five-fors, hat-tricks and awards appear here.</p>
          )}
        </article>
      </div>
      <PlayerExtras playerId={playerId} playerName={profile.name} />
    </section>
  );
}
