/** Secret links for shared scouting reports. Only the SHA-256 hash of the token is stored. */
export const SHARE_DAYS = [7, 30, 90, 180] as const;

export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function shareExpiry(days: number, now = new Date()): string {
  const safe = Math.min(180, Math.max(1, Math.round(days)));
  return new Date(now.getTime() + safe * 86_400_000).toISOString();
}

export const shareLink = (origin: string, token: string) =>
  `${origin.replace(/\/$/, "")}/scout/${token}`;
