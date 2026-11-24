/**
 * One login, at most two devices at once (club workspace and scorer only).
 * The database (`claim_login_device`, `login_device_limit()`) is the real rule; this mirrors it for screens and tests.
 * Camera phones, ground screens and overlays never check in, so they are not counted.
 */
export const deviceLimit = 2;

export type DeviceStatus = "active" | "revoked" | "unknown";

/** Which devices a new sign-in pushes out: keep the newest `limit` sign-ins, sign out the rest (oldest first). */
export function devicesToSignOut<T extends { id: string; signedInAt: string }>(
  active: readonly T[],
  limit: number = deviceLimit,
): T[] {
  const newestFirst = [...active].sort(
    (a, b) =>
      new Date(b.signedInAt).getTime() - new Date(a.signedInAt).getTime() ||
      a.id.localeCompare(b.id),
  );
  return newestFirst.slice(limit).reverse();
}

/** A friendly name for this device from the browser's user agent, e.g. "iPhone · Safari". */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent || "";
  const device = /iPad/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? "Android phone"
          : "Android tablet"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows PC"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux PC"
                : "Device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /FxiOS|Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "";
  return browser ? `${device} · ${browser}` : device;
}

/** Only a server answer of "revoked" signs a device out; offline or failed checks never do. */
export function shouldSignOut(status: DeviceStatus | null): boolean {
  return status === "revoked";
}
