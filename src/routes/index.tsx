import { readSection, publicSections } from "@/lib/navigation";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  regions,
  defaultRegion,
  findRegion,
  pricingRegionFor,
  browserLocales,
  type Region,
} from "@/lib/pricing";
import { getVisitorCountry } from "@/lib/visitor-country.functions";
import { I18nProvider, useI18n, LanguageSelect } from "@/lib/i18n";
import type { Content } from "@/lib/content";
import {
  Activity,
  ChevronDown,
  Video,
  BarChart3,
  Shield,
  Zap,
  Home,
  Layers,
  Images,
  HelpCircle,
  Play,
  ArrowRight,
  Check,
  Eye,
  Globe,
  Tag,
  Building2,
  Trophy,
  Minus,
  Plus,
  BellRing,
  WifiOff,
  UsersRound,
  Gauge,
  MonitorPlay,
  Radio,
  Gavel,
  Award,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  planOrder,
  featureOrder,
  planFeatures,
  adRevenueSharePercent,
  type FeatureAccess,
} from "@/lib/plans";

import logoAsset from "@/assets/criclume-logo-header.png.asset.json";
import fullLogoAsset from "@/assets/criclume-logo-full.png.asset.json";
import shotGroundScore from "@/assets/shot-ground-score.webp";
import shotGroundChase from "@/assets/shot-ground-chase.webp";
import shotMatchCentre from "@/assets/shot-match-centre.webp";
import shotClubDashboard from "@/assets/shot-club-dashboard.webp";
import shotPhoneScoring from "@/assets/shot-phone-scoring.webp";
import shotPhoneScorecard from "@/assets/shot-phone-scorecard.webp";
import shotPhoneCommentary from "@/assets/shot-phone-commentary.webp";
import shotReview from "@/assets/shot-review.jpg";
import shotLeagueStats from "@/assets/shot-league-stats.jpg";
import shotLeagueLive from "@/assets/shot-league-live.jpg";
import shotLiveTable from "@/assets/shot-live-table.jpg";
import { HeroShowcase, ScreensGallery, type ScreenShot } from "@/components/promo/ScreenShowcase";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { section?: TabId } => {
    const section = readSection(search["section"], publicSections);
    return { section: section ?? "home" };
  },
  head: () => ({
    meta: [
      { title: "CricLume — See every ball. Shape every game." },
      {
        name: "description",
        content:
          "Free offline cricket scoring with safe sync, split scoring duties, live scores and alerts for fans, ground big screens, league hubs, club office, umpires, club websites and up to 16 phone cameras. Club, League and video plans.",
      },
      { property: "og:title", content: "CricLume — See every ball. Shape every game." },
      {
        property: "og:description",
        content:
          "Ball-by-ball scoring, multi-angle phone video and live scores for cricket clubs and leagues.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://criclume.com/" },
      {
        property: "og:image",
        content: `https://criclume.com${fullLogoAsset.url}`,
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: `https://criclume.com${fullLogoAsset.url}`,
      },
    ],
    links: [{ rel: "canonical", href: "https://criclume.com/" }],
  }),
  component: HomepageRoot,
});

type TabId = "home" | "features" | "screens" | "pricing" | "faq" | "login";

const tabMeta: { id: TabId; icon: typeof Home; key: keyof Content["nav"] }[] = [
  { id: "home", icon: Home, key: "home" },
  { id: "features", icon: Layers, key: "features" },
  { id: "screens", icon: Images, key: "screens" },
  { id: "pricing", icon: Tag, key: "pricing" },
  { id: "faq", icon: HelpCircle, key: "faq" },
  { id: "login", icon: Play, key: "login" },
];

