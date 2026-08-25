import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { regions, defaultRegion, findRegion, detectCountry, type Region } from "@/lib/pricing";
import { I18nProvider, useI18n, LanguageSelect } from "@/lib/i18n";
import type { Content } from "@/lib/content";
import {
  Activity,
  ChevronDown,
  Video,
  BarChart3,
  Smartphone,
  Users,
  Shield,
  Zap,
  Home,
  Layers,
  Images,
  HelpCircle,
  Lock,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  Globe,
  Tag,
  Building2,
  Trophy,
} from "lucide-react";

import logoAsset from "@/assets/criclume-logo-header.png.asset.json";
import fullLogoAsset from "@/assets/criclume-logo-full.png.asset.json";
import shotDashboard from "@/assets/shot-dashboard.jpg";
import shotScoreboard from "@/assets/shot-scoreboard.jpg";
import shotMobile from "@/assets/shot-mobile.jpg";
import shotReview from "@/assets/shot-review.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CricLume — See every ball. Shape every game." },
      {
        name: "description",
        content:
          "CricLume is ball-by-ball cricket scoring with multi-angle camera rooms, live scoreboards and coaching review. Available in English, German, Dutch, Afrikaans and French.",
      },
      { property: "og:title", content: "CricLume — See every ball. Shape every game." },
      {
        property: "og:description",
        content:
          "Ball-by-ball scoring, multi-phone camera rooms, live scoreboards and slow-motion coaching review for clubs and academies.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://app-teaser.lovable.app/" },
      {
        property: "og:image",
        content: `https://app-teaser.lovable.app${fullLogoAsset.url}`,
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: `https://app-teaser.lovable.app${fullLogoAsset.url}`,
      },
    ],
    links: [{ rel: "canonical", href: "https://app-teaser.lovable.app/" }],
  }),
  component: PromoRoot,
});

type TabId = "home" | "features" | "screens" | "pricing" | "faq" | "login";

const tabMeta: { id: TabId; icon: typeof Home; key: keyof Content["nav"] }[] = [
  { id: "home", icon: Home, key: "home" },
  { id: "features", icon: Layers, key: "features" },
  { id: "screens", icon: Images, key: "screens" },
  { id: "pricing", icon: Tag, key: "pricing" },
  { id: "faq", icon: HelpCircle, key: "faq" },
  { id: "login", icon: Lock, key: "login" },
];

const featureIcons = [Zap, Video, Activity, BarChart3, Smartphone, Users, Eye];
const screenImages = [
  { src: shotDashboard, w: 1600, h: 1008 },
  { src: shotScoreboard, w: 1600, h: 1008 },
  { src: shotMobile, w: 768, h: 1408 },
  { src: shotReview, w: 1600, h: 1008 },
];
const planIcons = [Zap, Building2, Trophy];
const revenueIcons = [Tag, Video, Globe, Users];

function PromoRoot() {
  return (
    <I18nProvider>
      <Promo />
    </I18nProvider>
  );
}

function Promo() {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("home");
  const active = tabMeta.find((m) => m.id === tab)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border/60 md:max-w-none md:border-x-0">
        <Ticker />
        <Header
          tab={tab}
          label={t.nav[active.key]}
          onHome={() => setTab("home")}
          onChange={setTab}
        />
        <main className="flex-1 overflow-y-auto px-5 pb-10 pt-5 md:mx-auto md:w-full md:max-w-6xl md:px-8 md:pb-16 md:pt-12 lg:px-12">
          <TabPanel key={tab}>
            {tab === "home" && <HomeTab onNavigate={setTab} />}
            {tab === "features" && <FeaturesTab />}
            {tab === "screens" && <ScreensTab />}
            {tab === "pricing" && <PricingTab />}
            {tab === "faq" && <FaqTab />}
            {tab === "login" && <LoginTab />}
          </TabPanel>
        </main>
        <SiteFooter onNavigate={setTab} />
        <BottomNav tab={tab} onChange={setTab} />
      </div>
    </div>
  );
}

