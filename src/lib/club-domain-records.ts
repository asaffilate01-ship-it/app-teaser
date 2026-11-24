/** Pure helpers for the club website address (League plan): own domain or free <name>.criclume.com. Progress steps and DNS records. */
export type DomainKind = "own" | "criclume";
export const CRICLUME_SITE_SUFFIX = ".criclume.com";
export type DomainStatus = "requested" | "setting_up" | "live" | "paused" | "declined";

export const domainStatusLabels: Record<DomainStatus, string> = {
  requested: "Requested",
  setting_up: "Add DNS records",
  live: "Live",
  paused: "Paused",
  declined: "Declined",
};

export const domainSteps: { status: DomainStatus; title: string; detail: string }[] = [
  {
    status: "requested",
    title: "Request sent",
    detail: "CricLume prepares your address — usually within one working day.",
  },
  {
    status: "setting_up",
    title: "Add the records",
    detail: "Add the records below where your domain is managed (your domain provider).",
  },
  {
    status: "live",
    title: "Live",
    detail: "Your website opens at your own address, with a secure https link.",
  },
];

/** Steps for a free CricLume address: nothing for the club to add. */
export const criclumeAddressSteps: { status: DomainStatus; title: string; detail: string }[] = [
  {
    status: "requested",
    title: "Request sent",
    detail: "CricLume reserves your address — usually within one working day.",
  },
  {
    status: "setting_up",
    title: "CricLume sets it up",
    detail: "We connect it and add the secure https link. Nothing for you to do.",
  },
  {
    status: "live",
    title: "Live",
    detail: "Your website opens at your CricLume address, with your logo first.",
  },
];

/** Names CricLume keeps for itself. Keep in step with public.is_reserved_club_label in the database. */
export const reservedClubLabels = new Set([
  "www",
  "app",
  "apps",
  "api",
  "admin",
  "staff",
  "auth",
  "login",
  "signin",
  "account",
  "accounts",
  "billing",
  "pay",
  "payments",
  "mail",
  "email",
  "smtp",
  "imap",
  "pop",
  "ftp",
  "mx",
  "ns",
  "ns1",
  "ns2",
  "ns3",
  "dns",
  "cdn",
  "static",
  "assets",
  "media",
  "img",
  "images",
  "video",
  "videos",
  "stream",
  "live",
  "help",
  "support",
  "status",
  "docs",
  "blog",
  "news",
  "shop",
  "store",
  "tickets",
  "dev",
  "test",
  "staging",
  "preview",
  "beta",
  "demo",
  "platform",
  "dashboard",
  "club",
  "clubs",
  "league",
  "leagues",
  "ground",
  "overlay",
  "scoreboard",
  "umpire",
  "umpires",
  "sponsor",
  "sponsors",
  "promo",
  "ads",
  "ad",
  "m",
  "mobile",
  "criclume",
  "lovable",
  "official",
  "security",
  "legal",
  "privacy",
  "terms",
]);

/** Typed name → the part before .criclume.com ("Riverside CC" → "riverside-cc"). */
export function cleanClubLabel(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/\.criclume\.com.*$/, "")
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** Why a name can't be used, or null when it looks fine. The database does the real check. */
export function clubLabelProblem(label: string): string | null {
  if (label.length < 3) return "Use at least 3 letters or numbers";
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(label) || label.includes("--"))
    return "Use letters, numbers and single dashes only";
  if (reservedClubLabels.has(label)) return "That name is kept by CricLume — try your club name";
  return null;
}

/**
 * Records CricLume staff add in criclume.com's DNS for a free club address:
 * the name pointing at hosting, plus the verification records hosting shows ("TYPE NAME VALUE" lines).
 */
export function criclumeStaffRecords(
  hostname: string,
  aTarget: string | null | undefined,
  extra: string | null | undefined,
): DnsRecord[] {
  const label = hostname.endsWith(CRICLUME_SITE_SUFFIX)
    ? hostname.slice(0, -CRICLUME_SITE_SUFFIX.length)
    : hostname;
  const target = aTarget?.trim();
  const records: DnsRecord[] = target ? [{ type: "A", name: label, value: target }] : [];
  return [...records, ...dnsRecordsFor(null, extra)];
}

/** Which step (0-2) the progress bar shows. Paused/declined sit on the first step. */
export function domainStepIndex(status: DomainStatus): number {
  if (status === "live") return 2;
  if (status === "setting_up") return 1;
  return 0;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
}

/**
 * DNS records a club adds. Staff enter the address (A record target) and any extra records,
 * one per line as "TYPE NAME VALUE" (e.g. "TXT _lovable lovable_verify=abc").
 * The root and www both point at the same address.
 */
export function dnsRecordsFor(
  aTarget: string | null | undefined,
  extra: string | null | undefined,
): DnsRecord[] {
  const records: DnsRecord[] = [];
  const target = aTarget?.trim();
  if (target) {
    records.push(
      { type: "A", name: "@", value: target },
      { type: "A", name: "www", value: target },
    );
  }
  for (const line of (extra ?? "").split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const [type, name, ...value] = parts;
    if (!/^(A|AAAA|CNAME|TXT|MX|CAA)$/i.test(type!)) continue;
    records.push({ type: type!.toUpperCase(), name: name!, value: value.join(" ") });
  }
  return records;
}

/** Light check before sending; the database does the real check. */
export function cleanDomainInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split(/[/?#]/)[0]!
    .split(":")[0]!
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

export function looksLikeDomain(input: string): boolean {
  const host = cleanDomainInput(input);
  return (
    host.length >= 4 &&
    host.length <= 253 &&
    /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host)
  );
}
