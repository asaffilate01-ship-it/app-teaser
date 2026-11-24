import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type AppTab =
  | {
      id: string;
      label: string;
      icon: LucideIcon;
      to: "/app" | "/platform" | "/";
      active?: boolean;
    }
  | {
      id: string;
      label: string;
      icon: LucideIcon;
      onSelect: () => void;
      active?: boolean;
      emphasis?: boolean;
    };

/**
 * Native-style bottom menu for phones. Sits above the iPhone home indicator
 * and keeps every target at least 56px tall for one-handed use at the ground.
 */
export function AppTabBar({ tabs, label }: { tabs: AppTab[]; label: string }) {
  return (
    <nav aria-label={label} className="app-tabbar lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const className = `app-tab ${tab.active ? "app-tab-active" : ""} ${"emphasis" in tab && tab.emphasis ? "app-tab-emphasis" : ""}`;
          const content = (
            <>
              <span className="app-tab-icon">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="max-w-full truncate">{tab.label}</span>
            </>
          );
          return "to" in tab ? (
            <Link
              key={tab.id}
              to={tab.to}
              className={className}
              aria-current={tab.active ? "page" : undefined}
            >
              {content}
            </Link>
          ) : (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onSelect}
              className={className}
              aria-current={tab.active ? "page" : undefined}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
