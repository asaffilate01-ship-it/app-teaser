import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
          "CricLume is ball-by-ball cricket scoring with multi-angle camera rooms, live scoreboards and coaching review. Explore features, screens and FAQs, then sign in.",
      },
      { property: "og:title", content: "CricLume — See every ball. Shape every game." },
      {
        property: "og:description",
        content:
          "Ball-by-ball scoring, multi-phone camera rooms, live scoreboards and slow-motion coaching review for clubs and academies.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { property: "og:image", content: "https://criclume.com/images/promo-hero.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://criclume.com/images/promo-hero.jpg" },
    ],
    links: [{ rel: "canonical", href: "/" }],

  }),
  component: Promo,
});

type TabId = "home" | "features" | "screens" | "pricing" | "faq" | "login";

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "features", label: "Features", icon: Layers },
  { id: "screens", label: "Screens", icon: Images },
  { id: "pricing", label: "Pricing", icon: Tag },
  { id: "faq", label: "FAQs", icon: HelpCircle },
  { id: "login", label: "Sign in", icon: Lock },
];

const features = [
  {
    icon: Zap,
    title: "Fast ball-by-ball scoring",
    body: "Runs, dots, wides, no-balls, byes, leg-byes, penalties and every dismissal type — with undo and timestamps on every delivery.",
  },
  {
    icon: Video,
    title: "Multi-phone camera room",
    body: "Pair phones at both ends and side-on — or add as many angles as the situation needs. One tap starts the room, angles stay linked to the ball they captured.",
  },
  {
    icon: Activity,
    title: "Coaching review",
    body: "Slow motion, frame stepping, angle switching, zoom, drawing tools and voice notes for post-match feedback.",
  },
  {
    icon: BarChart3,
    title: "Live scoreboards",
    body: "Broadcast-quality scoreboards with run rate, partnerships, fall of wickets and a rolling delivery timeline.",
  },
  {
    icon: Smartphone,
    title: "Desktop and mobile",
    body: "Score from a phone on the boundary or a laptop in the clubhouse — the same match, in sync.",
  },
  {
    icon: Users,
    title: "Clubs, teams and players",
    body: "Organisations, competitions, teams, players and grounds modelled from the ground up for season-long history.",
  },
  {
    icon: Eye,
    title: "Share live scoring",
    body: "Leagues and clubs choose who watches a match unfold in real time — the opposition club, followers, the league office, or a public link for supporters.",
  },
];


const screens = [
  {
    src: shotDashboard,
    w: 1600,
    h: 1008,
    label: "Club dashboard",
    caption: "Desktop • live, upcoming and completed matches with run-rate and wagon-wheel analytics",
  },
  {
    src: shotScoreboard,
    w: 1600,
    h: 1008,
    label: "Live scoreboard",
    caption: "Broadcast view • score, batters, bowlers, over timeline and fall of wickets",
  },
  {
    src: shotMobile,
    w: 768,
    h: 1408,
    label: "Mobile scoring",
    caption: "Phone • thumb-first scoring pad with extras, dismissals and recent deliveries",
  },
  {
    src: shotReview,
    w: 1600,
    h: 1008,
    label: "Coaching review",
    caption: "Desktop • four synced angles, frame-by-frame scrubbing and drawing tools",
  },
];

const faqs = [
  {
    q: "Who is CricLume for?",
    a: "Clubs, leagues, schools and academies that want proper ball-by-ball records and video they can actually coach from — without a broadcast budget.",
  },
  {
    q: "Do I need special cameras?",
    a: "No. The camera room pairs ordinary phones. Start with one at each end and one side-on, then add as many extra angles as you need — every recording is tied back to the delivery it captured.",
  },
  {
    q: "Can I score without signal?",
    a: "Scoring is built to keep working through patchy ground coverage and sync back up when the connection returns.",
  },
  {
    q: "Does it handle rain rules?",
    a: "Yes. CricLume applies standard rain rules to adjust targets and results when a match is interrupted.",
  },

  {
    q: "Where is video stored?",
    a: "Clips and annotations are stored against the match in your organisation's own space, with consent and privacy controls part of the launch roadmap.",
  },
  {
    q: "Can other clubs and the league watch our scoring live?",
    a: "Yes. Each match has a visibility setting: private to your club, shared with the opposition club, open to your league, or a public link anyone can follow. Leagues can also set a default for every fixture in a competition.",
  },
  {
    q: "How does CricLume make money?",
    a: "Clubs and leagues pay an annual subscription per team or competition, billed on the tier that matches how much scoring, video and analysis they use. Extra video storage, league-wide packages and sponsor-branded streams are paid add-ons.",
  },
  {
    q: "Is there a free option?",
    a: "Yes. Starter is free for a single team with ball-by-ball scoring, a live scoreboard and one camera angle per delivery. It is supported by light advertising on scoreboard and review pages. You only pay when you want more angles, longer video retention and club-wide analysis.",
  },
  {
    q: "How do I get access?",
    a: "Sign in if your club already has an account, or request an invite and we will get your club set up.",
  },

];


