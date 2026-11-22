import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logoOnDark from "@/assets/criclume-logo-on-dark.png.asset.json";

/**
 * One header for every signed-in or match-day screen. The logo variant is
 * tuned for dark surfaces so the full wordmark stays readable outdoors.
 */
export function AppHeader({
  area,
  onBack,
  backLabel = "Back",
  right,
}: {
  area?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}) {
  return (
    <header className="app-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {onBack && (
            <button type="button" onClick={onBack} aria-label={backLabel} className="app-icon-button">
              <ArrowLeft className="size-4" aria-hidden="true" />
            </button>
          )}
          <Link to="/" aria-label="CricLume home" className="shrink-0">
            <img
              src={logoOnDark.url}
              alt="CricLume"
              width={840}
              height={276}
              className="h-9 w-auto md:h-10"
            />
          </Link>
          {area && <span className="app-area-pill hidden sm:inline-flex">{area}</span>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}
