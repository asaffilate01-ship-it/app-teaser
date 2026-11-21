import {
  Activity,
  BarChart3,
  Camera,
  ChevronRight,
  Clock3,
  Gauge,
  Play,
  Radio,
  Shield,
  Trophy,
  Users,
  Video,
} from "lucide-react";

/**
 * A CricLume-branded illustrative layout for the marketing gallery.
 * No external product logos, copied broadcast images or fictional statistics.
 * Actual scorecards and coaching evidence are displayed only inside the app.
 */
export function MarketingScreenPreview({
  kind,
}: {
  kind: "dashboard" | "scoreboard" | "scorer" | "review";
}) {
  const frame = "relative h-full min-h-[265px] overflow-hidden rounded-xl border border-white/10 bg-[#11121a] text-slate-100 sm:min-h-[320px]";
  const surface = "rounded-lg border border-white/10 bg-[#201a23] p-3";
  if (kind === "dashboard") {
    return (
      <div role="img" aria-label="CricLume club command-centre layout illustration" className={frame}>
        <div className="grid h-full min-h-[265px] grid-cols-[92px_1fr] sm:grid-cols-[132px_1fr]">
          <aside className="border-r border-white/10 bg-[#17141c] px-2 py-4 sm:px-3">
            <p className="truncate font-display text-sm font-bold tracking-wide text-amber-200 sm:text-lg">
              CRICLUME
            </p>
            <div className="mt-6 space-y-2">
              {[
                [Gauge, "Overview"],
                [Radio, "Matches"],
                [Users, "Players"],
                [BarChart3, "Analysis"],
              ].map(([Icon, name], index) => {
                const Symbol = Icon as typeof Gauge;
                return (
                  <div
                    key={String(name)}
                    className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[9px] font-bold sm:text-xs ${
                      index === 0 ? "bg-rose-900/60 text-amber-200" : "text-slate-400"
                    }`}
                  >
                    <Symbol className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{String(name)}</span>
                  </div>
                );
              })}
            </div>
          </aside>
          <div className="min-w-0 p-3 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg font-bold sm:text-2xl">Club dashboard</p>
                <p className="text-[9px] text-slate-400 sm:text-xs">Matches · Teams · Performance</p>
              </div>
              <span className="rounded-lg border border-amber-300/50 px-2 py-1 text-[9px] font-bold text-amber-200">
                Match day
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["Live matches", "Upcoming", "Players"].map((item) => (
                <div key={item} className={surface}>
                  <p className="truncate text-[9px] text-slate-400 sm:text-xs">{item}</p>
                  <p className="mt-2 text-lg font-bold text-amber-200">—</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className={surface}>
                <p className="mb-3 text-[10px] font-bold text-amber-200">Run rate</p>
                <div className="flex h-14 items-end gap-1 border-b border-white/15 pb-1 sm:h-20">
                  {[25, 35, 43, 52, 60, 67, 75, 80, 88].map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-gradient-to-t from-[#5a182b] to-amber-400/70"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className={surface}>
                <p className="mb-3 text-[10px] font-bold text-amber-200">Wagon wheel</p>
                <div className="mx-auto grid size-16 place-items-center rounded-full border-2 border-amber-300/60 bg-[#1f4b43] sm:size-20">
                  <div className="size-7 rounded-full border border-amber-300/80 sm:size-9" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (kind === "scoreboard") {
    return (
      <div role="img" aria-label="CricLume live-scoreboard layout illustration" className={frame}>
        <div className="border-b border-white/10 bg-[#28101b] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-200">
          CricLume · Match scoreboard
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4 text-center sm:p-6">
          <div className="min-w-0 text-left">
            <Shield className="mb-2 size-8 text-amber-200 sm:size-12" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-wide sm:text-sm">Home team</p>
          </div>
          <div className="min-w-0 text-center">
            <p className="font-display text-4xl font-bold tabular-nums text-amber-200 sm:text-6xl">
              — / —
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">Overs —</p>
          </div>
          <div className="min-w-0 text-right">
            <Trophy className="mb-2 ml-auto size-8 text-amber-200 sm:size-12" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-wide sm:text-sm">Away team</p>
          </div>
        </div>
        <div className="mx-3 grid grid-cols-2 gap-2 sm:mx-6">
          <div className={surface}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200">Batters</p>
            <p className="mt-3 text-xs text-slate-300">Striker —</p>
            <p className="mt-2 text-xs text-slate-300">Non-striker —</p>
          </div>
          <div className={surface}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200">Bowler</p>
            <p className="mt-3 text-xs text-slate-300">Overs —</p>
            <p className="mt-2 text-xs text-slate-300">Runs — · Wickets —</p>
          </div>
        </div>
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2 sm:mx-6">
          <p className="mr-2 text-[10px] font-bold uppercase text-amber-200">Last over</p>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="grid size-6 place-items-center rounded-full border border-white/20 text-[10px] text-slate-400">
              —
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "scorer") {
    return (
      <div role="img" aria-label="CricLume one-thumb mobile scoring layout illustration" className={frame}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#271020] via-[#19111b] to-[#130f17]" />
        <div className="relative mx-auto h-full max-w-[290px] border-x border-amber-300/20 px-4 py-3 sm:py-5">
          <div className="flex items-center justify-between text-amber-200">
            <span className="font-display text-base font-bold">CRICLUME</span>
            <Gauge className="size-4" aria-hidden="true" />
          </div>
          <div className="mt-3 rounded-xl border border-amber-300/20 bg-white/[0.04] p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-300">Current innings</p>
            <p className="font-display text-4xl font-bold text-amber-200">— / —</p>
            <p className="text-xs text-slate-400">Overs — · RR —</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div className={surface}><p>Batter</p><p className="mt-1 font-bold text-amber-200">—</p></div>
            <div className={surface}><p>Bowler</p><p className="mt-1 font-bold text-amber-200">—</p></div>
          </div>
          <p className="my-3 text-center text-[10px] font-bold uppercase tracking-widest text-amber-200">
            Record a delivery
          </p>
          <div className="grid grid-cols-6 gap-1">
            {["0", "1", "2", "3", "4", "6"].map((value) => (
              <span key={value} className="grid aspect-square place-items-center rounded-full border border-amber-300/60 text-sm font-bold text-amber-200">
                {value}
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[8px] text-slate-200">
            {["Wide", "No ball", "Bye", "Leg bye"].map((text) => (
              <span key={text} className="rounded-md border border-white/15 bg-white/[0.06] px-1 py-2">{text}</span>
            ))}
          </div>
          <div className="mt-2 rounded-lg border border-rose-400/50 bg-rose-900/55 py-2 text-center text-xs font-extrabold uppercase tracking-wide">
            Wicket
          </div>
        </div>
      </div>
    );
  }
  return (
    <div role="img" aria-label="CricLume multi-angle coaching analysis layout illustration" className={frame}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <p className="font-display text-sm font-bold tracking-wide text-amber-200">CRICLUME · ANALYSIS</p>
        <span className="flex items-center gap-1 text-[10px] text-slate-400"><Video className="size-3" /> Video lab</span>
      </div>
      <div className="grid h-[calc(100%-35px)] grid-cols-[85px_1fr] gap-2 p-2 sm:grid-cols-[118px_1fr] sm:gap-3 sm:p-3">
        <div className="space-y-2 border-r border-white/10 pr-2">
          <p className="text-[10px] font-bold uppercase text-amber-200">Clips & notes</p>
          {["Delivery", "Observation", "Highlights"].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2 py-3 text-[9px] sm:text-[11px]">
              <Video className="size-3 shrink-0 text-amber-200" /> {item}
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-2">
            {["End on", "Side on", "Bowler end", "Wide"].map((angle) => (
              <div key={angle} className="relative grid h-[75px] place-items-center rounded-lg border border-amber-300/20 bg-gradient-to-br from-[#244338] via-[#194039] to-[#1c2330] sm:h-[96px]">
                <Camera className="size-5 text-white/70" aria-hidden="true" />
                <span className="absolute left-2 top-1 text-[9px] font-bold text-amber-100">{angle}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
            <Play className="size-4 text-amber-200" aria-hidden="true" />
            <div className="h-1.5 flex-1 rounded-full bg-white/10">
              <div className="h-full w-1/3 rounded-full bg-amber-300/70" />
            </div>
            <Clock3 className="size-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 text-[10px] font-semibold text-amber-200">
            <Activity className="size-3" aria-hidden="true" />
            Review evidence
            <ChevronRight className="size-3" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
