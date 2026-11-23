/**
 * Light / dark switch. The choice is saved on the device and applied to <html data-theme>
 * by a tiny script in the page head before anything paints (no flash).
 * With no saved choice, the app is dark and club websites are light.
 * Big screens, stream overlays and camera screens always stay dark.
 */
export type ThemeMode = "light" | "dark";
export const THEME_KEY = "criclume-theme";
export const THEME_EVENT = "criclume-theme-change";

/** Pages that always stay dark, whatever the visitor picked. */
export const lockedDarkPath = /^\/(ground|overlay|camera|director)(\/|$)/;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

/** Pure: which look a page shows, given the saved choice and the page's own default. */
export function effectiveTheme(saved: unknown, pageDefault: ThemeMode, pathname = ""): ThemeMode {
  if (lockedDarkPath.test(pathname)) return "dark";
  return isThemeMode(saved) ? saved : pageDefault;
}

/** Runs in <head> before paint. Kept tiny and dependency-free. */
export const themeBootScript = `(function(){try{if(${lockedDarkPath}.test(location.pathname))return;var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

export function readSavedTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

const themeColors: Record<ThemeMode, string> = { dark: "#141a2e", light: "#f5f6f9" };

export function setTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* private mode: still switch for this visit */
  }
  const root = document.documentElement;
  root.classList.add("theme-switching");
  if (!lockedDarkPath.test(window.location.pathname)) root.setAttribute("data-theme", mode);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[mode]);
  window.setTimeout(() => root.classList.remove("theme-switching"), 320);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: mode }));
}

/** Call from an effect on always-dark pages: drops the saved look while the page is open. */
export function lockDarkWhileMounted(): () => void {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  return () => {
    const saved = readSavedTheme();
    if (saved) root.setAttribute("data-theme", saved);
  };
}