function Promo() {
  const [tab, setTab] = useState<TabId>("home");
  const activeTab = tabs.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border/60 md:max-w-none md:border-x-0">
        <Ticker />
        <Header tab={tab} label={activeTab.label} onHome={() => setTab("home")} onChange={setTab} />
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

const tickerItems = [
  "Live • Riverside CC 148/4 (18.2)",
  "4+ camera angles per delivery",
  "Coaching review • frame-by-frame",
  "Request an invite for your club",
  "Scoreboards ready for stream overlay",
];


function Ticker() {
  return (
    <div className="dark-band overflow-hidden py-2">
      <div className="ticker-track">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0 items-center">
            {tickerItems.map((t) => (
              <span
                key={t}
                className="flex items-center gap-3 px-5 text-xs font-semibold uppercase tracking-[0.1em]"
              >
                <span className="size-1.5 rounded-full bg-gold" />
                {t}
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
  const isHome = tab === "home";
  return (
    <header className="sticky top-0 z-20 border-b border-border/15 bg-white px-5 py-3 shadow-sm backdrop-blur-xl md:px-8 md:py-4 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <button onClick={onHome} className="flex shrink-0 items-center gap-2.5" aria-label="CricLume home">
          <img src={logoAsset.url} alt="CricLume" className="h-10 w-auto md:h-12" width={1600} height={600} />
        </button>

        {/* Desktop / tablet nav */}
        <nav className="hidden md:flex md:items-center md:gap-1">
          {tabs
            .filter((t) => t.id !== "login")
            .map((t) => (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          <button
            onClick={() => onChange("login")}
            className="brand-gradient glow ml-2 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Lock className="size-3.5" /> Sign in
          </button>
        </nav>

        {!isHome && (
          <div className="flex items-center gap-2 md:hidden">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-slate-500">
              {label}
            </span>
            <button
              onClick={onHome}
              className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition-colors hover:bg-slate-200"
              aria-label="Back to home"
            >
              <ArrowLeft className="size-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return <div className="tab-enter">{children}</div>;
}


const fixtures = [
  { date: "Sat 12 Sep", time: "13:00", home: "Riverside CC", away: "Northgate CC", tag: "League" },
  { date: "Sun 13 Sep", time: "11:30", home: "Ashford Academy", away: "Kings XI", tag: "Academy" },
  { date: "Wed 16 Sep", time: "18:00", home: "Old Mill CC", away: "Harbour CC", tag: "T20 Cup" },
];

const leaderboard = [
  { pos: 1, name: "Riverside CC", played: 11, won: 9, pts: 36 },
  { pos: 2, name: "Northgate CC", played: 11, won: 7, pts: 30 },
  { pos: 3, name: "Old Mill CC", played: 10, won: 6, pts: 26 },
  { pos: 4, name: "Harbour CC", played: 11, won: 4, pts: 18 },
];

function HomeTab({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  return (
    <div className="space-y-10 md:space-y-16">
      <div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
        <section className="space-y-4 md:space-y-6">
          <h1 className="text-[2.8rem] font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-[5.2rem]">
            Every ball.
            <br />
            Every angle.
            <br />
            <span className="bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">
              Every advantage.
            </span>
          </h1>

          <p className="text-sm leading-relaxed text-muted-foreground md:max-w-xl md:text-base">
            CricLume turns a club match into a full record: ball-by-ball scoring, synced phone
            cameras at every angle, live scoreboards and a coaching review room the whole squad can
            learn from.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button
              onClick={() => onNavigate("login")}
              className="brand-gradient glow inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.98]"
            >
              Sign in to CricLume <ArrowRight className="size-4" />
            </button>
            <button
              onClick={() => onNavigate("screens")}
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-7 text-sm font-semibold text-foreground active:scale-[0.98]"
            >
              See the screens
            </button>
          </div>
        </section>

        <section className="surface-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-gold">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Live now
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Riverside CC 148/4
            </span>
          </div>
          <img
            src={shotScoreboard}
            alt="CricLume live scoreboard showing score, batters, bowlers and over timeline"
            width={1600}
            height={1008}
            className="w-full"
          />
        </section>
      </div>

      <section className="grid grid-cols-3 gap-2 text-center md:gap-5">
        {[
          { k: "4+", v: "camera angles per ball" },
          { k: "<1s", v: "to log a delivery" },
          { k: "100%", v: "match history kept" },
        ].map((s) => (
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
        <SectionHeader kicker="Match day" action="All features" onAction={() => onNavigate("features")}>
          Built for match day
        </SectionHeader>
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-3">
          {features.filter((f) => f.title !== "Coaching review").slice(0, 2).concat(features.filter((f) => f.title === "Share live scoring")).map((f) => (
            <FeatureRow key={f.title} {...f} />
          ))}
        </div>

      </section>

      {/* Fixtures + league table, Kester-style two-column board */}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <SectionHeader kicker="Fixtures">Upcoming matches</SectionHeader>
          <div className="space-y-3">
            {fixtures.map((f) => (
              <article
                key={f.home + f.away}
                className="surface-card lift-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4"
              >
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-gold">
                    {f.tag}
                  </span>
                  <h3 className="truncate font-display text-lg font-bold leading-tight md:text-xl">
                    {f.home} <span className="text-muted-foreground">vs</span> {f.away}
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    {f.date} • {f.time}
                  </p>
                </div>
                <span className="skew-tag shrink-0 px-3 py-1.5 text-primary-foreground">
                  <span className="text-xs font-bold uppercase tracking-widest">Scoring</span>
                </span>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader kicker="Season">Club standings</SectionHeader>
          <div className="surface-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="dark-band">
                <tr className="text-xs uppercase tracking-[0.1em]">
                  <th className="px-4 py-2.5 font-bold">Pos</th>
                  <th className="px-2 py-2.5 font-bold">Club</th>
                  <th className="px-2 py-2.5 font-bold">P</th>
                  <th className="px-2 py-2.5 font-bold">W</th>
                  <th className="px-4 py-2.5 text-right font-bold">Pts</th>
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
          <p className="text-sm text-muted-foreground">
            Standings, run rates and player records build themselves from every ball you score.
          </p>
        </div>
      </section>

      {/* Dark call-to-action band */}
      <section className="dark-band relative overflow-hidden rounded-2xl px-6 py-8 md:px-12 md:py-14">
        <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-gold">
              Review room
            </span>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              Watch the match back,
              <br />
              ball by ball
            </h2>

            <p className="max-w-xl text-sm opacity-80 md:text-base">
              Every delivery links to its own synced angles — slow it down, step frames, draw on it
              and send voice notes to the squad before the next session.
            </p>
          </div>
          <button
            onClick={() => onNavigate("login")}
            className="brand-gradient glow inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-bold uppercase tracking-wider text-primary-foreground"
          >
            Get access <ArrowRight className="size-4" />
          </button>
        </div>
      </section>

      {/* Trust strip */}
      <section className="space-y-4">
        <SectionHeader kicker="Built with">Clubs, leagues and academies</SectionHeader>
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
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-gold">
            {kicker}
          </span>
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
  return (
    <footer className="mt-10 border-t border-border/15 bg-white px-5 pb-28 pt-10 md:mt-16 md:px-8 md:pb-12 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-3">
          <img src={fullLogoAsset.url} alt="CricLume" className="h-16 w-auto md:h-20" width={1600} height={640} />



          <p className="max-w-sm text-sm leading-relaxed text-slate-600">
            Ball-by-ball scoring, multi-angle camera rooms, live scoreboards and coaching review for
            clubs, leagues and academies.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Explore</p>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onNavigate(t.id)}
              className="block text-sm text-slate-600 hover:text-slate-900"
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Access</p>
          <p className="text-sm text-slate-600">By invitation for clubs</p>
          <p className="text-sm text-slate-600">Request access for your team</p>
          <button
            onClick={() => onNavigate("login")}
            className="brand-gradient mt-2 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold uppercase tracking-wider text-primary-foreground"
          >
            Request an invite <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mx-auto mt-8 w-full max-w-6xl border-t border-slate-200 pt-5 text-xs uppercase tracking-wide text-slate-500">
        <p>© {new Date().getFullYear()} CricLume — See every ball. Shape every game.</p>
        <p className="mt-1 text-[11px] normal-case tracking-normal text-slate-400">CricLume is a trading name of iTechLounge Ltd.</p>
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
  return (
    <div className="space-y-5 md:space-y-8">
      <SectionHeader kicker="Platform">Features</SectionHeader>
      <p className="text-sm text-muted-foreground md:text-base">
        Everything that ships in the current CricLume build.
      </p>
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-3">
        {features.map((f) => (
          <FeatureRow key={f.title} {...f} />
        ))}
      </div>
      <div className="surface-card space-y-4 p-4 md:p-7">
        <div className="flex items-center gap-2.5">
          <span className="icon-tile flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <Globe className="size-4.5" strokeWidth={2.2} />
          </span>
          <h3 className="text-[15px] font-semibold tracking-tight md:text-lg">Who can watch live</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Leagues set a default for a competition, clubs can override it per match — and change it mid-innings.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { t: "Club only", d: "Scorers, coaches and members of your own club." },
            { t: "Opposition club", d: "The other team's staff and players follow the same live feed." },
            { t: "League office", d: "Competition admins see every fixture live for results and compliance." },
            { t: "Public link", d: "Supporters and family follow the scoreboard in a browser — no account needed." },
          ].map((o) => (
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
          <h3 className="text-[15px] font-semibold tracking-tight md:text-lg">Also included</h3>
        </div>
        <ul className="space-y-2.5 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-3 md:space-y-0">

          {[
            "Field zones, fielder selection and delivery timeline",
            "Undo on any ball, with a full audit of edits",
            "Voice notes and AI-audit presentation in review",
            "Competitions, innings and deliveries stored per club",
            "Demo match data so you can trial before onboarding",
          ].map((i) => (
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
  return (
    <div className="space-y-5 md:space-y-8">
      <SectionHeader kicker="Product tour">Screens</SectionHeader>
      <p className="text-sm text-muted-foreground md:text-base">
        Dashboards, scoreboards, mobile scoring and the review room.
      </p>
      <div className="space-y-5 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {screens.map((s) => (
          <figure key={s.label} className="surface-card lift-card overflow-hidden">
            <div className="overflow-x-auto no-scrollbar border-b border-border/60 bg-secondary/40 md:overflow-hidden">
              <img
                src={s.src}
                alt={`${s.label} — ${s.caption}`}
                width={s.w}
                height={s.h}
                loading="lazy"
                className={
                  s.w > s.h
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
        ))}
      </div>
    </div>
  );
}



const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "one team",
    blurb: "Get a side scoring properly and sharing a live scoreboard.",
    icon: Zap,
    featured: false,
    perks: [
      "Ball-by-ball scoring for 1 team",
      "Live scoreboard + public match link",
      "1 camera angle per delivery",
      "7-day video retention",
      "Basic batting & bowling stats",
      "Light advertising on scoreboard and review pages",
    ],
    cta: "Start free",
  },
  {
    name: "Club",
    price: "£29",
    period: "per team / month",
    blurb: "The full match-day kit for clubs running several sides.",
    icon: Building2,
    featured: true,
    perks: [
      "Unlimited teams and fixtures",
      "Unlimited camera angles per delivery",
      "90-day video retention + clip export",
      "Coaching review with slow-motion tagging",
      "Share live scoring with opposition clubs",
      "Season-long club analytics",
    ],
    cta: "Request an invite",
  },
  {
    name: "League",
    price: "Custom",
    period: "per competition / season",
    blurb: "Competition-wide scoring, standings and governance.",
    icon: Trophy,
    featured: false,
    perks: [
      "Every club in the competition included",
      "League standings, results and admin console",
      "Default visibility rules across fixtures",
      "12-month video retention",
      "Sponsor branding on live streams",
      "Data export and priority support",
    ],
    cta: "Talk to us",
  },
];

const revenueLines = [
  { icon: Tag, title: "Subscriptions", body: "Recurring club and league plans are the core of the business — billed monthly or annually per team, with two months free on annual." },
  { icon: Video, title: "Video & storage add-ons", body: "Extra retention, 4K clips and bulk season archives are priced on top of the base tier." },
  { icon: Globe, title: "Sponsorship & streams", body: "Leagues can sell branded overlays and sponsored public match links; CricLume takes a share of the placement." },
  { icon: Users, title: "Services", body: "Onboarding, historic data migration and bespoke reporting for larger leagues and academies." },
];

function PricingTab() {
  return (
    <div className="space-y-8 md:space-y-12">
      <SectionHeader kicker="Plans">Pricing & subscriptions</SectionHeader>
      <p className="-mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Start free with one team. Move to a club or league subscription when you want more angles,
        longer video retention and competition-wide control. Prices exclude VAT.
      </p>

      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`surface-card lift-card relative flex flex-col gap-4 p-5 md:p-6 ${p.featured ? "border-gold/50 ring-1 ring-gold/30" : ""}`}
          >
            {p.featured && (
              <span className="brand-gradient absolute -top-3 left-5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-foreground">
                Most popular
              </span>
            )}
            <div className="icon-tile flex size-11 items-center justify-center">
              <p.icon className="size-5 text-gold" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-xl font-bold tracking-tight">{p.name}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.blurb}</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="font-display text-4xl font-bold leading-none">{p.price}</span>
              <span className="pb-1 text-xs uppercase tracking-wide text-muted-foreground">{p.period}</span>
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
              className={`mt-auto h-11 w-full rounded-full text-sm font-bold uppercase tracking-wider transition-transform active:scale-[0.98] ${p.featured ? "brand-gradient glow text-primary-foreground" : "border border-border bg-secondary text-foreground"}`}
            >
              {p.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-4 md:space-y-6">
        <SectionHeader kicker="Business model">How CricLume makes money</SectionHeader>
        <div className="grid gap-3 md:grid-cols-2 md:gap-5">
          {revenueLines.map((r) => (
            <div key={r.title} className="surface-card flex gap-3 p-4 md:p-5">
              <div className="icon-tile flex size-10 shrink-0 items-center justify-center">
                <r.icon className="size-4.5 text-gold" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold tracking-tight">{r.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Annual billing saves two months on every paid tier. Schools and junior sections get 50% off the
        Club plan.
      </p>
    </div>
  );
}

function FaqTab() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-5 md:mx-auto md:max-w-3xl md:space-y-8">
      <SectionHeader kicker="Answers">FAQs</SectionHeader>
      <div className="space-y-2.5 md:space-y-3">

        {faqs.map((f, i) => {
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
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-5 md:mx-auto md:max-w-md">
      <div className="space-y-2.5">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-gold">
          <Lock className="size-3" /> Gated access
        </span>
        <h2 className="text-3xl font-bold leading-tight tracking-tight">Sign in</h2>

        <div className="hairline h-px w-16" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sign in to open the scoring platform, or request an invite for your club.
        </p>

      </div>

      <form
        className="surface-card space-y-3.5 p-5"

        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Club email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@club.com"
            className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-gold"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Password
          </span>
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-gold"
          />
        </label>
        <button
          type="submit"
          className="brand-gradient glow h-12 w-full rounded-full text-sm font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.98]"
        >
          Enter the platform
        </button>
        {sent && (
          <p className="text-center text-sm text-gold">
            Thanks — we have logged your request and will be in touch.
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <span className="font-semibold text-gold">Request an invite for your club.</span>
        </p>
      </form>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        © {new Date().getFullYear()} CricLume. See every ball. Shape every game.
      </p>
    </div>
  );
}

function BottomNav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.08)] backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-6">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <li key={id}>
              <button
                onClick={() => onChange(id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
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
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
