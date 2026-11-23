import { BarChart3, Download, Gauge, History, Trophy, Video } from "lucide-react";
import { scorerDestinations, type ScorerDestination } from "@/lib/scorer-navigation";

const icons = {
  score: Gauge,
  timeline: History,
  scorecard: Trophy,
  analysis: BarChart3,
  video: Video,
} as const;

export function ScorerMatchNavigation({
  active,
  onChange,
  onExport,
}: {
  active: ScorerDestination;
  onChange: (tab: ScorerDestination) => void;
  onExport: () => void;
}) {
  return (
    <>
      <nav
        aria-label="Match sections"
        className="no-scrollbar sticky top-[65px] z-30 mx-0 hidden gap-1 overflow-x-auto border-b border-white/10 bg-background/95 px-3 py-2 backdrop-blur-xl md:top-[77px] md:mt-4 md:flex md:rounded-2xl md:border md:px-2"
      >
        {scorerDestinations.map(({ id, label }) => {
          const Icon = icons[id];
          return (
            <button
              key={id}
              type="button"
              aria-current={active === id ? "page" : undefined}
              onClick={() => onChange(id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${
                active === id ? "bg-amber-300 text-gold-foreground" : "text-slate-400"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onExport}
          className="ml-auto flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
        >
          <Download className="size-4" aria-hidden="true" />
          Export match
        </button>
      </nav>

      <nav
        aria-label="Scorer bottom navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-200/15 bg-card/95 px-2 pt-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid w-full max-w-lg grid-cols-5 gap-1">
          {scorerDestinations.map(({ id, label, mobileLabel }) => {
            const Icon = icons[id];
            const selected = active === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={selected ? "page" : undefined}
                aria-label={`${label} section`}
                onClick={() => onChange(id)}
                className={`flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${
                  selected ? "bg-amber-300/15 text-amber-200" : "text-slate-300 active:bg-white/10"
                }`}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="max-w-full truncate">{mobileLabel}</span>
                <span
                  className={`h-0.5 w-5 rounded-full ${
                    selected ? "bg-amber-300" : "bg-transparent"
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
