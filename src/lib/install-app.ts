/** Which "install CricLume" help to offer on this device. Pure so it can be tested. */
export type InstallMode = "installed" | "prompt" | "ios-safari" | "ios-other" | "none";

export function installMode(input: { userAgent: string; standalone: boolean; canPrompt: boolean; maxTouchPoints?: number }): InstallMode {
  if (input.standalone) return "installed";
  if (input.canPrompt) return "prompt";
  const ua = input.userAgent;
  // iPadOS reports itself as a Mac; touch points tell them apart.
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (input.maxTouchPoints ?? 0) > 1);
  if (!ios) return "none";
  // Chrome, Firefox and Edge on iOS show as CriOS / FxiOS / EdgiOS; since iOS 16.4 they can add to home screen
  // from their own share menu, but the steps differ, so point them to Safari's.
  return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other" : "ios-safari";
}

export const INSTALL_DISMISS_KEY = "criclume-install-dismissed";
export const INSTALL_SNOOZE_DAYS = 30;

export function installSnoozed(dismissedAt: string | null, now = Date.now()): boolean {
  const at = dismissedAt ? Date.parse(dismissedAt) : Number.NaN;
  return Number.isFinite(at) && now - at < INSTALL_SNOOZE_DAYS * 86_400_000;
}