function Ticker() {
  const { t } = useI18n();
  return (
    <div className="dark-band overflow-hidden py-2">
      <div className="ticker-track">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0 items-center">
            {t.ticker.map((item) => (
              <span
                key={item}
                className="flex items-center gap-3 px-5 text-xs font-semibold uppercase tracking-[0.1em]"
              >
                <span className="size-1.5 rounded-full bg-gold" />
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Header({
  tab,
  label,
  onHome,
  onChange,
}: {
  tab: TabId;
  label: string;
  onHome: () => void;
  onChange: (t: TabId) => void;
}) {
  const { t } = useI18n();
  const isHome = tab === "home";
  return (
    <header className="sticky top-0 z-20 border-b border-border/15 bg-white px-5 py-3 shadow-sm backdrop-blur-xl md:px-8 md:py-4 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <button
          onClick={onHome}
          className="flex shrink-0 items-center gap-2.5"
          aria-label="CricLume"
        >
          <img
            src={logoAsset.url}
            alt="CricLume"
            className="h-10 w-auto md:h-12"
            width={1600}
            height={600}
          />
        </button>

        {/* Desktop / tablet nav */}
        <nav className="hidden md:flex md:items-center md:gap-1">
          {tabMeta
            .filter((m) => m.id !== "login")
            .map((m) => (
              <button
                key={m.id}
                onClick={() => onChange(m.id)}
                aria-current={tab === m.id ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === m.id
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.nav[m.key]}
              </button>
            ))}
          <LanguageSelect className="ml-2" />
          <button
            onClick={() => onChange("login")}
            className="brand-gradient glow ml-2 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Lock className="size-3.5" /> {t.nav.login}
          </button>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSelect />
          {!isHome && (
            <>
              <span className="font-display text-sm font-bold uppercase tracking-wide text-slate-500">
                {label}
              </span>
              <button
                onClick={onHome}
                className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition-colors hover:bg-slate-200"
                aria-label={t.backToHome}
              >
                <ArrowLeft className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return <div className="tab-enter">{children}</div>;
}

const fixtures = [
  {
    date: "Sat 12 Sep",
    time: "13:00",
    home: "Riverside CC",
    away: "Northgate CC",
    tag: "league" as const,
  },
  {
    date: "Sun 13 Sep",
    time: "11:30",
    home: "Ashford Academy",
    away: "Kings XI",
    tag: "academy" as const,
  },
  {
    date: "Wed 16 Sep",
    time: "18:00",
    home: "Old Mill CC",
    away: "Harbour CC",
    tag: "cup" as const,
  },
];

const leaderboard = [
  { pos: 1, name: "Riverside CC", played: 11, won: 9, pts: 36 },
  { pos: 2, name: "Northgate CC", played: 11, won: 7, pts: 30 },
  { pos: 3, name: "Old Mill CC", played: 10, won: 6, pts: 26 },
  { pos: 4, name: "Harbour CC", played: 11, won: 4, pts: 18 },
];

function HomeTab({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { t } = useI18n();
  const highlights = [0, 1, 6];

  return (
    <div className="space-y-10 md:space-y-16">
      <div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
        <section className="space-y-4 md:space-y-6">
          <h1 className="text-[2.8rem] font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-[5.2rem]">
            {t.hero.l1}
            <br />
            {t.hero.l2}
            <br />
            <span className="bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">
              {t.hero.l3}
            </span>
          </h1>

          <p className="text-sm leading-relaxed text-muted-foreground md:max-w-xl md:text-base">
            {t.hero.body}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button
              onClick={() => window.location.assign("/app")}
              className="brand-gradient glow inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.98]"
            >
              {t.hero.ctaPrimary} <ArrowRight className="size-4" />
            </button>
            <button
              onClick={() => onNavigate("screens")}
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-7 text-sm font-semibold text-foreground active:scale-[0.98]"
            >
              {t.hero.ctaSecondary}
            </button>
          </div>
        </section>

        <section className="surface-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-gold">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" /> {t.hero.liveNow}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Riverside CC 148/4
            </span>
          </div>
          <img
            src={shotScoreboard}
            alt={t.screensTab.items[1]!.caption}
            width={1600}
            height={1008}
            className="w-full"
          />
        </section>
      </div>

      <section className="grid grid-cols-3 gap-2 text-center md:gap-5">
        {t.stats.map((s) => (
          <div key={s.v} className="surface-card lift-card px-2 py-4 md:px-6 md:py-8">
            <p className="font-display text-2xl font-bold leading-none bg-gradient-to-br from-primary to-gold bg-clip-text text-transparent md:text-5xl">
              {s.k}
            </p>
            <p className="mt-1.5 text-xs leading-tight text-muted-foreground md:mt-3 md:text-sm">
              {s.v}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-4 md:space-y-6">
        <SectionHeader
          kicker={t.home.matchDayKicker}
          action={t.home.allFeatures}
          onAction={() => onNavigate("features")}
        >
          {t.home.matchDayTitle}
        </SectionHeader>
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-3">
          {highlights.map((i) => (
            <FeatureRow
              key={i}
              icon={featureIcons[i]!}
              title={t.features[i]!.title}
              body={t.features[i]!.body}
            />
          ))}
        </div>
      </section>

      {/* Fixtures + league table */}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <SectionHeader kicker={t.home.fixturesKicker}>{t.home.fixturesTitle}</SectionHeader>
          <div className="space-y-3">
            {fixtures.map((f) => (
              <article
                key={f.home + f.away}
                className="surface-card lift-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4"
              >
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-gold">
                    {t.home.tags[f.tag]}
                  </span>
                  <h3 className="truncate font-display text-lg font-bold leading-tight md:text-xl">
                    {f.home} <span className="text-muted-foreground">{t.home.vs}</span> {f.away}
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    {f.date} • {f.time}
                  </p>
                </div>
                <span className="skew-tag shrink-0 px-3 py-1.5 text-primary-foreground">
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {t.home.scoring}
                  </span>
                </span>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader kicker={t.home.seasonKicker}>{t.home.seasonTitle}</SectionHeader>
          <div className="surface-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="dark-band">
                <tr className="text-xs uppercase tracking-[0.1em]">
                  <th className="px-4 py-2.5 font-bold">{t.home.tablePos}</th>
                  <th className="px-2 py-2.5 font-bold">{t.home.tableClub}</th>
                  <th className="px-2 py-2.5 font-bold">{t.home.tableP}</th>
                  <th className="px-2 py-2.5 font-bold">{t.home.tableW}</th>
                  <th className="px-4 py-2.5 text-right font-bold">{t.home.tablePts}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r) => (
                  <tr key={r.name} className="border-t border-border/60">
                    <td className="px-4 py-3 font-display font-bold text-gold">{r.pos}</td>
                    <td className="px-2 py-3 font-semibold">{r.name}</td>
                    <td className="px-2 py-3 text-muted-foreground">{r.played}</td>
                    <td className="px-2 py-3 text-muted-foreground">{r.won}</td>
                    <td className="px-4 py-3 text-right font-display text-base font-bold">
                      {r.pts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">{t.home.standingsNote}</p>
        </div>
      </section>

      {/* Dark call-to-action band */}
      <section className="dark-band relative overflow-hidden rounded-2xl px-6 py-8 md:px-12 md:py-14">
        <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-gold">
              {t.home.ctaKicker}
            </span>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              {t.home.ctaTitle1}
              <br />
              {t.home.ctaTitle2}
            </h2>

            <p className="max-w-xl text-sm opacity-80 md:text-base">{t.home.ctaBody}</p>
          </div>
          <button
            onClick={() => window.location.assign("/app")}
            className="brand-gradient glow inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-bold uppercase tracking-wider text-primary-foreground"
          >
            {t.home.ctaButton} <ArrowRight className="size-4" />
          </button>
        </div>
      </section>

      {/* Trust strip */}
      <section className="space-y-4">
        <SectionHeader kicker={t.home.trustKicker}>{t.home.trustTitle}</SectionHeader>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {["Riverside CC", "Northgate CC", "Ashford Academy", "Harbour CC"].map((c) => (
            <div
              key={c}
              className="surface-card flex items-center justify-center px-3 py-5 text-center font-display text-sm font-bold uppercase tracking-wide text-muted-foreground"
            >
              {c}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  children,
  kicker,
  action,
  onAction,
}: {
  children: React.ReactNode;
  kicker?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-border/70 pb-3">
      <div className="min-w-0 space-y-1">
        {kicker && (
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-gold">{kicker}</span>
        )}
        <h2 className="rule-heading text-2xl font-bold leading-tight tracking-tight md:text-4xl">
          {children}
        </h2>
      </div>
      {action && onAction && (
        <button
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-[0.1em] text-gold hover:opacity-80"
        >
          {action} <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function SiteFooter({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { t } = useI18n();
  return (
    <footer className="mt-10 border-t border-border/15 bg-white px-5 pb-28 pt-10 md:mt-16 md:px-8 md:pb-12 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-3">
          <img
            src={fullLogoAsset.url}
            alt="CricLume"
            className="h-16 w-auto md:h-20"
            width={1600}
            height={640}
          />
          <p className="max-w-sm text-sm leading-relaxed text-slate-600">{t.footer.desc}</p>
          <LanguageSelect />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            {t.footer.explore}
          </p>
          {tabMeta.map((m) => (
            <button
              key={m.id}
              onClick={() => onNavigate(m.id)}
              className="block text-sm text-slate-600 hover:text-slate-900"
            >
              {t.nav[m.key]}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            {t.footer.access}
          </p>
          <p className="text-sm text-slate-600">{t.footer.accessLine1}</p>
          <p className="text-sm text-slate-600">{t.footer.accessLine2}</p>
          <button
            onClick={() => onNavigate("login")}
            className="brand-gradient mt-2 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold uppercase tracking-wider text-primary-foreground"
          >
            {t.footer.cta} <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mx-auto mt-8 w-full max-w-6xl border-t border-slate-200 pt-5 text-xs uppercase tracking-wide text-slate-500">
        <p>
          © {new Date().getFullYear()} {t.footer.copyright}
        </p>
        <p className="mt-1 text-[11px] normal-case tracking-normal text-slate-400">
          {t.footer.legal}
        </p>
        <div className="mt-3 flex gap-4 text-[11px] font-semibold normal-case tracking-normal">
          <Link to="/privacy" className="hover:text-slate-800">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-slate-800">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Home;
  title: string;
  body: string;
}) {
  return (
    <article className="surface-card lift-card group relative flex gap-3.5 p-4 md:flex-col md:gap-4 md:p-6">
      <span className="icon-tile flex size-11 shrink-0 items-center justify-center rounded-2xl text-primary-foreground md:size-12">
        <Icon className="size-5 md:size-6" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight md:text-lg">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground md:mt-2 md:text-sm">
          {body}
        </p>
      </div>
    </article>
  );
}

function FeaturesTab() {
  const { t } = useI18n();
  return (
    <div className="space-y-5 md:space-y-8">
      <SectionHeader kicker={t.featuresTab.kicker}>{t.featuresTab.title}</SectionHeader>
      <p className="text-sm text-muted-foreground md:text-base">{t.featuresTab.intro}</p>
      <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Built into this release:</strong> offline and
        cloud-ready ball-by-ball scoring, role-based club and league administration, realtime event
        sync, public scoreboards, camera-room capture, career history, competition tools and
        on-device coaching review. Paid, AI, video-processing and rain-rule services activate only
        after their secure providers are configured.
      </div>
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-3">
        {t.features.map((f, i) => (
          <FeatureRow key={f.title} icon={featureIcons[i]!} title={f.title} body={f.body} />
        ))}
      </div>
      <div className="surface-card space-y-4 p-4 md:p-7">
        <div className="flex items-center gap-2.5">
          <span className="icon-tile flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <Globe className="size-4.5" strokeWidth={2.2} />
          </span>
          <h3 className="text-[15px] font-semibold tracking-tight md:text-lg">
            {t.featuresTab.watchTitle}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">{t.featuresTab.watchBody}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {t.featuresTab.watchOptions.map((o) => (
            <div key={o.t} className="rounded-lg border border-border/60 p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Eye className="size-4 text-gold" strokeWidth={2.2} />
                {o.t}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{o.d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-card space-y-3 p-4 md:p-7">
        <div className="flex items-center gap-2.5">
          <span className="icon-tile flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <Shield className="size-4.5" strokeWidth={2.2} />
          </span>
          <h3 className="text-[15px] font-semibold tracking-tight md:text-lg">
            {t.featuresTab.alsoTitle}
          </h3>
        </div>
        <ul className="space-y-2.5 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-3 md:space-y-0">
          {t.featuresTab.alsoItems.map((i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {i}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ScreensTab() {
  const { t } = useI18n();
  return (
    <div className="space-y-5 md:space-y-8">
      <SectionHeader kicker={t.screensTab.kicker}>{t.screensTab.title}</SectionHeader>
      <p className="text-sm text-muted-foreground md:text-base">{t.screensTab.intro}</p>
      <div className="space-y-5 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {t.screensTab.items.map((s, i) => {
          const img = screenImages[i]!;
          return (
            <figure key={s.label} className="surface-card lift-card overflow-hidden">
              <div className="overflow-x-auto no-scrollbar border-b border-border/60 bg-secondary/40 md:overflow-hidden">
                <img
                  src={img.src}
                  alt={`${s.label} — ${s.caption}`}
                  width={img.w}
                  height={img.h}
                  loading="lazy"
                  className={
                    img.w > img.h
                      ? "h-auto w-[160%] max-w-none md:w-full"
                      : "h-auto w-full md:mx-auto md:max-w-xs"
                  }
                />
              </div>
              <figcaption className="space-y-1.5 p-4 md:p-6">
                <p className="font-display text-lg font-bold leading-tight text-gold md:text-2xl">
                  {s.label}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground md:text-sm">
                  {s.caption}
                </p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function PricingTab() {
  const { t } = useI18n();
  const [region, setRegion] = useState<Region>(defaultRegion);
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    let active = true;
    detectCountry().then((code) => {
      if (!active) return;
      const match = findRegion(code);
      if (match) setRegion(match);
      setDetected(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const priceFor = (i: number) =>
    i === 0 ? t.pricing.free : i === 1 ? region.clubPrice : t.pricing.custom;
  const periodFor = (i: number) => (i === 1 ? region.period : t.pricing.plans[i]!.period);

  return (
    <div className="space-y-8 md:space-y-12">
      <SectionHeader kicker={t.pricing.kicker}>{t.pricing.title}</SectionHeader>
      <p className="-mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        {t.pricing.intro} {region.note}
      </p>
      <p className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm leading-relaxed text-muted-foreground">
        These are pilot-plan targets, not an active public checkout. Stripe subscription and webhook
        support is built, but paid Club and League plans open only after the production account and
        pilot terms are activated.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {detected ? t.pricing.showing : t.pricing.detecting}
        </span>
        <select
          value={region.code}
          onChange={(e) => setRegion(findRegion(e.target.value) ?? defaultRegion)}
          className="h-10 rounded-full border border-border bg-secondary px-4 text-sm font-semibold text-foreground"
          aria-label={t.pricing.selectLabel}
        >
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.country} ({r.currency})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {t.pricing.plans.map((p, i) => {
          const Icon = planIcons[i]!;
          const featured = i === 1;
          return (
            <div
              key={p.name}
              className={`surface-card lift-card relative flex flex-col gap-4 p-5 md:p-6 ${featured ? "border-gold/50 ring-1 ring-gold/30" : ""}`}
            >
              {featured && (
                <span className="brand-gradient absolute -top-3 left-5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-foreground">
                  {t.pricing.mostPopular}
                </span>
              )}
              <div className="icon-tile flex size-11 items-center justify-center">
                <Icon className="size-5 text-gold" />
              </div>
              <div className="space-y-1">
                <p className="font-display text-xl font-bold tracking-tight">{p.name}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.blurb}</p>
              </div>
              <div className="flex items-end gap-2">
                <span className="font-display text-4xl font-bold leading-none">{priceFor(i)}</span>
                <span className="pb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {periodFor(i)}
                </span>
              </div>
              <div className="hairline h-px w-full" />
              <ul className="space-y-2">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm leading-relaxed">
                    <Check className="mt-0.5 size-4 shrink-0 text-gold" />
                    <span className="text-muted-foreground">{perk}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() =>
                  i === 2
                    ? window.location.assign(
                        "mailto:hello@criclume.com?subject=CricLume%20league%20pilot",
                      )
                    : window.location.assign("/app")
                }
                className={`mt-auto h-11 w-full rounded-full text-sm font-bold uppercase tracking-wider transition-transform active:scale-[0.98] ${featured ? "brand-gradient glow text-primary-foreground" : "border border-border bg-secondary text-foreground"}`}
              >
                {p.cta}
              </button>
            </div>
          );
        })}
      </div>

      <div className="space-y-4 md:space-y-6">
        <SectionHeader kicker={t.pricing.revenueKicker}>{t.pricing.revenueTitle}</SectionHeader>
        <div className="grid gap-3 md:grid-cols-2 md:gap-5">
          {t.pricing.revenue.map((r, i) => {
            const Icon = revenueIcons[i]!;
            return (
              <div key={r.title} className="surface-card flex gap-3 p-4 md:p-5">
                <div className="icon-tile flex size-10 shrink-0 items-center justify-center">
                  <Icon className="size-4.5 text-gold" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold tracking-tight">{r.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{t.pricing.footnote}</p>
    </div>
  );
}

function FaqTab() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-5 md:mx-auto md:max-w-3xl md:space-y-8">
      <SectionHeader kicker={t.faq.kicker}>{t.faq.title}</SectionHeader>
      <div className="space-y-2.5 md:space-y-3">
        {t.faq.items.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={f.q}
              className={`surface-card overflow-hidden transition-colors ${isOpen ? "border-gold/45" : ""}`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-[15px] font-semibold tracking-tight">{f.q}</span>
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full transition-all ${isOpen ? "bg-gold/15 text-gold rotate-180" : "bg-secondary text-muted-foreground"}`}
                >
                  <ChevronDown className="size-4" />
                </span>
              </button>
              {isOpen && (
                <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoginTab() {
  const { t } = useI18n();

  return (
    <div className="space-y-5 md:mx-auto md:max-w-md">
      <div className="space-y-2.5">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-gold">
          <Lock className="size-3" /> {t.login.badge}
        </span>
        <h2 className="text-3xl font-bold leading-tight tracking-tight">{t.login.title}</h2>

        <div className="hairline h-px w-16" />
        <p className="text-sm leading-relaxed text-muted-foreground">{t.login.body}</p>
      </div>

      <div className="surface-card space-y-3.5 p-5">
        <div className="rounded-2xl border border-gold/25 bg-gold/10 p-4">
          <p className="text-sm font-semibold text-foreground">Scoring preview available now</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Create a match and score ball by ball without an account. Match data stays on this
            device during the preview.
          </p>
        </div>
        <Link
          to="/app"
          className="brand-gradient glow flex h-12 w-full items-center justify-center rounded-full text-sm font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.98]"
        >
          {t.login.submit}
        </Link>
        <Link
          to="/platform"
          className="flex h-11 w-full items-center justify-center rounded-full border border-border text-sm font-bold text-foreground transition hover:border-gold/50"
        >
          Open cloud control centre
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          {t.login.noAccount}{" "}
          <a
            href="mailto:hello@criclume.com?subject=CricLume%20club%20pilot"
            className="font-semibold text-gold"
          >
            {t.login.requestInvite}
          </a>
        </p>
      </div>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        © {new Date().getFullYear()} {t.login.copyright}
      </p>
    </div>
  );
}

function BottomNav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  const { t } = useI18n();
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.08)] backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-6">
        {tabMeta.map(({ id, key, icon: Icon }) => {
          const active = tab === id;
          return (
            <li key={id}>
              <button
                onClick={() => onChange(id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  active ? "text-primary" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-xl transition-all ${
                    active ? "brand-gradient text-primary-foreground shadow-md" : "bg-transparent"
                  }`}
                >
                  <Icon className="size-[18px]" />
                </span>
                {t.nav[key]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
