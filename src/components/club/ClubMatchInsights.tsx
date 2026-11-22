import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Trophy, Target, Activity } from "lucide-react";
import { TeamCrest } from "@/components/scorer/Broadcast";
import type { MatchRecord, PlatformDashboardData } from "@/lib/platform-cloud";
import { loadMatchInsights, type InsightInnings } from "@/lib/match-insights-cloud";
import {
  overProgression,
  topBatters,
  topBowlers,
  wagonWheel,
  wheelZones,
  type OverPoint,
  type WagonWheel,
} from "@/lib/match-insights";
import { teamInitials } from "@/lib/match-broadcast";

const STARTED = new Set(["live", "innings_break", "completed"]);
const LIVE = new Set(["live", "innings_break"]);

function teamName(data: PlatformDashboardData, id: string) {
  return data.teams.find((team) => team.id === id)?.name ?? "Team";
}
function playerName(data: PlatformDashboardData, id: string) {
  return data.players.find((player) => player.id === id)?.name ?? "Player";
}
function shortDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "Date TBC";
}
function liveScore(match: MatchRecord) {
  const state = match.liveState;
  return {
    runs: Number(state["runs"] ?? 0),
    wickets: Number(state["wickets"] ?? 0),
    overs: String(state["overs"] ?? "0.0"),
    message: typeof state["message"] === "string" ? (state["message"] as string) : null,
  };
}
function oversPerInnings(match: MatchRecord): number | null {
  const settings = (match.liveState["settings"] ?? {}) as Record<string, unknown>;
  const value = Number(settings["oversPerInnings"]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Picks the match to feature: a live one first, otherwise the most recently updated started match. */
export function pickFeaturedMatch(matches: MatchRecord[]): MatchRecord | null {
  const started = matches
    .filter((match) => STARTED.has(match.status))
    .sort((a, b) => Number(LIVE.has(b.status)) - Number(LIVE.has(a.status)) || b.updatedAt.localeCompare(a.updatedAt));
  return started[0] ?? null;
}

export function ClubMatchInsights({ data }: { data: PlatformDashboardData }) {
  const started = useMemo(
    () => data.matches.filter((match) => STARTED.has(match.status)),
    [data.matches],
  );
  const [matchId, setMatchId] = useState<string | null>(() => pickFeaturedMatch(data.matches)?.id ?? null);
  const match = started.find((item) => item.id === matchId) ?? pickFeaturedMatch(data.matches);
  return (
    <div className="space-y-4">
      <MatchDayStrip data={data} />
      {match ? (
        <InsightsBoard
          key={match.id}
          data={data}
          match={match}
          choices={started}
          onChoose={setMatchId}
        />
      ) : (
        <section className="broadcast-panel insights-empty">
          <Activity className="size-6 text-gold" aria-hidden="true" />
          <div>
            <p className="panel-kicker">Match insights</p>
            <p className="insights-muted mt-1 text-sm">
              Run-rate charts, the wagon wheel and top performers appear here once your first match is scored.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function MatchDayStrip({ data }: { data: PlatformDashboardData }) {
  const live = data.matches.find((match) => LIVE.has(match.status));
  const next = data.matches
    .filter((match) => ["draft", "scheduled"].includes(match.status))
    .sort((a, b) => (a.scheduledAt ?? "9").localeCompare(b.scheduledAt ?? "9"))[0];
  const last = data.matches
    .filter((match) => match.status === "completed")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const cards = [
    { key: "live", label: "Live match", match: live, empty: "No match live right now" },
    { key: "next", label: "Up next", match: next, empty: "Nothing scheduled yet" },
    { key: "last", label: "Last result", match: last, empty: "No completed matches yet" },
  ] as const;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.key} className={`broadcast-panel matchday-card ${card.key === "live" && card.match ? "matchday-card-live" : ""}`}>
          <div className="flex items-center justify-between">
            <span className={`hero-chip ${card.key === "live" && card.match ? "hero-chip-live" : ""}`}>
              {card.key === "live" && card.match && <span className="live-dot" aria-hidden="true" />}
              {card.label}
            </span>
          </div>
          {card.match ? (
            <MatchDayBody data={data} match={card.match} mode={card.key} />
          ) : (
            <p className="insights-muted py-6 text-center text-sm">{card.empty}</p>
          )}
        </article>
      ))}
    </div>
  );
}

function MatchDayBody({ data, match, mode }: { data: PlatformDashboardData; match: MatchRecord; mode: "live" | "next" | "last" }) {
  const score = liveScore(match);
  const home = teamName(data, match.homeTeamId);
  const away = teamName(data, match.awayTeamId);
  const ground = match.groundId ? data.grounds.find((item) => item.id === match.groundId)?.name : null;
  return (
    <>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <TeamCrest name={home} size="sm" />
          <span className="w-full truncate text-xs font-bold uppercase tracking-wider">{home}</span>
        </div>
        {mode === "next" ? (
          <span className="hero-vs">vs</span>
        ) : (
          <div className="flex flex-col items-center">
            <span className="font-display text-2xl font-bold tabular-nums text-gold">
              {score.runs}/{score.wickets}
            </span>
            <span className="insights-muted text-[11px] uppercase tracking-wider">{score.overs} ov</span>
          </div>
        )}
        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <TeamCrest name={away} size="sm" />
          <span className="w-full truncate text-xs font-bold uppercase tracking-wider">{away}</span>
        </div>
      </div>
      <div className="matchday-foot">
        {mode !== "next" && score.message ? (
          <span className="truncate">{score.message}</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden="true" />{shortDate(match.scheduledAt ?? match.startedAt)}</span>
            <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{ground ?? "Ground TBC"}</span></span>
          </>
        )}
      </div>
    </>
  );
}

function InsightsBoard({
  data,
  match,
  choices,
  onChoose,
}: {
  data: PlatformDashboardData;
  match: MatchRecord;
  choices: MatchRecord[];
  onChoose: (id: string) => void;
}) {
  const isLive = LIVE.has(match.status);
  const query = useQuery({
    queryKey: ["match-insights", match.id],
    queryFn: () => loadMatchInsights(match.id),
    refetchInterval: isLive ? 15_000 : false,
  });
  const innings = query.data ?? [];
  const [inningsId, setInningsId] = useState<string | null>(null);
  const current: InsightInnings | undefined =
    innings.find((item) => item.id === inningsId) ??
    [...innings].reverse().find((item) => item.balls.length > 0) ??
    innings[0];
  return (
    <section className="space-y-4" aria-label="Match insights">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="panel-kicker">Match insights</p>
          <h2 className="mt-1 font-display text-xl font-bold">
            {teamName(data, match.homeTeamId)} v {teamName(data, match.awayTeamId)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {choices.length > 1 && (
            <select
              aria-label="Choose match"
              className="insights-select"
              value={match.id}
              onChange={(event) => onChoose(event.target.value)}
            >
              {choices.map((item) => (
                <option key={item.id} value={item.id}>
                  {teamName(data, item.homeTeamId)} v {teamName(data, item.awayTeamId)}
                </option>
              ))}
            </select>
          )}
          {innings.length > 1 && (
            <div className="insights-toggle" role="tablist" aria-label="Innings">
              {innings.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={current?.id === item.id}
                  className={current?.id === item.id ? "is-active" : ""}
                  onClick={() => setInningsId(item.id)}
                >
                  {teamInitials(teamName(data, item.battingTeamId))} innings
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {query.isError ? (
        <div className="broadcast-panel insights-empty" role="alert">
          <p className="text-sm">Match insights could not be loaded. They'll retry automatically.</p>
        </div>
      ) : query.isPending ? (
        <div className="grid gap-4 lg:grid-cols-5" aria-busy="true">
          <div className="broadcast-panel insights-skeleton lg:col-span-3" />
          <div className="broadcast-panel insights-skeleton lg:col-span-2" />
        </div>
      ) : !current || current.balls.length === 0 ? (
        <div className="broadcast-panel insights-empty">
          <Activity className="size-6 text-gold" aria-hidden="true" />
          <p className="insights-muted text-sm">No balls recorded in this innings yet. Charts fill in as the scorer records deliveries.</p>
        </div>
      ) : (
        <InningsInsights data={data} match={match} innings={current} />
      )}
    </section>
  );
}

function InningsInsights({ data, match, innings }: { data: PlatformDashboardData; match: MatchRecord; innings: InsightInnings }) {
  const points = overProgression(innings.balls);
  const wheel = wagonWheel(innings.balls);
  const batters = topBatters(innings.balls);
  const bowlers = topBowlers(innings.balls);
  const maxOvers = oversPerInnings(match);
  const last = points.at(-1);
  const legalBalls = innings.balls.filter((ball) => ball.legal).length;
  const ballsLeft = maxOvers ? Math.max(0, maxOvers * 6 - legalBalls) : null;
  const required =
    innings.target && ballsLeft && last ? Math.max(0, ((innings.target - last.totalRuns) * 6) / ballsLeft) : null;
  const projected = maxOvers && last ? Math.round(last.runRate * maxOvers) : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <article className="broadcast-panel lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="panel-kicker">Run rate over time</h3>
            <div className="insights-legend">
              <span><i className="legend-bar" />Runs per over</span>
              <span><i className="legend-line" />Run rate</span>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9.5rem]">
            <RunRateChart points={points} maxOvers={maxOvers} />
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-1">
              <RateStat label="Current run rate" value={(last?.runRate ?? 0).toFixed(2)} tone="crimson" />
              {required !== null ? (
                <RateStat label="Required rate" value={required.toFixed(2)} tone="gold" />
              ) : (
                <RateStat label="Projected score" value={projected !== null ? String(projected) : "—"} tone="gold" />
              )}
              <RateStat label="Score" value={`${last?.totalRuns ?? 0}`} />
              <RateStat
                label={ballsLeft !== null ? "Overs left" : "Overs bowled"}
                value={ballsLeft !== null ? `${Math.floor(ballsLeft / 6)}.${ballsLeft % 6}` : `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`}
              />
            </dl>
          </div>
        </article>
        <article className="broadcast-panel lg:col-span-2">
          <h3 className="panel-kicker">Wagon wheel</h3>
          <WagonWheelChart wheel={wheel} overs={last ? `${Math.floor(legalBalls / 6)}.${legalBalls % 6}` : "0.0"} />
          {wheel.unplacedRuns > 0 && (
            <p className="insights-muted mt-2 text-center text-[11px]">
              {wheel.unplacedRuns} run{wheel.unplacedRuns === 1 ? "" : "s"} without a recorded field zone
            </p>
          )}
        </article>
      </div>
      <article className="broadcast-panel">
        <h3 className="panel-kicker">Top performers</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="performer-head"><Trophy className="size-3.5" aria-hidden="true" />Batters · {teamName(data, innings.battingTeamId)}</p>
            <ul className="mt-2 divide-y divide-[var(--broadcast-border)]">
              {batters.map((line) => (
                <PerformerRow
                  key={line.playerId}
                  name={playerName(data, line.playerId)}
                  detail={`${line.fours}×4 · ${line.sixes}×6`}
                  figure={`${line.runs}${line.out ? "" : "*"} (${line.balls})`}
                />
              ))}
            </ul>
          </div>
          <div>
            <p className="performer-head"><Target className="size-3.5" aria-hidden="true" />Bowlers · {teamName(data, innings.bowlingTeamId)}</p>
            <ul className="mt-2 divide-y divide-[var(--broadcast-border)]">
              {bowlers.map((line) => (
                <PerformerRow
                  key={line.playerId}
                  name={playerName(data, line.playerId)}
                  detail={`${line.overs} overs`}
                  figure={`${line.wickets}/${line.runs}`}
                />
              ))}
            </ul>
          </div>
        </div>
      </article>
    </div>
  );
}

function RateStat({ label, value, tone }: { label: string; value: string; tone?: "crimson" | "gold" }) {
  return (
    <div className="rate-stat">
      <dt>{label}</dt>
      <dd className={tone === "crimson" ? "rate-stat-crimson" : tone === "gold" ? "text-gold" : ""}>{value}</dd>
    </div>
  );
}

function PerformerRow({ name, detail, figure }: { name: string; detail: string; figure: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="performer-avatar" aria-hidden="true">{teamInitials(name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="insights-muted block text-[11px]">{detail}</span>
      </span>
      <span className="font-display text-base font-bold tabular-nums">{figure}</span>
    </li>
  );
}

function RunRateChart({ points, maxOvers }: { points: OverPoint[]; maxOvers: number | null }) {
  const width = 520;
  const height = 240;
  const pad = { left: 30, right: 10, top: 12, bottom: 26 };
  // Without a known match length, leave room for a few more overs so bars keep a sensible width.
  const overs = Math.max(maxOvers ?? (points.at(-1)?.over ?? 0) + 3, points.at(-1)?.over ?? 1, 5);
  const top = Math.max(6, ...points.map((point) => point.runs), ...points.map((point) => point.runRate));
  const yMax = Math.ceil(top / 2) * 2;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (over: number) => pad.left + ((over - 0.5) / overs) * plotW;
  const y = (value: number) => pad.top + plotH - (value / yMax) * plotH;
  const barW = Math.min(26, Math.max(3, (plotW / overs) * 0.55));
  const ticks = Array.from({ length: yMax / 2 + 1 }, (_, index) => index * 2).filter((_, index, all) => all.length <= 8 || index % 2 === 0);
  const xStep = overs > 50 ? 10 : overs > 20 ? 5 : overs > 10 ? 2 : 1;
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.over).toFixed(1)},${y(point.runRate).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="insights-chart" role="img" aria-label={`Run rate chart over ${points.length} overs`}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
          <text x={pad.left - 6} y={y(tick) + 3} textAnchor="end" className="chart-label">{tick}</text>
        </g>
      ))}
      {Array.from({ length: Math.floor(overs / xStep) + 1 }, (_, index) => index * xStep)
        .filter((over) => over > 0)
        .map((over) => (
          <text key={over} x={x(over)} y={height - 8} textAnchor="middle" className="chart-label">{over}</text>
        ))}
      {points.map((point) => (
        <rect
          key={point.over}
          x={x(point.over) - barW / 2}
          y={y(point.runs)}
          width={barW}
          height={Math.max(0, pad.top + plotH - y(point.runs))}
          rx={2}
          className={point.wickets > 0 ? "chart-bar chart-bar-wicket" : "chart-bar"}
        >
          <title>{`Over ${point.over}: ${point.runs} runs${point.wickets ? `, ${point.wickets} wicket${point.wickets > 1 ? "s" : ""}` : ""}`}</title>
        </rect>
      ))}
      <path d={line} className="chart-line" />
      {points.map((point) => (
        <circle key={point.over} cx={x(point.over)} cy={y(point.runRate)} r={3} className="chart-dot" />
      ))}
    </svg>
  );
}

