const allowedHosts = ["criclume.com", "www.criclume.com", "app-teaser.lovable.app", "localhost"];

/** Invitation links only ever send people back to CricLume's own sites. */
export function safeInviteRedirect(origin: string): string {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    const ok =
      allowedHosts.includes(host) ||
      (host.endsWith(".lovable.app") && host.includes("4fdd88f7-86ce-40f6-8f36-03dbb58cdac2"));
    if (ok && (url.protocol === "https:" || host === "localhost")) return `${url.origin}/platform`;
  } catch {
    // fall through
  }
  return "https://criclume.com/platform";
}
