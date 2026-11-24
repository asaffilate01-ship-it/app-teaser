import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  THEME_EVENT,
  THEME_KEY,
  effectiveTheme,
  readSavedTheme,
  setTheme,
  type ThemeMode,
} from "@/lib/theme";

/** Sun / moon switch. `pageDefault` is the look this page has when the visitor hasn't chosen. */
export function ThemeToggle({
  pageDefault = "dark",
  className = "",
  labels = { toLight: "Switch to light mode", toDark: "Switch to dark mode" },
}: {
  pageDefault?: ThemeMode;
  className?: string;
  labels?: { toLight: string; toDark: string };
}) {
  const [mode, setMode] = useState<ThemeMode>(pageDefault);
  useEffect(() => {
    const sync = () => setMode(effectiveTheme(readSavedTheme(), pageDefault));
    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      const saved = readSavedTheme();
      if (saved) setTheme(saved);
      sync();
    };
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [pageDefault]);
  const next: ThemeMode = mode === "dark" ? "light" : "dark";
  const label = next === "light" ? labels.toLight : labels.toDark;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      data-mode={mode}
      className={`theme-toggle ${className}`}
    >
      <Sun className="theme-sun" aria-hidden="true" />
      <Moon className="theme-moon" aria-hidden="true" />
    </button>
  );
}