const featureIcons = [
  Zap,
  Video,
  BellRing,
  WifiOff,
  UsersRound,
  Activity,
  BarChart3,
  Gauge,
  MonitorPlay,
  Radio,
  Trophy,
  Building2,
  Gavel,
  Award,
  Globe,
];
const workflowIcons = [Zap, BellRing, Building2];
/** Same order as t.screensTab.items. Real CricLume screens captured from a sample club match. */
const screenShots: ScreenShot[] = [
  { src: shotGroundScore, w: 1600, h: 900, kind: "tv", cat: "screens" },
  {
    src: shotMatchCentre,
    w: 1600,
    h: 1000,
    kind: "desktop",
    cat: "scoring",
    url: "criclume.com/app",
  },
  { src: shotPhoneScoring, w: 860, h: 1864, kind: "phone", cat: "scoring" },
  {
    src: shotClubDashboard,
    w: 1600,
    h: 1000,
    kind: "desktop",
    cat: "analysis",
    url: "criclume.com/platform",
  },
  { src: shotGroundChase, w: 1600, h: 900, kind: "tv", cat: "screens" },
  { src: shotPhoneCommentary, w: 860, h: 1864, kind: "phone", cat: "scoring" },
  { src: shotPhoneScorecard, w: 860, h: 1864, kind: "phone", cat: "scoring" },
  {
    src: shotReview,
    w: 1600,
    h: 1008,
    kind: "desktop",
    cat: "analysis",
    url: "criclume.com/app · video lab",
  },
  {
    src: shotLeagueStats,
    w: 1600,
    h: 1008,
    kind: "desktop",
    cat: "league",
    url: "criclume.com/platform · league hub",
  },
  { src: shotLeagueLive, w: 768, h: 1408, kind: "phone", cat: "league" },
  { src: shotLiveTable, w: 768, h: 1408, kind: "phone", cat: "league" },
];
const planIcons = [Zap, Building2, Trophy];

function HomepageRoot() {
  return (
    <I18nProvider>
      <Homepage />
    </I18nProvider>
  );
}

