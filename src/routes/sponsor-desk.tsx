import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Coins, Globe, ImagePlus, LoaderCircle, MapPin, Megaphone, Pause, Play, Plus, Trash2, Users } from "lucide-react";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { GoogleButton } from "@/components/app-shell/GoogleButton";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { currencies } from "@/components/office/ui";
import { adRevenueSharePercent } from "@/lib/plans";
import { formatMoney, periodRange, type EarningsPeriod } from "@/lib/promo-earnings";
import { matchesTarget, parsePlaceList, slotArtwork, type PromoSlot, type PromoSurface } from "@/lib/promo-targeting";
import {
  deleteCampaign,
  deleteCreative,
  isPromoStaff,
  loadClubPlans,
  loadDesk,
  loadPayouts,
  previewLinks,
  saveCampaign,
  setCampaignStatus,
  setClubPlan,
  setCreativeActive,
  uploadCreative,
  type CampaignDraft,
  type ClubPlanRow,
  type PayoutRow,
  type PromoCampaign,
  type PromoCreative,
} from "@/lib/promo-desk-cloud";
import { staffDomainCloud, type StaffDomainRow } from "@/lib/club-domains-cloud";
import { domainStatusLabels, type DomainStatus } from "@/lib/club-domain-records";

export const Route = createFileRoute("/sponsor-desk")({
  head: () => ({
    meta: [
      { title: "Ads desk — CricLume" },
      { name: "description", content: "CricLume staff desk for booking rotating top and side ad banners, local targeting and club revenue share." },
      { property: "og:title", content: "Ads desk — CricLume" },
      { property: "og:description", content: "Book image, GIF and video ads on CricLume big screens, scoreboards and apps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SponsorDesk,
});

type DeskTab = "campaigns" | "payouts" | "plans" | "domains";
const surfaceLabels: Record<PromoSurface, string> = { ground: "Ground big screen", scoreboard: "Public scoreboard", app: "App (phone & desktop)" };
const statusTone: Record<PromoCampaign["status"], string> = { live: "office-pill-good", paused: "office-pill-warn", draft: "", ended: "office-pill-bad" };

function friendly(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : typeof reason === "object" && reason && "message" in reason ? String((reason as { message: unknown }).message) : "";
  if (/staff only|row-level security|permission/i.test(message)) return "Only CricLume's ads team can do that.";
  return message || "That didn't work. Please try again.";
}

function SponsorDesk() {
  const { configured, session, loading, requestLink, signOut } = useCloudSession();
  const [staff, setStaff] = useState<boolean | null>(null);
  const [tab, setTab] = useState<DeskTab>("campaigns");
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setStaff(null);
      return;
    }
    let active = true;
    void isPromoStaff(userId).then((value) => active && setStaff(value));
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader
        area="Ads desk"
        right={
          session ? (
            <button type="button" className="app-chip-button" onClick={() => void signOut()}>
              Sign out
            </button>
          ) : (
            <Link to="/" className="app-chip-button">
              Back to site
            </Link>
          )
        }
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
        {!configured || loading || (session && staff === null) ? (
          <p className="office-meta flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Loading…
          </p>
        ) : !session ? (
          <SignIn requestLink={requestLink} />
        ) : !staff ? (
          <section className="workspace-empty">
            <h2>This desk is for CricLume's ads team</h2>
            <p>Club treasurers can see their ad earnings in Club office → Ad earnings.</p>
            <Link to="/platform" className="action-primary">
              Go to my club
            </Link>
          </section>
        ) : (
          <>
            <div>
              <p className="panel-kicker">CricLume ads</p>
              <h1 className="font-display text-3xl font-bold md:text-4xl">Ads desk</h1>
              <p className="office-meta mt-1">
                Book rotating top and side banners for big screens, public scoreboards and the app. Free clubs earn {adRevenueSharePercent("starter")}%, paid clubs{" "}
                {adRevenueSharePercent("club")}%, paid + video {adRevenueSharePercent("club", { videoAddon: true })}% of the ad money from their screens.
              </p>
            </div>
            <div className="office-tabs" role="tablist" aria-label="Ads desk">
              {(
                [
                  ["campaigns", "Campaigns", Megaphone],
                  ["payouts", "Club payouts", Coins],
                  ["plans", "Club plans", Users],
                  ["domains", "Club domains", Globe],
                ] as const
              ).map(([value, label, Icon]) => (
                <button key={value} type="button" role="tab" aria-selected={tab === value} className="office-tab" onClick={() => setTab(value)}>
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
            {tab === "campaigns" && <Campaigns />}
            {tab === "payouts" && <Payouts />}
            {tab === "plans" && <Plans />}
            {tab === "domains" && <ClubDomains />}
          </>
        )}
      </main>
    </div>
  );
}

function SignIn({ requestLink }: { requestLink: (email: string, redirectTo?: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await requestLink(email.trim(), `${window.location.origin}/sponsor-desk`);
      setSent(true);
    } catch (reason) {
      toast.error(friendly(reason));
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    const { lovable } = await import("@/integrations/lovable");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/sponsor-desk` });
    if (result.error) toast.error("Google sign-in didn't finish. Please try again.");
  };
  return (
    <section className="office-card mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold">Sign in to the ads desk</h1>
      <GoogleButton onClick={() => void google()} />
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <label className="block">
          <span className="office-label">Email</span>
          <input type="email" required className="scorer-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="media@criclume.com" />
        </label>
        <button type="submit" className="action-primary w-full" disabled={busy}>
          {sent ? "Link sent — check your inbox" : "Email me a sign-in link"}
        </button>
      </form>
    </section>
  );
}

const blankDraft = (): CampaignDraft => ({
  advertiser: "",
  name: "",
  status: "draft",
  starts_on: new Date().toISOString().slice(0, 10),
  ends_on: null,
  price_amount: 0,
  currency: "PKR",
  click_url: null,
  countries: [],
  regions: [],
  cities: [],
  surfaces: ["ground", "scoreboard", "app"],
  weight: 1,
});

function Campaigns() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadDesk>> | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<PromoCampaign | "new" | null>(null);
  const [place, setPlace] = useState({ country: "", region: "", city: "" });

  const reload = useCallback(async () => {
    try {
      const next = await loadDesk();
      setData(next);
      setLinks(await previewLinks(next.creatives.map((item) => item.media_path)));
    } catch (reason) {
      toast.error(friendly(reason));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
      await reload();
    } catch (reason) {
      toast.error(friendly(reason));
    }
  };

  const testing = place.country || place.region || place.city;
  const visitor = { country: place.country.trim().toUpperCase() || null, region: place.region || null, regionCode: null, city: place.city || null };

  if (!data) {
    return (
      <p className="office-meta flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> Loading campaigns…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="office-meta">
          {data.campaigns.filter((item) => item.status === "live").length} live · {data.campaigns.length} total
        </p>
        <button type="button" className="action-primary" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> New campaign
        </button>
      </div>

      {editing && (
        <CampaignForm
          initial={editing === "new" ? blankDraft() : editing}
          onCancel={() => setEditing(null)}
          onSave={async (draft) => {
            await run(() => saveCampaign(editing === "new" ? null : editing.id, draft), editing === "new" ? "Campaign created" : "Campaign saved");
            setEditing(null);
          }}
        />
      )}

      <section className="office-card">
        <h3 className="flex items-center gap-2">
          <MapPin className="size-4 text-gold" /> Check a place
        </h3>
        <p className="office-meta mb-3">See which live campaigns a viewer in this place would get.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className="scorer-input" placeholder="Country code (PK)" maxLength={2} value={place.country} onChange={(event) => setPlace({ ...place, country: event.target.value })} />
          <input className="scorer-input" placeholder="Region (Punjab)" value={place.region} onChange={(event) => setPlace({ ...place, region: event.target.value })} />
          <input className="scorer-input" placeholder="City (Lahore)" value={place.city} onChange={(event) => setPlace({ ...place, city: event.target.value })} />
        </div>
      </section>

      {data.campaigns.length === 0 && (
        <section className="workspace-empty">
          <h2>No campaigns yet</h2>
          <p>Create a campaign, then upload a top banner, a side banner, or both.</p>
        </section>
      )}

      {data.campaigns.map((campaign) => {
        const creatives = data.creatives.filter((item) => item.campaign_id === campaign.id);
        const reaches = matchesTarget(campaign, visitor);
        return (
          <section key={campaign.id} className={`office-card space-y-3 ${testing && !reaches ? "opacity-50" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3>{campaign.advertiser}</h3>
                  <span className={`office-pill ${statusTone[campaign.status]}`}>{campaign.status}</span>
                  {testing && <span className={`office-pill ${reaches ? "office-pill-good" : ""}`}>{reaches ? "Shows here" : "Not shown here"}</span>}
                </div>
                <p className="office-meta">
                  {campaign.name} · {campaign.starts_on}
                  {campaign.ends_on ? ` to ${campaign.ends_on}` : " onwards"} · {formatMoney(Number(campaign.price_amount), campaign.currency)} ·{" "}
                  {(data.plays[campaign.id] ?? 0).toLocaleString()} plays
                </p>
                <p className="office-meta">
                  Where: {[campaign.countries.join(", "), campaign.regions.join(", "), campaign.cities.join(", ")].filter(Boolean).join(" · ") || "Everywhere"} · On:{" "}
                  {campaign.surfaces.map((value) => surfaceLabels[value]).join(", ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {campaign.status === "live" ? (
                  <button type="button" className="action-secondary" onClick={() => void run(() => setCampaignStatus(campaign.id, "paused"), "Campaign paused")}>
                    <Pause className="size-4" /> Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className="action-primary"
                    disabled={creatives.length === 0}
                    title={creatives.length === 0 ? "Upload a banner first" : undefined}
                    onClick={() => void run(() => setCampaignStatus(campaign.id, "live"), "Campaign is live")}
                  >
                    <Play className="size-4" /> Go live
                  </button>
                )}
                <button type="button" className="action-secondary" onClick={() => setEditing(campaign)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="action-secondary"
                  aria-label={`Delete ${campaign.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete "${campaign.name}" and its banners? Play counts for it are removed too.`))
                      void run(() => deleteCampaign(campaign.id, creatives.map((item) => item.media_path)), "Campaign deleted");
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              {(["top", "side"] as const).map((slot) => (
                <SlotCreatives
                  key={slot}
                  slot={slot}
                  creatives={creatives.filter((item) => item.slot === slot)}
                  links={links}
                  onUpload={(file, options) => run(() => uploadCreative(campaign.id, slot, file, options), "Banner uploaded")}
                  onToggle={(item) => void run(() => setCreativeActive(item.id, !item.active), item.active ? "Banner switched off" : "Banner switched on")}
                  onDelete={(item) => void run(() => deleteCreative(item), "Banner removed")}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SlotCreatives({
  slot,
  creatives,
  links,
  onUpload,
  onToggle,
  onDelete,
}: {
  slot: PromoSlot;
  creatives: PromoCreative[];
  links: Record<string, string>;
  onUpload: (file: File, options: { durationSeconds: number; altText: string }) => Promise<void>;
  onToggle: (item: PromoCreative) => void;
  onDelete: (item: PromoCreative) => void;
}) {
  const art = slotArtwork[slot];
  const [seconds, setSeconds] = useState(10);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="office-row flex-col items-stretch">
      <div className="flex items-center justify-between gap-2">
        <strong>{art.label}</strong>
        <span className="office-meta">{art.size}</span>
      </div>
      {creatives.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <div className={`promo-slot promo-page promo-slot-${slot} shrink-0 ${slot === "top" ? "!w-48" : "!w-16"}`}>
            {links[item.media_path] &&
              (item.media_kind === "video" ? (
                <video className="promo-media object-contain" src={links[item.media_path]} muted autoPlay loop playsInline />
              ) : (
                <img className="promo-media object-contain" src={links[item.media_path]} alt={item.alt_text} />
              ))}
          </div>
          <span className="office-meta min-w-0 flex-1 truncate">
            {item.media_kind === "video" ? "MP4 · plays through" : `${item.duration_seconds}s`} {item.active ? "" : "· off"}
          </span>
          <button type="button" className="office-choice" aria-pressed={item.active} onClick={() => onToggle(item)}>
            {item.active ? "On" : "Off"}
          </button>
          <button type="button" className="office-choice" aria-label="Remove banner" onClick={() => onDelete(item)}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)]">
        <label>
          <span className="office-label">Seconds</span>
          <input type="number" min={3} max={60} className="scorer-input" value={seconds} onChange={(event) => setSeconds(Number(event.target.value) || 10)} />
        </label>
        <label>
          <span className="office-label">Describe it</span>
          <input className="scorer-input" maxLength={200} value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Ali Sports — 20% off bats" />
        </label>
      </div>
      <label className={`action-secondary cursor-pointer justify-center ${busy ? "opacity-60" : ""}`}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Upload image, GIF or MP4
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,video/mp4"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setBusy(true);
            void onUpload(file, { durationSeconds: seconds, altText: alt }).finally(() => {
              setBusy(false);
              setAlt("");
            });
          }}
        />
      </label>
    </div>
  );
}

function CampaignForm({ initial, onCancel, onSave }: { initial: CampaignDraft; onCancel: () => void; onSave: (draft: CampaignDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<CampaignDraft>(initial);
  const [places, setPlaces] = useState({ countries: initial.countries.join(", "), regions: initial.regions.join(", "), cities: initial.cities.join(", ") });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  const currencyOptions = useMemo(() => [...new Set([draft.currency, "PKR", "GBP", "USD", ...currencies])], [draft.currency]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (draft.surfaces.length === 0) return void toast.error("Choose at least one screen.");
    setBusy(true);
    await onSave({
      ...draft,
      advertiser: draft.advertiser.trim(),
      name: draft.name.trim(),
      click_url: draft.click_url?.trim() ? draft.click_url.trim() : null,
      countries: parsePlaceList(places.countries, { countryCodes: true }),
      regions: parsePlaceList(places.regions),
      cities: parsePlaceList(places.cities),
    });
    setBusy(false);
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="office-card space-y-3">
      <h3>{initial.advertiser ? "Edit campaign" : "New campaign"}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="office-label">Advertiser</span>
          <input required maxLength={120} className="scorer-input" value={draft.advertiser} onChange={(event) => set("advertiser", event.target.value)} placeholder="Ali Sports, Lahore" />
        </label>
        <label>
          <span className="office-label">Campaign name</span>
          <input required maxLength={120} className="scorer-input" value={draft.name} onChange={(event) => set("name", event.target.value)} placeholder="Summer bat sale" />
        </label>
        <label>
          <span className="office-label">Starts</span>
          <input type="date" required className="scorer-input" value={draft.starts_on} onChange={(event) => set("starts_on", event.target.value)} />
        </label>
        <label>
          <span className="office-label">Ends (optional)</span>
          <input type="date" className="scorer-input" min={draft.starts_on} value={draft.ends_on ?? ""} onChange={(event) => set("ends_on", event.target.value || null)} />
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
          <label>
            <span className="office-label">Advertiser pays</span>
            <input type="number" min={0} step="0.01" required className="scorer-input" value={draft.price_amount} onChange={(event) => set("price_amount", Number(event.target.value) || 0)} />
          </label>
          <label>
            <span className="office-label">Currency</span>
            <select className="scorer-input" value={draft.currency} onChange={(event) => set("currency", event.target.value)}>
              {currencyOptions.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span className="office-label">Link when tapped (https://…)</span>
          <input type="url" pattern="https://.*" className="scorer-input" value={draft.click_url ?? ""} onChange={(event) => set("click_url", event.target.value)} placeholder="https://alisports.pk" />
        </label>
        <label>
          <span className="office-label">Countries (codes, blank = all)</span>
          <input className="scorer-input" value={places.countries} onChange={(event) => setPlaces({ ...places, countries: event.target.value })} placeholder="PK, AE" />
        </label>
        <label>
          <span className="office-label">Regions (blank = all)</span>
          <input className="scorer-input" value={places.regions} onChange={(event) => setPlaces({ ...places, regions: event.target.value })} placeholder="Punjab, Sindh" />
        </label>
        <label>
          <span className="office-label">Cities (blank = all)</span>
          <input className="scorer-input" value={places.cities} onChange={(event) => setPlaces({ ...places, cities: event.target.value })} placeholder="Lahore, Karachi" />
        </label>
        <label>
          <span className="office-label">How often (1–10)</span>
          <input type="number" min={1} max={10} className="scorer-input" value={draft.weight} onChange={(event) => set("weight", Math.max(1, Math.min(10, Number(event.target.value) || 1)))} />
        </label>
      </div>
      <fieldset>
        <legend className="office-label">Show on</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(surfaceLabels) as PromoSurface[]).map((value) => {
            const on = draft.surfaces.includes(value);
            return (
              <button
                key={value}
                type="button"
                className="office-choice"
                aria-pressed={on}
                onClick={() => set("surfaces", on ? draft.surfaces.filter((item) => item !== value) : [...draft.surfaces, value])}
              >
                {surfaceLabels[value]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <button type="button" className="action-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="action-primary" disabled={busy}>
          {busy && <LoaderCircle className="size-4 animate-spin" />} Save campaign
        </button>
      </div>
    </form>
  );
}

function Payouts() {
  const [period, setPeriod] = useState<EarningsPeriod>("lastMonth");
  const [rows, setRows] = useState<PayoutRow[] | null>(null);
  useEffect(() => {
    let active = true;
    setRows(null);
    const { from, to } = periodRange(period);
    loadPayouts(from, to)
      .then((next) => active && setRows(next))
      .catch((reason) => {
        if (active) setRows([]);
        toast.error(friendly(reason));
      });
    return () => {
      active = false;
    };
  }, [period]);
  return (
    <section className="office-card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>What each club has earned</h3>
          <p className="office-meta">Campaign price × the club's share of that campaign's plays × the club's revenue share at the time.</p>
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["month", "This month"],
              ["lastMonth", "Last month"],
              ["year", "This year"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" className="office-choice" aria-pressed={period === value} onClick={() => setPeriod(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {!rows ? (
        <p className="office-meta flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" /> Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="office-meta">No club plays in this period.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={`${row.organisation_id}-${row.currency}`} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <div>
                <p className="font-semibold">{row.organisation_name}</p>
                <p className="office-meta">{Number(row.plays).toLocaleString()} plays</p>
              </div>
              <strong>{formatMoney(Number(row.estimated_earnings ?? 0), row.currency)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Plans() {
  const [rows, setRows] = useState<ClubPlanRow[] | null>(null);
  const reload = useCallback(() => {
    loadClubPlans()
      .then(setRows)
      .catch((reason) => {
        setRows([]);
        toast.error(friendly(reason));
      });
  }, []);
  useEffect(reload, [reload]);
  const change = async (row: ClubPlanRow, plan: ClubPlanRow["plan"], video: boolean) => {
    try {
      await setClubPlan(row.organisation_id, plan, video);
      toast.success(`${row.organisation_name} now earns ${adRevenueSharePercent(plan, { videoAddon: video })}% of its ad money`);
      reload();
    } catch (reason) {
      toast.error(friendly(reason));
    }
  };
  return (
    <section className="office-card space-y-3">
      <div>
        <h3>Club plans</h3>
        <p className="office-meta">Set each club's plan while payments are arranged directly. The plan decides its ad revenue share.</p>
      </div>
      {!rows ? (
        <p className="office-meta flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" /> Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="office-meta">No clubs yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.organisation_id} className="office-row">
              <div className="min-w-0">
                <p className="font-semibold">{row.organisation_name}</p>
                <p className="office-meta">
                  {row.kind} · earns {adRevenueSharePercent(row.plan, { videoAddon: row.video_addon })}%
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <select aria-label={`Plan for ${row.organisation_name}`} className="scorer-input !h-10 !w-auto" value={row.plan} onChange={(event) => void change(row, event.target.value as ClubPlanRow["plan"], row.video_addon)}>
                  <option value="starter">Free</option>
                  <option value="club">Club</option>
                  <option value="league">League</option>
                </select>
                <button
                  type="button"
                  className="office-choice"
                  aria-pressed={row.video_addon}
                  disabled={row.plan === "starter"}
                  onClick={() => void change(row, row.plan, !row.video_addon)}
                >
                  Video add-on
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const domainStatusOrder: DomainStatus[] = ["requested", "setting_up", "live", "paused", "declined"];

/**
 * League-plan clubs asking to run their website on their own domain. Staff first connect the
 * domain to CricLume's hosting (Project Settings → Domains), copy the records it shows here for
 * the club, then mark it live once hosting reports the domain active.
 */
function ClubDomains() {
  const [rows, setRows] = useState<StaffDomainRow[] | null>(null);
  const reload = useCallback(() => {
    staffDomainCloud
      .list()
      .then(setRows)
      .catch((reason) => {
        setRows([]);
        toast.error(friendly(reason));
      });
  }, []);
  useEffect(reload, [reload]);
  return (
    <section className="office-card space-y-3">
      <div>
        <h3>Club websites on their own domain</h3>
        <p className="office-meta">
          League plan only. Connect the domain to CricLume hosting first, paste the records it shows (address, then any extra records as
          “TYPE NAME VALUE”, one per line), then set it live once hosting shows it active.
        </p>
      </div>
      {!rows ? (
        <p className="office-meta flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" /> Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="office-meta">No requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <DomainRequest key={row.id} row={row} onSaved={reload} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DomainRequest({ row, onSaved }: { row: StaffDomainRow; onSaved: () => void }) {
  const [status, setStatus] = useState<DomainStatus>(row.status as DomainStatus);
  const [aTarget, setATarget] = useState(row.dns_a_target ?? "");
  const [records, setRecords] = useState(row.dns_txt_value ?? "");
  const [note, setNote] = useState(row.staff_note ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await staffDomainCloud.update(row.id, { status, aTarget, records, note });
      toast.success(`${row.hostname}: ${domainStatusLabels[status]}`);
      onSaved();
    } catch (reason) {
      toast.error(friendly(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="office-row !block space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{row.hostname}</p>
          <p className="office-meta">
            {row.organisation_name} · /club/{row.site_slug} · {row.site_published ? "site published" : "site not published"}
            {row.plan_allowed ? "" : " · not on League plan"}
          </p>
        </div>
        <span className={`office-pill ${row.status === "live" ? "office-pill-good" : row.status === "declined" || row.status === "paused" ? "office-pill-bad" : "office-pill-warn"}`}>
          {domainStatusLabels[row.status as DomainStatus]}
        </span>
      </div>
      <form className="grid gap-2 md:grid-cols-[10rem_12rem_1fr]" onSubmit={(event) => void save(event)}>
        <label className="grid gap-1 text-xs font-semibold">
          Status
          <select className="scorer-input !h-10" value={status} onChange={(e) => setStatus(e.target.value as DomainStatus)}>
            {domainStatusOrder.map((value) => (
              <option key={value} value={value}>
                {domainStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Address (A record)
          <input className="scorer-input !h-10" value={aTarget} onChange={(e) => setATarget(e.target.value)} placeholder="IP from hosting" />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Note for the club
          <input className="scorer-input !h-10" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-semibold md:col-span-3">
          Extra records (one per line)
          <textarea
            className="scorer-input min-h-20 py-2 font-mono text-xs"
            value={records}
            onChange={(e) => setRecords(e.target.value)}
            placeholder={"TXT _lovable lovable_verify=…\nTXT _lovable.www lovable_verify=…"}
          />
        </label>
        <div className="md:col-span-3">
          <button type="submit" className="action-primary" disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Globe className="size-4" />} Save
          </button>
        </div>
      </form>
    </li>
  );
}
