/** Pure helpers for the own-domain club website (League plan): progress steps and DNS records. */
export type DomainStatus = "requested" | "setting_up" | "live" | "paused" | "declined";

export const domainStatusLabels: Record<DomainStatus, string> = {
  requested: "Requested",
  setting_up: "Add DNS records",
  live: "Live",
  paused: "Paused",
  declined: "Declined",
};

export const domainSteps: { status: DomainStatus; title: string; detail: string }[] = [
  { status: "requested", title: "Request sent", detail: "CricLume prepares your address — usually within one working day." },
  { status: "setting_up", title: "Add the records", detail: "Add the records below where your domain is managed (your domain provider)." },
  { status: "live", title: "Live", detail: "Your website opens at your own address, with a secure https link." },
];

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
export function dnsRecordsFor(aTarget: string | null | undefined, extra: string | null | undefined): DnsRecord[] {
  const records: DnsRecord[] = [];
  const target = aTarget?.trim();
  if (target) {
    records.push({ type: "A", name: "@", value: target }, { type: "A", name: "www", value: target });
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
  return host.length >= 4 && host.length <= 253 && /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host);
}
