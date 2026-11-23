import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, ExternalLink, Globe, LoaderCircle, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { clubDomainCloud, type ClubDomainRow } from "@/lib/club-domains-cloud";
import {
  cleanDomainInput,
  dnsRecordsFor,
  domainStatusLabels,
  domainStepIndex,
  domainSteps,
  looksLikeDomain,
  type DomainStatus,
} from "@/lib/club-domain-records";
import { Empty, OfficeCard, OfficeField, Pill } from "@/components/office/ui";

const tone: Record<DomainStatus, "good" | "warn" | "bad" | undefined> = {
  requested: "warn",
  setting_up: "warn",
  live: "good",
  paused: "bad",
  declined: "bad",
};

/** League plan: the club website on the club's own domain, co-branded with CricLume. The database enforces the plan and roles. */
export function DomainPanel({ organisationId, editor, published }: { organisationId: string; editor: boolean; published: boolean }) {
  const [state, setState] = useState<{ allowed: boolean; domain: ClubDomainRow | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setState(await clubDomainCloud.load(organisationId));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your web address settings could not load.");
    }
  }, [organisationId]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      await reload();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !state)
    return (
      <div className="office-card">
        <p className="office-meta">{error}</p>
        <button type="button" className="action-secondary mt-3" onClick={() => void reload()}>
          Try again
        </button>
      </div>
    );
  if (!state)
    return (
      <div className="office-card flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> Loading…
      </div>
    );

  if (!state.allowed && !state.domain) {
    return (
      <div className="domain-locked">
        <span className="icon-tile inline-flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <p className="panel-kicker">League plan</p>
          <h3 className="font-display text-2xl font-bold">Your website on your own domain</h3>
          <p className="office-meta max-w-xl">
            Run your club website at your own address — like <strong>yourclub.com</strong> — with your logo and colours first and a small
            “powered by CricLume” mark. Secure https, live scores, fixtures, results, news and photos included.
          </p>
          <ul className="domain-perks">
            <li><CheckCircle2 aria-hidden="true" /> Your own web address, with or without www</li>
            <li><CheckCircle2 aria-hidden="true" /> Club-first branding with your logo</li>
            <li><CheckCircle2 aria-hidden="true" /> Secure https set up for you</li>
          </ul>
          <a className="action-primary mt-2" href="mailto:hello@criclume.com?subject=CricLume%20League%20plan%20-%20own%20domain">
            Ask about the League plan
          </a>
        </div>
      </div>
    );
  }

  const domain = state.domain;
  if (!domain) {
    const host = cleanDomainInput(input);
    const ok = looksLikeDomain(input);
    return (
      <OfficeCard title="Use your own domain" description="Enter a domain your club already owns. You can use the main domain or a sub-address like cricket.yourclub.org.">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ok) {
              toast.error("Enter a web address like yourclub.com");
              return;
            }
            void run(() => clubDomainCloud.request(organisationId, host), "Request sent — we'll set it up and show you the records here");
          }}
        >
          <OfficeField label="Your domain">
            <div className="domain-input">
              <span aria-hidden="true">https://</span>
              <input
                className="scorer-input"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="yourclub.com"
                value={input}
                maxLength={253}
                disabled={!editor || busy}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
          </OfficeField>
          {!published && <p className="office-meta">Tip: publish your website first — the address only opens once the site is published.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="action-primary" disabled={!editor || busy || !ok}>
              <Globe className="size-4" aria-hidden="true" /> Request this address
            </button>
            {!editor && <span className="office-meta">Only the club owner and admins can set this.</span>}
          </div>
        </form>
      </OfficeCard>
    );
  }

  const status = domain.status as DomainStatus;
  const step = domainStepIndex(status);
  const records = dnsRecordsFor(domain.dns_a_target, domain.dns_txt_value);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <OfficeCard title={domain.hostname} description="Your club website on your own domain">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={tone[status]}>{domainStatusLabels[status]}</Pill>
          {!state.allowed && <Pill tone="bad">League plan needed</Pill>}
          {status === "live" && (
            <a href={`https://${domain.hostname}`} target="_blank" rel="noopener noreferrer" className="action-secondary">
              <ExternalLink className="size-4" aria-hidden="true" /> Open website
            </a>
          )}
        </div>
        <ol className="domain-steps" aria-label="Progress">
          {domainSteps.map((item, index) => (
            <li key={item.status} data-state={index < step ? "done" : index === step ? "current" : "todo"}>
              <span className="domain-step-dot" aria-hidden="true">{index < step || status === "live" ? "✓" : index + 1}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
            </li>
          ))}
        </ol>
        {status === "paused" && <p className="office-meta">Paused — visitors see the CricLume address for now. {domain.staff_note}</p>}
        {domain.staff_note && status !== "paused" && <p className="office-meta">Note from CricLume: {domain.staff_note}</p>}
        {editor && (
          <button
            type="button"
            className="action-secondary mt-4"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Stop using ${domain.hostname}? Your website stays at its CricLume address.`))
                void run(() => clubDomainCloud.remove(organisationId), "Address removed");
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" /> Remove this address
          </button>
        )}
      </OfficeCard>

      <OfficeCard title="DNS records" description="Add these where your domain is managed. Changes can take a few hours to reach everyone.">
        {records.length === 0 ? (
          <Empty>{status === "requested" ? "CricLume is preparing your records — they'll appear here." : "No records needed right now."}</Empty>
        ) : (
          <ul className="domain-records">
            {records.map((record) => (
              <li key={`${record.type}-${record.name}-${record.value}`}>
                <span className="domain-record-type">{record.type}</span>
                <span className="domain-record-name">{record.name}</span>
                <code className="domain-record-value">{record.value}</code>
                <button
                  type="button"
                  className="app-icon-button"
                  aria-label={`Copy ${record.type} ${record.name} value`}
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(record.value)
                      .then(() => toast.success("Copied"))
                      .catch(() => window.prompt("Copy this value", record.value))
                  }
                >
                  <Copy className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="office-meta mt-3 flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
          Remove any old records for the same names first. If your domain sits behind Cloudflare or a similar service, tell us before adding them.
        </p>
      </OfficeCard>
    </div>
  );
}
