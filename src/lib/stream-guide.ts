/** Free live streaming with OBS: per-platform stream settings and the overlay link for each screen shape. */
export type StreamPlatform = "youtube" | "facebook" | "tiktok";

export interface PlatformGuide {
  id: StreamPlatform;
  name: string;
  /** Where the club finds its stream key. */
  keyWhere: string;
  /** OBS "Service" to choose under Settings → Stream. */
  obsService: string;
  canvas: { width: number; height: number };
  vertical: boolean;
  note: string;
}

export const streamPlatforms: PlatformGuide[] = [
  {
    id: "youtube",
    name: "YouTube",
    keyWhere: "YouTube Studio → Create → Go live → Stream. Copy the stream key (new channels must verify by phone and can wait up to 24 hours the first time).",
    obsService: "YouTube - RTMPS (or connect your account in OBS)",
    canvas: { width: 1920, height: 1080 },
    vertical: false,
    note: "Set the stream to Public or Unlisted before you start. Matches stay on your channel afterwards.",
  },
  {
    id: "facebook",
    name: "Facebook",
    keyWhere: "Facebook → your club Page → Live video → Streaming software. Copy the stream key (tick “Use persistent stream key” to reuse it every match).",
    obsService: "Facebook Live",
    canvas: { width: 1920, height: 1080 },
    vertical: false,
    note: "Post from the club Page rather than a personal profile so members can find it.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    keyWhere: "TikTok LIVE Studio / LIVE Center → Go LIVE → Streaming software (OBS). The server URL and stream key appear there. TikTok only gives this to eligible accounts — often 1,000+ followers and 18+.",
    obsService: "Custom… (paste TikTok's server URL and key)",
    canvas: { width: 1080, height: 1920 },
    vertical: true,
    note: "TikTok is portrait. Use a vertical canvas and the compact corner score so it doesn't cover the play. The stream key changes each time you go live.",
  },
];

/** Upload speed needed for a steady stream at each quality (Mbps, with headroom for a busy ground). */
export const qualityPresets = [
  { label: "720p, 30 fps", bitrateKbps: 3000, minUploadMbps: 5 },
  { label: "1080p, 30 fps", bitrateKbps: 5000, minUploadMbps: 8 },
] as const;

/** The best quality an upload speed supports, or null if even 720p is too much. */
export function presetForUpload(uploadMbps: number) {
  return [...qualityPresets].reverse().find((preset) => uploadMbps >= preset.minUploadMbps) ?? null;
}

export function overlayUrl(origin: string, slug: string, platform: StreamPlatform): string {
  const base = `${origin.replace(/\/$/, "")}/overlay/${encodeURIComponent(slug)}`;
  return platform === "tiktok" ? `${base}?layout=corner` : base;
}