function wedgePath(cx: number, cy: number, r0: number, r1: number, start: number, end: number) {
  const point = (r: number, angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)},${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M${point(r0, start)} L${point(r1, start)} A${r1},${r1} 0 0 1 ${point(r1, end)} L${point(r0, end)} A${r0},${r0} 0 0 0 ${point(r0, start)} Z`;
}

function WagonWheelChart({ wheel, overs }: { wheel: WagonWheel; overs: string }) {
  const size = 300;
  const c = size / 2;
  const inner = 42;
  const outer = 108;
  const step = 360 / wheelZones.length;
  const maxShare = Math.max(1, ...wheel.zones.map((zone) => zone.share));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="wagon-wheel" role="img" aria-label={`Wagon wheel: ${wheel.placedRuns} runs placed`}>
      {wheel.zones.map((zone, index) => {
        const start = index * step;
        const end = start + step;
        const mid = ((start + step / 2 - 90) * Math.PI) / 180;
        const labelR = (inner + outer) / 2 + 4;
        const nameR = outer + 18;
        const intensity = zone.runs > 0 ? 0.18 + (zone.share / maxShare) * 0.62 : 0.05;
        return (
          <g key={zone.zone}>
            <path
              d={wedgePath(c, c, inner, outer, start, end)}
              className="wheel-wedge"
              style={{ fillOpacity: intensity }}
            >
              <title>{`${zone.zone}: ${zone.runs} runs (${zone.share}%)`}</title>
            </path>
            <text x={c + labelR * Math.cos(mid)} y={c + labelR * Math.sin(mid) - 2} textAnchor="middle" className="wheel-runs">{zone.runs}</text>
            <text x={c + labelR * Math.cos(mid)} y={c + labelR * Math.sin(mid) + 11} textAnchor="middle" className="wheel-share">{zone.share}%</text>
            <text x={c + nameR * Math.cos(mid)} y={c + nameR * Math.sin(mid) + 3} textAnchor="middle" className="wheel-name">{zone.zone}</text>
          </g>
        );
      })}
      <circle cx={c} cy={c} r={inner - 4} className="wheel-hub" />
      <text x={c} y={c - 10} textAnchor="middle" className="wheel-hub-kicker">Total</text>
      <text x={c} y={c + 10} textAnchor="middle" className="wheel-hub-runs">{wheel.placedRuns}</text>
      <text x={c} y={c + 24} textAnchor="middle" className="wheel-hub-kicker">{overs} ov</text>
    </svg>
  );
}
