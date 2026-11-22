import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The mobile rail keeps match-day destinations visible with one tap.
 * Less-frequent tasks remain discoverable in an accessible Radix menu.
 * Desktop retains the complete navigation without hiding actions.
 */
export function SectionNavigation<T extends string>({
  label,
  value,
  onChange,
  items,
  mobilePrimary,
  layout = "pills",
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: Array<readonly [T, LucideIcon, string]>;
  mobilePrimary?: readonly T[];
  /** "rail" renders a sticky vertical side menu on large screens. */
  layout?: "pills" | "rail";
}) {
  const primary = items.filter(([id]) =>
    mobilePrimary ? mobilePrimary.includes(id) : items.slice(0, 4).some(([key]) => key === id),
  );
  const secondary = items.filter(([id]) => !primary.some(([key]) => key === id));
  const currentLabel = items.find(([id]) => id === value)?.[2] ?? label;
  const moreSelected = secondary.some(([id]) => id === value);

  return (
    <div className="workspace-nav">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <p className="min-w-0 text-sm font-bold text-slate-100">{currentLabel}</p>
        <span className="shrink-0 text-xs text-slate-400">Menu at the bottom</span>
      </div>
      <nav
        aria-label={label}
        className={layout === "rail" ? "workspace-rail hidden lg:flex" : "hidden flex-wrap gap-2 lg:flex"}
      >
        {items.map(([key, Icon, text]) => (
          <button
            key={key}
            type="button"
            aria-current={value === key ? "page" : undefined}
            className="workspace-nav-item"
            onClick={() => onChange(key)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {text}
          </button>
        ))}
      </nav>
      <nav
        aria-label={`${label} quick navigation`}
        className="app-tabbar lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1">
          {primary.map(([key, Icon, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-current={value === key ? "page" : undefined}
              className={`app-tab ${value === key ? "app-tab-active" : ""}`}
            >
              <span className="app-tab-icon">
                <Icon className="size-5 shrink-0" aria-hidden="true" />
              </span>
              <span className="max-w-full truncate">
                {text === "Analysis room" ? "Analysis" : text}
              </span>
            </button>
          ))}
          {secondary.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-current={moreSelected ? "page" : undefined}
                  aria-label={
                    moreSelected
                      ? `More sections, viewing ${currentLabel}`
                      : "More workspace sections"
                  }
                  className={`app-tab ${moreSelected ? "app-tab-active" : ""}`}
                >
                  <span className="app-tab-icon">
                    <MoreHorizontal className="size-5" aria-hidden="true" />
                  </span>
                  <span>More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                sideOffset={12}
                className="w-64 max-w-[calc(100vw-2rem)] rounded-xl border-white/20 bg-[#211829] p-2 text-slate-100"
              >
                <DropdownMenuLabel>Other workspace sections</DropdownMenuLabel>
                {secondary.map(([key, Icon, text]) => (
                  <DropdownMenuItem
                    key={key}
                    onSelect={() => onChange(key)}
                    className={`min-h-12 gap-3 rounded-lg px-3 text-sm focus:bg-white/10 focus:text-white ${
                      value === key ? "bg-amber-300/15 text-amber-200" : "text-slate-100"
                    }`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    <span>{text}</span>
                    {value === key && <span className="ml-auto text-xs">Selected</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>
    </div>
  );
}
