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
} from "lucide-react";

import logo from "@/assets/wickentra-logo.png.asset.json";
import shotDashboard from "@/assets/shot-dashboard.jpg";
import shotScoreboard from "@/assets/shot-scoreboard.jpg";
import shotMobile from "@/assets/shot-mobile.jpg";
import shotReview from "@/assets/shot-review.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wickentra — Cricket Scoring, Cameras & Coaching Review" },
      {
        name: "description",
        content:
          "Wickentra is ball-by-ball cricket scoring with multi-angle camera rooms, live scoreboards and coaching review. Explore features, screens and FAQs, then sign in.",
      },
      { property: "og:title", content: "Wickentra — Every ball. Every angle. Every advantage." },
      {
        property: "og:description",
        content:
          "Ball-by-ball scoring, multi-phone camera rooms, live scoreboards and slow-motion coaching review for clubs and academies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Promo,
});

type TabId = "home" | "features" | "screens" | "faq" | "login";

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "features", label: "Features", icon: Layers },
  { id: "screens", label: "Screens", icon: Images },
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
    q: "Who is Wickentra for?",
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
    a: "Match data includes rain-method fields as an architectural foundation. Certified calculations arrive once the licensed resources are in place — we will not present unverified numbers as official.",
  },
  {
    q: "Where is video stored?",
    a: "Clips and annotations are stored against the match in your organisation's own space, with consent and privacy controls part of the launch roadmap.",
  },
  {
    q: "How do I get access?",
    a: "Wickentra is invite-only while clubs onboard in waves. Sign in below if you already have an account, or request access and we will place you in the next wave.",
  },
];