function useVisitorRegion() {
  const [region, setRegion] = useState<Region>(defaultRegion);
  const [detected, setDetected] = useState(false);
  useEffect(() => {
    let active = true;
    getVisitorCountry()
      .then((result) => result.country)
      .catch(() => null)
      .then((country) => {
        if (!active) return;
        setRegion(pricingRegionFor(country, browserLocales()));
        setDetected(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return { region, setRegion, detected };
}

type RegionState = ReturnType<typeof useVisitorRegion>;

function Homepage() {
  const tab = Route.useSearch().section ?? "home";
  const regionState = useVisitorRegion();
  const navigate = Route.useNavigate();
  const focusSection = (section: TabId) => {
    const target = document.getElementById(`home-${section}`);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start" });
  };
  const setTab = (section: TabId) => {
    if (section === tab) focusSection(section);
    else void navigate({ search: { section }, resetScroll: false });
  };
  useEffect(() => {
    if (tab !== "home") focusSection(tab);
    else if (window.location.search) focusSection("home");
  }, [tab]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border/60 md:max-w-none md:border-x-0">
        <Header tab={tab} onHome={() => setTab("home")} onChange={setTab} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-5 pb-24 pt-5 md:mx-auto md:w-full md:max-w-6xl md:px-8 md:pb-16 md:pt-12 lg:px-12"
        >
          <div className="space-y-16 md:space-y-24">
            <section id="home-home" tabIndex={-1} className="scroll-mt-28">
              <HomeTab onNavigate={setTab} region={regionState.region} />
            </section>
            <section id="home-features" tabIndex={-1} className="scroll-mt-28">
              <FeaturesTab />
            </section>
            <section id="home-screens" tabIndex={-1} className="scroll-mt-28">
              <ScreensTab />
            </section>
            <section id="home-pricing" tabIndex={-1} className="scroll-mt-28">
              <PricingTab regionState={regionState} />
            </section>
            <section id="home-faq" tabIndex={-1} className="scroll-mt-28">
              <FaqTab />
            </section>
            <section id="home-login" tabIndex={-1} className="scroll-mt-28">
              <GetStarted />
            </section>
          </div>
        </main>
        <SiteFooter onNavigate={setTab} />
        <BottomNav tab={tab} onChange={setTab} />
      </div>
    </div>
  );
}

function Header({
  tab,
  onHome,
  onChange,
}: {
  tab: TabId;
  onHome: () => void;
  onChange: (t: TabId) => void;
}) {
  const { t } = useI18n();
  return (
    <header className="keep-palette sticky top-0 z-20 border-b border-border/15 bg-white px-5 py-3 shadow-sm backdrop-blur-xl md:px-8 md:py-4 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <button
          onClick={onHome}
          className="flex shrink-0 items-center gap-2.5"
          aria-label="CricLume"
        >
          <img
            src={logoAsset.url}
            alt="CricLume"
            className="h-10 w-auto lg:h-12"
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
                className={`rounded-full px-2.5 py-2 text-sm font-semibold transition-colors lg:px-4 ${
                  tab === m.id
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.nav[m.key]}
              </button>
            ))}
          <Link
            to="/live"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 lg:px-4"
          >
            <span className="live-dot" aria-hidden="true" />
            {t.nav.liveScores}
          </Link>
          <LanguageSelect className="ml-1 lg:ml-2" />
          <ThemeToggle
            className="theme-toggle-light-chrome ml-1"
            labels={{ toLight: t.nav.themeLight, toDark: t.nav.themeDark }}
          />
          <button
            onClick={() => onChange("login")}
            aria-label={t.nav.login}
            className="brand-gradient glow ml-1 inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground lg:ml-2 lg:px-5"
          >
            <Play className="size-3.5" /> <span className="hidden lg:inline">{t.nav.login}</span>
          </button>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/live"
            aria-label={t.nav.liveScores}
            title={t.nav.liveScores}
            className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 px-2.5 text-xs font-bold uppercase tracking-wide text-slate-700 min-[440px]:px-3"
          >
            <span className="live-dot" aria-hidden="true" />
            <span className="hidden min-[440px]:inline">{t.nav.liveScores}</span>
          </Link>
          <ThemeToggle
            className="theme-toggle-light-chrome"
            labels={{ toLight: t.nav.themeLight, toDark: t.nav.themeDark }}
          />
          <LanguageSelect />
        </div>
      </div>
    </header>
  );
}

function HomeTab({ onNavigate, region }: { onNavigate: (t: TabId) => void; region: Region }) {
  const { t } = useI18n();
  const highlights = [3, 2, 4, 1, 8, 10];
  const heroPlans = [
    {
      name: t.pricing.plans[0]!.name,
      price: t.pricing.free,
      period: t.pricing.plans[0]!.period,
      icon: Zap,
    },
    {
      name: t.pricing.plans[1]!.name,
      price: region.clubPrice,
      period: region.period,
      icon: Building2,
      featured: true,
    },
    {
      name: t.pricing.plans[2]!.name,
      price: region.leaguePrice ?? t.pricing.custom,
      period: region.leaguePeriod ?? t.pricing.plans[2]!.period,
      icon: Trophy,
    },
    {
      name: t.hero.addonName,
      price: region.addonPrice ? `+${region.addonPrice}` : t.pricing.addon.price,
      period: region.addonPrice ? "per team / year" : t.pricing.addon.period,
      icon: Video,
    },
  ];

  return (
    <div className="space-y-10 md:space-y-16">
      <div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
        <section className="min-w-0 space-y-4 md:space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden />
            {t.hero.kicker}
          </p>
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

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {t.hero.featuresLabel}
            </p>
            <ul className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {t.hero.features.map((f) => (
                <li
                  key={f}
                  className="flex shrink-0 snap-start items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
                >
                  <Check className="size-3.5 text-gold" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-label={t.hero.previewLabel} className="min-w-0 lg:-mr-8 xl:-mr-16">
          <HeroShowcase
            desktop={screenShots[1]!}
            phone={screenShots[2]!}
            desktopAlt={`${t.screensTab.items[1]!.label} — ${t.screensTab.items[1]!.caption}`}
            phoneAlt={`${t.screensTab.items[2]!.label} — ${t.screensTab.items[2]!.caption}`}
            chips={t.screensTab.chips}
          />
        </section>
      </div>

      <section aria-labelledby="hero-plans" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2
            id="hero-plans"
            className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {t.hero.plansLabel}
          </h2>
          <button
            onClick={() => onNavigate("pricing")}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gold"
          >
            {t.hero.plansCta} <ArrowRight className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
          {heroPlans.map((plan, i) => {
            const Icon = plan.icon;
            return (
              <button
                key={plan.name}
                onClick={() => onNavigate("pricing")}
                className={`surface-card lift-card flex flex-col items-start gap-2 p-3 text-left md:p-5 ${plan.featured ? "border-gold/50 ring-1 ring-gold/30" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className="icon-tile flex size-8 items-center justify-center md:size-9">
                    <Icon className="size-4 text-gold" aria-hidden />
                  </span>
                  <span className="font-display text-base font-bold tracking-tight md:text-lg">
                    {plan.name}
                  </span>
                </span>
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-display text-xl font-bold leading-none md:text-2xl">
                    {plan.price}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground md:text-[11px]">
                    {plan.period}
                  </span>
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {t.hero.planNotes[i]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center md:gap-5">
        {t.stats.map((s) => (
          <div key={s.v} className="surface-card lift-card px-2 py-4 md:px-6 md:py-8">
            <p className="font-display break-words text-base font-bold leading-tight bg-gradient-to-br from-primary to-gold bg-clip-text text-transparent sm:text-xl md:text-3xl">
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

      {/* Guide visitors through real, clearly scoped workflows. */}
      <section className="space-y-4 md:space-y-6">
        <SectionHeader kicker={t.home.workflowKicker}>{t.home.workflowTitle}</SectionHeader>
        <div className="space-y-3 md:grid md:grid-cols-3 md:gap-5 md:space-y-0">
          {t.home.workflowSteps.map((step, i) => (
            <FeatureRow
              key={step.title}
              icon={workflowIcons[i]!}
              title={step.title}
              body={step.body}
            />
          ))}
        </div>
        <Link
          to="/platform"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/50 px-5 py-3 text-sm font-bold text-gold hover:bg-gold/10"
        >
          {t.login.requestInvite} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
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
    <footer className="keep-palette mt-10 border-t border-border/15 bg-white px-5 pb-28 pt-10 md:mt-16 md:px-8 md:pb-12 lg:px-12">
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
          <Link
            to="/app"
            className="brand-gradient mt-2 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold uppercase tracking-wider text-primary-foreground"
          >
            {t.footer.cta} <ArrowRight className="size-3.5" />
          </Link>
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
      <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{t.screensTab.intro}</p>
      <ScreensGallery
        shots={screenShots}
        items={t.screensTab.items}
        filters={t.screensTab.filters}
        enlarge={t.screensTab.enlarge}
        close={t.screensTab.close}
        cta={
          <a
            href="/app"
            className="showcase-card brand-gradient glow h-full justify-between gap-6 p-5 text-primary-foreground md:p-7"
          >
            <span className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] opacity-80">
                {t.screensTab.chips[1]}
              </span>
              <span className="block font-display text-2xl font-bold leading-tight md:text-3xl">
                {t.hero.ctaPrimary}
              </span>
            </span>
            <span className="inline-flex size-11 items-center justify-center rounded-full border border-current/30">
              <ArrowRight className="size-5" aria-hidden="true" />
            </span>
          </a>
        }
      />
    </div>
  );
}

function PricingTab({ regionState }: { regionState: RegionState }) {
  const { t } = useI18n();
  const { region, setRegion, detected } = regionState;

  const priceFor = (i: number) =>
    i === 0
      ? t.pricing.free
      : i === 1
        ? region.clubPrice
        : (region.leaguePrice ?? t.pricing.custom);
  const periodFor = (i: number) =>
    i === 1
      ? region.period
      : i === 2 && region.leaguePeriod
        ? region.leaguePeriod
        : t.pricing.plans[i]!.period;

  return (
    <div className="space-y-8 md:space-y-12">
      <SectionHeader kicker={t.pricing.kicker}>{t.pricing.title}</SectionHeader>
      <p className="-mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        {t.pricing.intro} {region.note}
      </p>
      <p className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm leading-relaxed text-muted-foreground">
        {t.pricing.pilotNotice}
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
              {i === 2 && region.leagueNote && (
                <p className="rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {region.leagueNote}
                </p>
              )}
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
                onClick={() => {
                  if (i === 0) {
                    window.location.assign("/app");
                    return;
                  }
                  window.location.assign(
                    i === 1
                      ? "mailto:hello@criclume.com?subject=CricLume%20Club%20pilot"
                      : "mailto:hello@criclume.com?subject=CricLume%20League%20pilot",
                  );
                }}
                className={`mt-auto h-11 w-full rounded-full text-sm font-bold uppercase tracking-wider transition-transform active:scale-[0.98] ${featured ? "brand-gradient glow text-primary-foreground" : "border border-border bg-secondary text-foreground"}`}
              >
                {p.cta}
              </button>
            </div>
          );
        })}
      </div>

      <div className="surface-card relative grid gap-6 border-gold/40 p-5 md:grid-cols-[1fr_1.4fr] md:p-8">
        <div className="flex flex-col gap-4">
          <span className="w-fit rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gold">
            {t.pricing.addon.badge}
          </span>
          <div className="flex items-center gap-3">
            <div className="icon-tile flex size-11 shrink-0 items-center justify-center">
              <Video className="size-5 text-gold" />
            </div>
            <p className="font-display text-2xl font-bold tracking-tight">{t.pricing.addon.name}</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t.pricing.addon.blurb}</p>
          <div className="flex items-end gap-2">
            <Plus className="mb-1 size-5 text-gold" strokeWidth={3} />
            <span className="font-display text-3xl font-bold leading-none">
              {region.addonPrice ?? t.pricing.addon.price}
            </span>
            <span className="pb-1 text-xs uppercase tracking-wide text-muted-foreground">
              {region.addonPeriod ?? t.pricing.addon.period}
            </span>
          </div>
          <button
            onClick={() =>
              window.location.assign("mailto:hello@criclume.com?subject=CricLume%20video%20add-on")
            }
            className="mt-auto h-11 w-full rounded-full border border-border bg-secondary text-sm font-bold uppercase tracking-wider text-foreground transition-transform active:scale-[0.98] md:w-auto md:px-8"
          >
            {t.pricing.addon.cta}
          </button>
        </div>
        <ul className="grid content-start gap-3 sm:grid-cols-2">
          {t.pricing.addon.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm leading-relaxed">
              <Check className="mt-0.5 size-4 shrink-0 text-gold" />
              <span className="text-muted-foreground">{perk}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="surface-card overflow-hidden">
        <p className="px-5 pt-5 font-display text-xl font-bold tracking-tight md:px-6">
          {t.pricing.compare.title}
        </p>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-3 pl-4 pr-2 font-semibold sm:px-5 md:px-6">
                  {t.pricing.compare.plan}
                </th>
                {planOrder.map((plan, i) => (
                  <th key={plan} className="px-1 py-3 text-center font-semibold sm:px-3">
                    {t.pricing.plans[i]!.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureOrder.map((feature, row) => (
                <tr key={feature} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pl-4 pr-2 font-semibold text-foreground sm:px-5 md:px-6">
                    {t.pricing.compare.rows[row]}
                  </td>
                  {planOrder.map((plan) => (
                    <td key={plan} className="px-1 py-3 text-center sm:px-3">
                      <AccessMark access={planFeatures[plan][feature]} labels={t.pricing.compare} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-border/60 last:border-0">
                <td className="py-3 pl-4 pr-2 font-semibold text-foreground sm:px-5 md:px-6">
                  {t.pricing.compare.shareRow}
                </td>
                {planOrder.map((plan) => {
                  const base = adRevenueSharePercent(plan);
                  const withVideo = adRevenueSharePercent(plan, { videoAddon: true });
                  return (
                    <td key={plan} className="px-1 py-3 text-center sm:px-3">
                      <span className="font-display text-base font-bold text-foreground">
                        {base}%
                      </span>
                      {withVideo !== base && (
                        <span className="block text-[11px] leading-tight text-muted-foreground">
                          {t.pricing.compare.shareWithVideo}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{t.pricing.footnote}</p>
    </div>
  );
}

function AccessMark({
  access,
  labels,
}: {
  access: FeatureAccess;
  labels: Content["pricing"]["compare"];
}) {
  if (access === "included")
    return (
      <span className="inline-flex items-center justify-center" title={labels.included}>
        <Check className="size-5 text-gold" strokeWidth={3} aria-hidden />
        <span className="sr-only">{labels.included}</span>
      </span>
    );
  if (access === "addon")
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px] font-bold uppercase tracking-wide text-gold">
        <Plus className="size-3" strokeWidth={3} aria-hidden />
        {labels.addon}
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center" title={labels.notIncluded}>
      <Minus className="size-5 text-muted-foreground/60" aria-hidden />
      <span className="sr-only">{labels.notIncluded}</span>
    </span>
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

function GetStarted() {
  const { t } = useI18n();

  return (
    <div className="space-y-5 md:mx-auto md:max-w-md">
      <div className="space-y-2.5">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-gold">
          <Play className="size-3" /> {t.login.badge}
        </span>
        <h2 className="text-3xl font-bold leading-tight tracking-tight">{t.login.title}</h2>

        <div className="hairline h-px w-16" />
        <p className="text-sm leading-relaxed text-muted-foreground">{t.login.body}</p>
      </div>

      <div className="surface-card space-y-3.5 p-5">
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
          {t.login.requestInvite}
        </Link>
        <p className="text-center text-sm text-muted-foreground">{t.login.noAccount}</p>
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
    <nav
      aria-label="Primary navigation"
      className="keep-palette fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.08)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabMeta
          .filter((item) => item.id !== "screens")
          .map(({ id, key, icon: Icon }) => {
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