function Promo() {
  const [tab, setTab] = useState<TabId>("home");
  const activeTab = tabs.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border/60 md:max-w-none md:border-x-0">
        <Header tab={tab} label={activeTab.label} onHome={() => setTab("home")} onChange={setTab} />
        <main className="flex-1 overflow-y-auto px-5 pb-32 pt-4 md:mx-auto md:w-full md:max-w-6xl md:px-8 md:pb-20 md:pt-10 lg:px-12">
          <TabPanel key={tab}>
            {tab === "home" && <HomeTab onNavigate={setTab} />}
            {tab === "features" && <FeaturesTab />}
            {tab === "screens" && <ScreensTab />}
            {tab === "faq" && <FaqTab />}
            {tab === "login" && <LoginTab />}
          </TabPanel>
        </main>
        <BottomNav tab={tab} onChange={setTab} />
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
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-5 py-3 backdrop-blur-xl md:px-8 md:py-4 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <button onClick={onHome} className="shrink-0" aria-label="Wickentra home">
          <img src={logo.url} alt="Wickentra" className="h-9 w-auto md:h-11" width={192} height={68} />
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
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
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
            <span className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <button
              onClick={onHome}
              className="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
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


function HomeTab({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  return (
    <div className="space-y-7 md:space-y-14">
      <div className="grid gap-7 lg:grid-cols-2 lg:items-center lg:gap-12">
        <section className="space-y-4 md:space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-secondary/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            Invite-only beta
          </span>
          <h1 className="text-[2.6rem] font-bold uppercase leading-[0.95] md:text-6xl lg:text-7xl">
            Every ball.
            <br />
            Every angle.
            <br />
            <span className="bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">
              Every advantage.
            </span>
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground md:max-w-xl md:text-base">
            Wickentra turns a club match into a full record: ball-by-ball scoring, synced phone
            cameras at every angle, live scoreboards and a coaching review room the whole squad can
            learn from.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button
              onClick={() => onNavigate("login")}
              className="brand-gradient glow inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.98]"
            >
              Sign in to Wickentra <ArrowRight className="size-4" />
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
          <img
            src={shotScoreboard}
            alt="Wickentra live scoreboard showing score, batters, bowlers and over timeline"
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
            <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground md:mt-3 md:text-sm">
              {s.v}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3 md:space-y-6">
        <SectionTitle kicker="Match day">Built for match day</SectionTitle>

        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-3">
          {features.slice(0, 3).map((f) => (
            <FeatureRow key={f.title} {...f} />
          ))}
        </div>
        <button
          onClick={() => onNavigate("features")}
          className="inline-flex items-center gap-1 text-sm font-semibold text-gold"
        >
          All features <ArrowRight className="size-4" />
        </button>
      </section>

    </div>
  );
}

function SectionTitle({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="space-y-2">
      {kicker && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          {kicker}
        </span>
      )}
      <h2 className="text-3xl font-bold uppercase leading-none">{children}</h2>
      <div className="hairline h-px w-16" />
    </div>
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
    <article className="surface-card lift-card group relative flex gap-3.5 p-4">
      <span className="icon-tile flex size-11 shrink-0 items-center justify-center rounded-2xl text-primary-foreground">
        <Icon className="size-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}


function FeaturesTab() {
  return (
    <div className="space-y-5">
      <SectionTitle kicker="Platform">Features</SectionTitle>
      <p className="text-sm text-muted-foreground">
        Everything that ships in the current Wickentra build.
      </p>
      <div className="space-y-3">
        {features.map((f) => (
          <FeatureRow key={f.title} {...f} />
        ))}
      </div>
      <div className="surface-card space-y-3 p-4">
        <div className="flex items-center gap-2.5">
          <span className="icon-tile flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <Shield className="size-4.5" strokeWidth={2.2} />
          </span>
          <h3 className="text-[15px] font-semibold tracking-tight">Also included</h3>
        </div>
        <ul className="space-y-2.5">
          {[
            "Field zones, fielder selection and delivery timeline",
            "Undo on any ball, with a full audit of edits",
            "Voice notes and AI-audit presentation in review",
            "Competitions, innings and deliveries stored per club",
            "Demo match data so you can trial before onboarding",
          ].map((i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
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
    <div className="space-y-5">
      <SectionTitle kicker="Product tour">Screens</SectionTitle>
      <p className="text-sm text-muted-foreground">
        Dashboards, scoreboards, mobile scoring and the review room.
      </p>
      {screens.map((s) => (
        <figure key={s.label} className="surface-card lift-card overflow-hidden">
          <div className="overflow-x-auto no-scrollbar border-b border-border/60 bg-secondary/40">
            <img
              src={s.src}
              alt={`${s.label} — ${s.caption}`}
              width={s.w}
              height={s.h}
              loading="lazy"
              className={s.w > s.h ? "h-auto w-[160%] max-w-none" : "h-auto w-full"}
            />
          </div>
          <figcaption className="space-y-1.5 p-4">
            <p className="font-display text-lg font-bold uppercase leading-none text-gold">
              {s.label}
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{s.caption}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function FaqTab() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-5">
      <SectionTitle kicker="Answers">FAQs</SectionTitle>
      <div className="space-y-2.5">
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
                <p className="px-4 pb-4 text-[13px] leading-relaxed text-muted-foreground">{f.a}</p>
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
    <div className="space-y-5">
      <div className="space-y-2.5">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
          <Lock className="size-3" /> Gated access
        </span>
        <h2 className="text-3xl font-bold uppercase leading-none">Sign in</h2>
        <div className="hairline h-px w-16" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Wickentra is invite-only. Sign in to open the scoring platform, or request access for your
          club.
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
          <p className="text-center text-[13px] text-gold">
            Access is invite-only right now — we have logged your request and will be in touch.
          </p>
        )}
        <p className="text-center text-[12px] text-muted-foreground">
          No account yet?{" "}
          <span className="font-semibold text-gold">Request an invite for your club.</span>
        </p>
      </form>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        © {new Date().getFullYear()} Wickentra. Every ball. Every angle. Every advantage.
      </p>
    </div>
  );
}

function BottomNav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] nav-shadow backdrop-blur-xl">
      <ul className="grid grid-cols-5">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <li key={id}>
              <button
                onClick={() => onChange(id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  active ? "text-gold" : "text-muted-foreground hover:text-foreground"
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
