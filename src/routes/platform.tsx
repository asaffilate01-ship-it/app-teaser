import {
  readOrganisationDraft,
  storeOrganisationDraft,
  type OrganisationDraft,
} from "@/lib/onboarding-request";
import { SectionNavigation } from "@/components/SectionNavigation";
import { readLimitedOvers, validateCloudMatchSetup } from "@/lib/match-setup";
import { fixtureCalendarIcs } from "@/lib/fixture-calendar";
import { reviewFixtureSchedule } from "@/lib/fixture-scheduling";
import { FixtureBuilder } from "@/components/league/FixtureBuilder";
import { readSection, platformSections } from "@/lib/navigation";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  Copy,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  Database,
  ExternalLink,
  FileCheck2,
  Gauge,
  Briefcase,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  UserRoundCheck,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { GoogleButton } from "@/components/app-shell/GoogleButton";
import { SetupChecklist } from "@/components/SetupChecklist";
import { ClubMatchInsights } from "@/components/club/ClubMatchInsights";
import { TeamCrest } from "@/components/scorer/Broadcast";
import scoreboardShot from "@/assets/shot-scoreboard.jpg";
import { IntegrationReadinessPanel } from "@/components/IntegrationReadinessPanel";
import { CricketAnalysisWorkspace } from "@/components/CricketAnalysisWorkspace";
import { AcademyDashboard } from "@/components/AcademyDashboard";
import { LeagueStandings } from "@/components/LeagueStandings";
import { LeagueHub } from "@/components/league/LeagueHub";
import { SquadImport } from "@/components/club/SquadImport";
import { MatchDayPosts } from "@/components/league/MatchDayPosts";
import { StreamGuide } from "@/components/club/StreamGuide";
import { toast } from "sonner";
import { ClubOffice } from "@/components/office/ClubOffice";
import { rainMethods } from "@/lib/rain-rules";
import { OmniqoraIntelligencePanel } from "@/components/OmniqoraIntelligencePanel";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { usePlatformDashboard } from "@/hooks/use-platform-dashboard";
import { getCloudClient, listOrganisationMemberships, type OrganisationMembership } from "@/lib/cloud";
import {
  createCameraRoom,
  setCameraRoomCapacity,
  removeCameraDevice,
  createCheckout,
  openBillingPortal,
  createCompetition,
  createFixture,
  createGround,
  createMatchWorkspace,
  createOrganisation,
  createPlayer,
  createTeam,
  inviteMember,
  updateMember,
  recordPlayerConsent,
  setPublicScoreboard,
  type CompetitionRecord,
  type ConsentState,
  type MatchRecord,
  type PlatformDashboardData,
} from "@/lib/platform-cloud";
import { assignableRoles, can, platformRoles, roleLabels, type PlatformRole } from "@/lib/platform";

export const Route = createFileRoute("/platform")({
  validateSearch: (search: Record<string, unknown>): { section?: PlatformTab } => {
    const section = readSection(search["section"], platformSections);
    return { section: section ?? "overview" };
  },
  head: () => ({
    meta: [
      { title: "CricLume Cloud — Club and competition control centre" },
      {
        name: "description",
        content:
          "Manage cricket organisations, competitions, live scoring, cameras, player histories and safeguarding.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Platform,
});

type PlatformTab =
  | "overview"
  | "office"
  | "competitions"
  | "league"
  | "capture"
  | "players"
  | "academy"
  | "safety"
  | "analysis"
  | "intelligence"
  | "operations";
type RunAction = <T>(action: () => Promise<T>) => Promise<T>;

const tabDefinitions: Array<[PlatformTab, LucideIcon, string]> = [
  ["overview", Gauge, "Overview"],
  ["office", Briefcase, "Club office"],
  ["competitions", Trophy, "Competitions"],
  ["league", Radio, "League hub"],
  ["capture", Camera, "Capture"],
  ["players", Users, "Players"],
  ["academy", GraduationCap, "Academy"],
  ["safety", ShieldCheck, "Safeguarding"],
  ["analysis", BarChart3, "Analysis room"],
  ["intelligence", Sparkles, "AI Intelligence"],
  ["operations", Activity, "Operations"],
];

export function Platform() {
  const {
    configured,
    session,
    loading: sessionLoading,
    error: sessionError,
    requestLink,
    signOut,
  } = useCloudSession();
  const [memberships, setMemberships] = useState<OrganisationMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [selectedOrganisationId, setSelectedOrganisationId] = useState<string | null>(null);

  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const membershipRequest = useRef(0);
  const createdForUser = useRef<string | null>(null);
  const reloadMemberships = useCallback(
    async (requireMembership = false) => {
      if (!session) return;
      const request = ++membershipRequest.current;
      setMembershipsLoading(true);
      setMembershipError(null);
      try {
        const next = await listOrganisationMemberships();
        if (request !== membershipRequest.current) return;
        if (requireMembership && next.length === 0) {
          throw new Error("Created organisation membership is not available yet.");
        }
        let saved: string | null = null;
        try {
          saved = window.localStorage.getItem("criclume:selected-organisation");
        } catch {
          /* Storage is optional. */
        }
        setMemberships(next);
        const selected = next.find((item) => item.organisationId === saved) ?? next[0] ?? null;
        setSelectedOrganisationId(selected?.organisationId ?? null);
      } catch {
        if (request === membershipRequest.current)
          setMembershipError(
            "Your organisations could not be loaded. Check your connection and try again. If you just created an organisation, do not create another.",
          );
      } finally {
        if (request === membershipRequest.current) {
          setLoadedUserId(session.user.id);
          setMembershipsLoading(false);
        }
      }
    },
    [session],
  );

  useEffect(() => {
    setMemberships([]);
    setSelectedOrganisationId(null);
    setLoadedUserId(null);
    setMembershipError(null);
    if (session) void reloadMemberships();
    return () => {
      membershipRequest.current += 1;
    };
  }, [reloadMemberships, session]);

  const selectOrganisation = (id: string) => {
    try {
      window.localStorage.setItem("criclume:selected-organisation", id);
    } catch {
      /* Selection still works without persistence. */
    }
    setSelectedOrganisationId(id);
  };

  if (!configured) return <ActivationGate />;
  if (sessionLoading) return <FullPageStatus title="Connecting to CricLume Cloud…" />;
  if (!session) return <SignInPanel error={sessionError} requestLink={requestLink} />;
  if (membershipsLoading || loadedUserId !== session.user.id)
    return <FullPageStatus title="Loading your organisations…" />;
  if (membershipError)
    return (
      <PageFrame>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-4 py-12">
          <h1 className="text-2xl font-bold">Organisation access unavailable</h1>
          <p role="alert" className="mt-4 text-amber-200">
            {membershipError}
          </p>
          <button
            className="action-primary mt-6"
            onClick={() => void reloadMemberships(createdForUser.current === session.user.id)}
          >
            Retry organisation access
          </button>
        </main>
      </PageFrame>
    );
  if (memberships.length === 0)
    return (
      <OrganisationOnboarding
        key={session.user.id}
        user={session.user}
        onCreated={() => {
          createdForUser.current = session.user.id;
          return reloadMemberships(true);
        }}
      />
    );

  const selected =
    memberships.find((item) => item.organisationId === selectedOrganisationId) ?? memberships[0]!;
  return (
    <OperationalPlatform
      key={`${selected.organisationId}:${selected.role}`}
      membership={selected}
      memberships={memberships}
      onSelectOrganisation={selectOrganisation}
      signOut={signOut}
    />
  );
}

function ActivationGate() {
  return (
    <PageFrame>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex min-h-[calc(100vh-74px)] max-w-xl items-center px-4 py-12 md:px-8"
      >
        <section className="broadcast-panel w-full p-6 text-center md:p-10">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300">
            <Database className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-bold md:text-4xl">Club workspace is briefly unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            We couldn't reach CricLume Cloud just now. Please refresh in a moment — your club's
            data is safe.
          </p>
          <button className="action-primary mt-6" onClick={() => window.location.reload()}>
            Try again
          </button>
        </section>
      </main>
    </PageFrame>
  );
}

function SignInPanel({
  error,
  requestLink,
}: {
  error: string | null;
  requestLink: (email: string, redirectTo?: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await requestLink(email.trim());
      setSent(true);
    } catch {
      setSent(false);
    } finally {
      setBusy(false);
    }
  };
  const signInWithGoogle = async () => {
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      const { lovable } = await import("@/integrations/lovable");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/platform`,
      });
      if (result.error) setGoogleError("Google sign-in didn’t finish. Please try again.");
    } catch {
      setGoogleError("Google sign-in didn’t finish. Please try again.");
    } finally {
      setGoogleBusy(false);
    }
  };
  const message = googleError ?? error;
  return (
    <PageFrame
      right={
        <Link to="/" className="app-chip-button">
          Back to site
        </Link>
      }
    >
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto grid min-h-[calc(100vh-74px)] max-w-6xl items-center gap-10 px-4 py-10 md:px-8 lg:grid-cols-[1.05fr_1fr]"
      >
        <section className="hidden lg:block" aria-hidden="true">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Club workspace</p>
          <h2 className="mt-3 font-display text-5xl font-bold leading-[1.02]">
            Your whole club,
            <br />
            ball by ball.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Fixtures, live scoring, camera rooms, player records and safeguarding — one place for
            everyone who runs match day.
          </p>
          <img
            src={scoreboardShot}
            alt=""
            className="mt-8 w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl shadow-black/40"
          />
        </section>
        <form
          onSubmit={(event) => void submit(event)}
          className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 md:p-9"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300">
            <LockKeyhole className="size-6" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold">Sign in to your club or league</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            New here? Signing in creates your account — then we’ll help you set up your club in a
            few steps.
          </p>
          <div className="mt-6">
            <GoogleButton onClick={() => void signInWithGoogle()} busy={googleBusy} />
          </div>
          <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <span className="h-px flex-1 bg-white/10" /> or use email <span className="h-px flex-1 bg-white/10" />
          </div>
          <Field label="Email address">
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="scorer-input"
              placeholder="you@club.org"
            />
          </Field>
          <button
            disabled={busy}
            className="cta-gradient mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-extrabold disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />}{" "}
            Email me a sign-in link
          </button>
          {(sent || message) && (
            <p
              role={message ? "alert" : "status"}
              className={`mt-4 rounded-xl p-3 text-xs ${message ? "bg-rose-400/10 text-rose-200" : "bg-amber-300/10 text-amber-200"}`}
            >
              {message ?? `We’ve sent a sign-in link to ${email.trim()}. Open it on this device to continue.`}
            </p>
          )}
          <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="size-4 text-amber-300/80" /> Everyone only sees what their club
            role allows.
          </p>
        </form>
      </main>
    </PageFrame>
  );
}

function OrganisationOnboarding({
  user,
  onCreated,
}: {
  user: { id: string };
  onCreated: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<OrganisationDraft | null>(() => {
    try {
      return readOrganisationDraft(window.localStorage, user.id);
    } catch {
      return null;
    }
  });
  const [persistent, setPersistent] = useState(true);
  const submitting = useRef(false);
  const [name, setName] = useState(draft?.name ?? "");
  const [kind, setKind] = useState<"club" | "league" | "school" | "academy">(draft?.kind ?? "club");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 120) {
      setError("Enter an organisation name of 2 to 120 characters.");
      return;
    }
    const request = draft ?? { requestId: crypto.randomUUID(), name: cleanName, kind };
    setDraft(request);
    try {
      setPersistent(storeOrganisationDraft(window.localStorage, user.id, request));
    } catch {
      setPersistent(false);
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await createOrganisation({
        name: request.name,
        kind: request.kind,
        requestId: request.requestId,
        user: user as Parameters<typeof createOrganisation>[0]["user"],
      });
      await onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Organisation could not be created.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <PageFrame>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex min-h-[calc(100vh-74px)] max-w-2xl items-center px-4 py-12"
      >
        <form
          onSubmit={(event) => void submit(event)}
          className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-9"
        >
          <UserRoundCheck className="size-10 text-amber-300" />
          <h1 className="mt-5 text-3xl font-bold">Create your CricLume organisation</h1>
          <p className="mt-2 text-sm text-slate-400">
            You become the owner and can invite the rest of the team afterwards.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Organisation name">
              <input
                required
                minLength={2}
                maxLength={120}
                disabled={busy || Boolean(draft)}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="scorer-input"
                placeholder="Riverside Cricket Club"
              />
            </Field>
            <Field label="Organisation type">
              <select
                disabled={busy || Boolean(draft)}
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
                className="scorer-input"
              >
                <option value="club">Club</option>
                <option value="league">League</option>
                <option value="school">School</option>
                <option value="academy">Academy</option>
              </select>
            </Field>
          </div>
          {draft && (
            <p role="status" className="mt-4 text-sm text-amber-200">
              These details are kept for a safe retry. Continue to recover the same organisation if
              the first response was interrupted.
            </p>
          )}
          {!persistent && (
            <p role="status" className="mt-3 text-sm text-amber-200">
              Browser storage is unavailable. Keep this page open while retrying; recovery across
              reloads is unavailable.
            </p>
          )}
          {error && <ErrorNotice message={error} />}
          <button
            disabled={busy}
            className="mt-5 flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400 px-7 text-sm font-extrabold disabled:opacity-50"
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}{" "}
            {draft ? "Continue organisation setup" : "Create organisation"}
          </button>
        </form>
      </main>
    </PageFrame>
  );
}

function OperationalPlatform({
  membership,
  memberships,
  onSelectOrganisation,
  signOut,
}: {
  membership: OrganisationMembership;
  memberships: OrganisationMembership[];
  onSelectOrganisation: (id: string) => void;
  signOut: () => Promise<void>;
}) {
  const tab = Route.useSearch().section ?? "overview";
  const navigate = Route.useNavigate();
  const setTab = (section: PlatformTab) =>
    void navigate({ search: { section }, resetScroll: true });
  const dashboard = usePlatformDashboard(membership.organisationId, membership.role);
  const [leagueStart, setLeagueStart] = useState<"live" | "stats">("live");
  return (
    <PageFrame
      right={
        <div className="flex items-center gap-2">
          {memberships.length > 1 && (
            <select
              aria-label="Organisation"
              value={membership.organisationId}
              onChange={(event) => onSelectOrganisation(event.target.value)}
              className="h-11 max-w-36 rounded-md border border-white/10 bg-[#17111f] px-2 text-xs"
            >
              {memberships.map((item) => (
                <option key={item.organisationId} value={item.organisationId}>
                  {item.organisationName}
                </option>
              ))}
            </select>
          )}
          <Link to="/app" className="app-chip-button">
            Scorer
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="app-chip-button"
          >
            Sign out
          </button>
        </div>
      }
    >
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 pt-6 pb-28 md:px-8 md:pt-9 lg:pb-9"
      >
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
              <span className="size-2 rounded-full bg-amber-300" /> Connected ·{" "}
              {membership.role.replaceAll("_", " ")}
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              {membership.organisationName}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Your club, match day and coaching work in one place.
            </p>
          </div>
          <button
            type="button"
            disabled={dashboard.refreshing}
            onClick={() => void dashboard.refresh()}
            className="flex items-center gap-2 self-start rounded-md border border-white/10 px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${dashboard.refreshing ? "animate-spin" : ""}`} />{" "}
            Refresh
          </button>
        </div>
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <SectionNavigation
          label="Workspace section"
          value={tab}
          onChange={setTab}
          items={tabDefinitions}
          mobilePrimary={["overview", "office", "league", "capture"]}
          layout="rail"
        />
        <div className="min-w-0 lg:pt-6">
        {dashboard.error && <ErrorNotice message={dashboard.error} />}
        {!dashboard.loading && !dashboard.data && dashboard.error ? (
          <section className="workspace-empty" role="status">
            <h2>Let’s get your workspace back</h2>
            <p>Your club records could not be loaded. Try the connection again.</p>
            <button
              className="action-primary"
              disabled={dashboard.refreshing}
              onClick={() => void dashboard.refresh()}
            >
              Try again
            </button>
          </section>
        ) : dashboard.loading || !dashboard.data ? (
          <FullPanelStatus title="Loading operational data…" />
        ) : (
          <>
            {tab === "overview" && (
              <Overview
                data={dashboard.data}
                role={membership.role}
                run={dashboard.run}
                onOpenSection={setTab}
                onViewStats={() => {
                  setLeagueStart("stats");
                  setTab("league");
                }}
              />
            )}
            {tab === "office" && (
              <ClubOffice
                key={membership.organisationId}
                organisationId={membership.organisationId}
                role={membership.role}
                club={dashboard.data}
              />
            )}
            {tab === "competitions" && (
              <Competitions data={dashboard.data} role={membership.role} run={dashboard.run} />
            )}
            {tab === "league" && (
              <LeagueHub key={leagueStart} initialView={leagueStart} data={dashboard.data} onRefresh={() => void dashboard.refresh()} refreshing={dashboard.refreshing} />
            )}
            {tab === "capture" && (
              <Capture data={dashboard.data} role={membership.role} run={dashboard.run} />
            )}
            {tab === "players" && (
              <Players data={dashboard.data} role={membership.role} run={dashboard.run} />
            )}
            {tab === "academy" && (
              <AcademyDashboard
                data={dashboard.data}
                role={membership.role}
                onOpenPlayers={() => setTab("players")}
                onOpenCompetitions={() => setTab("competitions")}
              />
            )}
            {tab === "safety" && (
              <Safeguarding data={dashboard.data} role={membership.role} run={dashboard.run} />
            )}
            {tab === "analysis" && (
              <CricketAnalysisWorkspace
                key={membership.organisationId}
                organisationId={membership.organisationId}
                role={membership.role}
                matches={dashboard.data.matches}
                players={dashboard.data.players}
              />
            )}
            {tab === "intelligence" && (
              <OmniqoraIntelligencePanel
                key={membership.organisationId}
                organisationId={membership.organisationId}
                role={membership.role}
                matches={dashboard.data.matches}
              />
            )}
            {tab === "operations" && (
              <Operations
                data={dashboard.data}
                role={membership.role}
                organisationId={membership.organisationId}
                run={dashboard.run}
              />
            )}
          </>
        )}
        </div>
        </div>
      </main>
    </PageFrame>
  );
}

function Overview({
  data,
  role,
  run,
  onOpenSection,
  onViewStats,
}: {
  data: PlatformDashboardData;
  role: PlatformRole;
  run: RunAction;
  onOpenSection: (section: PlatformTab) => void;
  onViewStats: () => void;
}) {
  const liveMatches = data.matches.filter((match) => match.status === "live");
  const upcoming = data.matches.filter((match) => ["draft", "scheduled"].includes(match.status));
  const cards = [
    [Radio, "Live matches", String(liveMatches.length), `${upcoming.length} upcoming`],
    [
      Camera,
      "Camera devices",
      String(
        data.matches.flatMap((match) => match.cameraRooms).flatMap((room) => room.devices).length,
      ),
      "Across open rooms",
    ],
    [
      Users,
      "Registered players",
      String(data.players.length),
      `${data.players.filter((player) => player.isJunior).length} junior profiles`,
    ],
    [
      FileCheck2,
      "AI review queue",
      String(data.aiCounts.reviewRequired),
      `${data.aiCounts.queued} processing`,
    ],
  ] as const;
  return (
    <div className="space-y-5">
      {can(role, "match.manage") && (
        <SetupChecklist
          counts={{
            teams: data.teams.length,
            players: data.players.length,
            members: data.members.length,
            matches: data.matches.length,
          }}
          onOpen={onOpenSection}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([Icon, label, value, detail]) => (
          <MetricCard key={label} icon={Icon} label={label} value={value} detail={detail} />
        ))}
      </div>
      <ClubMatchInsights data={data} onViewStats={onViewStats} />
      {can(role, "match.manage") && <CreateMatchPanel data={data} run={run} />}
      <Panel
        title="Matches"
        description="Open a cloud-linked scorer, manage public boards and monitor the current score."
      >
        {data.matches.length === 0 ? (
          <EmptyState
            title="No matches yet"
            detail="Register two teams and their players, then create the first match above."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.matches.map((match) => (
              <MatchCard key={match.id} match={match} data={data} role={role} run={run} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CreateMatchPanel({ data, run }: { data: PlatformDashboardData; run: RunAction }) {
  const [open, setOpen] = useState(false);
  const [home, setHome] = useState(data.teams[0]?.id ?? "");
  const [away, setAway] = useState(data.teams[1]?.id ?? "");
  const [ground, setGround] = useState("");
  const [competition, setCompetition] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [visibility, setVisibility] = useState<MatchRecord["visibility"]>("private");
  const [battingFirst, setBattingFirst] = useState(data.teams[0]?.id ?? "");
  const [overs, setOvers] = useState("20");
  const [weather, setWeather] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ matchId: string; scoreboardSlug: string | null } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const validation = validateCloudMatchSetup({
      homeTeamId: home,
      awayTeamId: away,
      battingFirstTeamId: battingFirst,
      overs,
      teams: data.teams,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setBusy(true);
    try {
      const result = await run(() =>
        createMatchWorkspace({
          organisationId: data.organisationId,
          homeTeamId: home,
          awayTeamId: away,
          groundId: ground,
          competitionId: competition,
          scheduledAt,
          visibility,
          battingFirstTeamId: battingFirst,
          oversPerInnings: validation.oversPerInnings,
          inningsPerSide: 1,
          ballsPerOver: 6,
          weather,
          ...(visibility === "public"
            ? {
                publicSlug: `${teamName(data, home)}-${teamName(data, away)}`,
              }
            : {}),
        }),
      );
      setCreated(result);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create this match.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Create a cloud match"
      description="The match, squads, first innings and optional public board are created atomically."
      action={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="action-secondary"
        >
          <Plus className="size-3.5" /> {open ? "Close" : "New match"}
        </button>
      }
    >
      {data.teams.length < 2 ? (
        <EmptyState
          title="Two teams required"
          detail="Use the Players tab to create teams and register at least two players in each."
        />
      ) : open ? (
        <form
          onSubmit={(event) => void submit(event)}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <SelectField
            label="Home team"
            value={home}
            setValue={(value) => {
              setHome(value);
              if (away === value) {
                setAway(data.teams.find((team) => team.id !== value)?.id ?? "");
              }
              setBattingFirst(value);
            }}
            options={data.teams.map((team) => [team.id, `${team.name} (${team.playerIds.length})`])}
          />
          <SelectField
            label="Away team"
            value={away}
            setValue={(value) => {
              setAway(value);
              if (battingFirst !== home) setBattingFirst(value);
            }}
            options={data.teams
              .filter((team) => team.id !== home)
              .map((team) => [team.id, `${team.name} (${team.playerIds.length})`])}
          />
          <SelectField
            label="Batting first"
            value={battingFirst}
            setValue={setBattingFirst}
            options={data.teams
              .filter((team) => [home, away].includes(team.id))
              .map((team) => [team.id, team.name])}
          />
          <SelectField
            label="Ground"
            value={ground}
            setValue={setGround}
            allowBlank="Not selected"
            options={data.grounds.map((item) => [item.id, item.name])}
          />
          <SelectField
            label="Competition"
            value={competition}
            setValue={setCompetition}
            allowBlank="Friendly / none"
            options={data.competitions.map((item) => [item.id, item.name])}
          />
          <Field label="Start time">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="scorer-input"
            />
          </Field>
          <SelectField
            label="Visibility"
            value={visibility}
            setValue={(value) => setVisibility(value as MatchRecord["visibility"])}
            options={[
              ["private", "Private"],
              ["clubs", "Clubs"],
              ["league", "League"],
              ["public", "Public"],
            ]}
          />
          <Field label="Overs">
            <input
              required
              type="number"
              min="1"
              max="100"
              step="1"
              value={overs}
              onChange={(event) => setOvers(event.target.value)}
              className="scorer-input"
            />
          </Field>
          <Field label="Weather" className="md:col-span-2">
            <input
              value={weather}
              onChange={(event) => setWeather(event.target.value)}
              className="scorer-input"
              placeholder="Dry, light cloud"
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-rose-200 md:col-span-2 xl:col-span-4">
              {error}
            </p>
          )}
          <div className="flex items-end">
            <button
              disabled={busy || home === away || !battingFirst}
              className="action-primary w-full"
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />} Create match
            </button>
          </div>
        </form>
      ) : created ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm">
          <Check className="size-4 text-amber-300" /> Match created.{" "}
          <a
            className="font-bold text-amber-200 underline"
            href={`/app?cloudMatch=${created.matchId}`}
          >
            Open cloud scorer
          </a>
          {created.scoreboardSlug && (
            <a
              className="font-bold text-amber-200 underline"
              href={`/scoreboard/${created.scoreboardSlug}`}
            >
              Open public board
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Create a match when the teams and active rosters are ready.
        </p>
      )}
    </Panel>
  );
}

function MatchCard({
  match,
  data,
  role,
  run,
}: {
  match: MatchRecord;
  data: PlatformDashboardData;
  role: PlatformRole;
  run: RunAction;
}) {
  const [busy, setBusy] = useState(false);
  const runs = Number(match.liveState["runs"] ?? 0);
  const wickets = Number(match.liveState["wickets"] ?? 0);
  const overs = String(match.liveState["overs"] ?? "0.0");
  const publish = async () => {
    setBusy(true);
    try {
      const slug =
        match.scoreboard?.slug ??
        `${match.id.slice(0, 8)}-${teamName(data, match.homeTeamId)}-${teamName(data, match.awayTeamId)}`;
      await run(() =>
        setPublicScoreboard({ matchId: match.id, slug, enabled: !match.scoreboard?.enabled }),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="match-card">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge value={match.status} />
        <span className="truncate text-xs text-slate-400">
          {groundName(data, match.groundId)} · {formatDate(match.scheduledAt)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamCrest name={teamName(data, match.homeTeamId)} />
          <span className="line-clamp-1 text-xs font-bold uppercase tracking-wider">
            {teamName(data, match.homeTeamId)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-display text-3xl font-bold tabular-nums text-gold">
            {runs}/{wickets}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-slate-400">{overs} overs</span>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamCrest name={teamName(data, match.awayTeamId)} />
          <span className="line-clamp-1 text-xs font-bold uppercase tracking-wider">
            {teamName(data, match.awayTeamId)}
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-white/10 pt-4">
        <a href={`/app?cloudMatch=${match.id}`} className="action-primary">
          Open scorer <ChevronRight className="size-3.5" />
        </a>
        {match.scoreboard?.enabled && (
          <a href={`/scoreboard/${match.scoreboard.slug}`} className="action-secondary">
            Public board <ExternalLink className="size-3.5" />
          </a>
        )}
        {match.scoreboard?.enabled && (
          <button
            type="button"
            className="action-secondary"
            title="Copy a transparent score overlay link for OBS or Streamlabs"
            onClick={() => {
              const link = `${window.location.origin}/overlay/${match.scoreboard!.slug}`;
              void navigator.clipboard
                .writeText(link)
                .then(() => toast.success("Stream overlay link copied. Add it as a Browser Source in OBS or Streamlabs."))
                .catch(() => window.prompt("Copy this overlay link", link));
            }}
          >
            Stream overlay <Copy className="size-3.5" />
          </button>
        )}
        {match.scoreboard?.enabled && (
          <StreamGuide slug={match.scoreboard.slug} matchTitle={`${teamName(data, match.homeTeamId)} v ${teamName(data, match.awayTeamId)}`} />
        )}
        {match.scoreboard?.enabled && (
          <a
            href={`/ground/${match.scoreboard.slug}`}
            target="_blank"
            rel="noreferrer"
            className="action-secondary"
            title="Full-screen score for a TV, projector or LED screen at the ground"
          >
            Ground screen <ExternalLink className="size-3.5" />
          </a>
        )}
        {can(role, "match.manage") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="action-secondary"
          >
            {match.scoreboard?.enabled ? "Make private" : "Publish board"}
          </button>
        )}
      </div>
    </article>
  );
}

function downloadFixtureCalendar(data: PlatformDashboardData, competition: CompetitionRecord) {
  const fixtures = data.fixtures
    .filter((fixture) => fixture.competitionId === competition.id)
    .map((fixture) => ({
      id: fixture.id,
      startsAt: fixture.startsAt,
      homeTeam: teamName(data, fixture.homeTeamId),
      awayTeam: teamName(data, fixture.awayTeamId),
      ground: fixture.groundId ? groundName(data, fixture.groundId) : null,
      round: fixture.roundName,
      status: fixture.status,
    }));
  const calendar = fixtureCalendarIcs({
    competitionId: competition.id,
    competitionName: competition.name,
    seasonName: competition.seasonName,
    fixtures,
  });
  if (!calendar.included) return;
  const url = URL.createObjectURL(
    new Blob([calendar.contents], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `criclume-${competition.id.slice(0, 8)}-fixtures.ics`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Competitions({
  data,
  role,
  run,
}: {
  data: PlatformDashboardData;
  role: PlatformRole;
  run: RunAction;
}) {
  const scheduling = reviewFixtureSchedule(data.fixtures);
  return (
    <div className="space-y-5">
      {can(role, "competition.manage") && <CompetitionForm data={data} run={run} />}
      {can(role, "fixtures.manage") && <FixtureBuilder data={data} run={run} />}
      {can(role, "fixtures.manage") && <FixtureForm data={data} run={run} />}
      {scheduling.alerts.length > 0 && (
        <section
          aria-label="Potential fixture schedule overlaps"
          className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.05] p-5"
        >
          <h3 className="text-lg font-bold text-amber-200">Fixture timing to review</h3>
          <p className="mt-2 text-sm text-slate-300">
            These fixtures start less than four hours apart with a team or ground in common. Cricket
            match durations are not recorded, so these are possible scheduling conflicts—not
            confirmed double bookings. Check the fixtures before match day.
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            {scheduling.alerts.map((item) => (
              <li
                key={`${item.firstFixtureId}-${item.secondFixtureId}`}
                className="rounded-xl border border-amber-300/20 bg-black/20 p-3"
              >
                <p className="font-semibold text-amber-100">
                  {item.sharedTeamIds.length > 0
                    ? `Team: ${item.sharedTeamIds.map((id) => teamName(data, id)).join(", ")}`
                    : ""}
                  {item.sharedTeamIds.length > 0 && item.sharedGroundId ? " · " : ""}
                  {item.sharedGroundId ? `Ground: ${groundName(data, item.sharedGroundId)}` : ""}
                </p>
                <p className="mt-1 text-slate-300">
                  Scheduled starts are {item.minutesApart} minutes apart.
                </p>
                <div className="mt-2 flex flex-wrap gap-4">
                  <a
                    className="font-semibold text-amber-200 underline"
                    href={`#fixture-${item.firstFixtureId}`}
                  >
                    View first fixture
                  </a>
                  <a
                    className="font-semibold text-amber-200 underline"
                    href={`#fixture-${item.secondFixtureId}`}
                  >
                    View second fixture
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {scheduling.truncated && (
            <p className="mt-3 text-xs text-amber-200">
              Showing the first 30 possible scheduling conflicts. Review the full fixture list.
            </p>
          )}
        </section>
      )}
      <Panel
        title="Competitions and fixtures"
        description="All rows below come from the selected organisation's database records."
      >
        {data.competitions.length === 0 ? (
          <EmptyState
            title="No competition configured"
            detail="League administrators can create a versioned competition rule pack above."
          />
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-slate-400">
              Calendar exports include only fixtures with confirmed absolute start timestamps. No
              match duration or unscheduled venue is invented.
            </p>
            {data.competitions.map((competition) => (
              <div key={competition.id}>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{competition.name}</h3>
                    <p className="text-xs text-slate-500">
                      {competition.seasonName} · {competition.format.replaceAll("_", " ")} · rules v
                      {competition.activeRuleVersion}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-amber-200">
                      {
                        data.fixtures.filter((fixture) => fixture.competitionId === competition.id)
                          .length
                      }{" "}
                      fixtures
                    </span>
                    <button
                      type="button"
                      className="workspace-nav-item"
                      disabled={
                        !data.fixtures.some(
                          (fixture) =>
                            fixture.competitionId === competition.id && Boolean(fixture.startsAt),
                        )
                      }
                      onClick={() => downloadFixtureCalendar(data, competition)}
                      aria-label={`Download ${competition.name} fixtures as an iCalendar file`}
                    >
                      <CalendarDays className="size-4" aria-hidden="true" />
                      Download .ics
                    </button>
                  </div>
                </div>
                {competition.format === "league" && (
                  <LeagueStandings
                    competition={competition}
                    fixtures={data.fixtures}
                    teams={data.teams}
                  />
                )}
                <MatchDayPosts data={data} competition={competition} />
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {data.fixtures
                    .filter((fixture) => fixture.competitionId === competition.id)
                    .map((fixture) => (
                      <div
                        key={fixture.id}
                        id={`fixture-${fixture.id}`}
                        className="scroll-mt-28 rounded-lg border border-white/8 bg-black/10 p-3"
                      >
                        <div className="text-[10px] font-bold uppercase text-amber-200">
                          {fixture.roundName ?? "Fixture"} · {formatDate(fixture.startsAt)}
                        </div>
                        <div className="mt-1 text-sm font-bold">
                          {teamName(data, fixture.homeTeamId)} v{" "}
                          {teamName(data, fixture.awayTeamId)}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {groundName(data, fixture.groundId)} · {fixture.status}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CompetitionForm({ data, run }: { data: PlatformDashboardData; run: RunAction }) {
  const [name, setName] = useState("");
  const [season, setSeason] = useState(`${new Date().getFullYear()} season`);
  const [format, setFormat] = useState("league");
  const [overs, setOvers] = useState("20");
  const [rainMethod, setRainMethod] = useState<"arr" | "mpo" | "dls" | "manual">("arr");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const oversPerInnings = readLimitedOvers(overs);
    if (name.trim().length < 2 || name.trim().length > 120) {
      setError("Enter a competition name between 2 and 120 characters.");
      return;
    }
    if (season.trim().length < 2 || season.trim().length > 120) {
      setError("Enter a season name between 2 and 120 characters.");
      return;
    }
    if (oversPerInnings === null) {
      setError("Enter a whole number of overs between 1 and 100.");
      return;
    }
    setBusy(true);
    try {
      await run(() =>
        createCompetition({
          organisationId: data.organisationId,
          name: name.trim(),
          format,
          seasonName: season.trim(),
          oversPerInnings,
          inningsPerSide: 1,
          ballsPerOver: 6,
          rainMethod,
        }),
      );
      setName("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create this competition.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Create competition"
      description="Creates the season, competition and immutable rule version together."
    >
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-5">
        <Field label="Competition">
          <input
            required
            minLength={2}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="scorer-input"
          />
        </Field>
        <Field label="Season">
          <input
            required
            value={season}
            onChange={(event) => setSeason(event.target.value)}
            className="scorer-input"
          />
        </Field>
        <SelectField
          label="Format"
          value={format}
          setValue={setFormat}
          options={[
            ["league", "League"],
            ["groups", "Groups"],
            ["knockout", "Knockout"],
            ["round_robin_knockout", "Round robin + knockout"],
            ["friendly", "Friendly"],
          ]}
        />
        <Field label="Overs">
          <input
            required
            type="number"
            min="1"
            max="100"
            step="1"
            value={overs}
            onChange={(event) => setOvers(event.target.value)}
            className="scorer-input"
          />
        </Field>
        <SelectField
          label="Rain rule"
          value={rainMethod}
          setValue={(value) => setRainMethod(value as typeof rainMethod)}
          options={rainMethods.map((item) => [item.id, item.label] as [string, string])}
        />
        {error && (
          <p role="alert" className="text-sm text-rose-200 md:col-span-5">
            {error}
          </p>
        )}
        <button disabled={busy} className="action-primary md:col-span-5 md:justify-self-end">
          {busy && <LoaderCircle className="size-4 animate-spin" />} Create competition
        </button>
      </form>
    </Panel>
  );
}

function FixtureForm({ data, run }: { data: PlatformDashboardData; run: RunAction }) {
  const [competitionId, setCompetitionId] = useState(data.competitions[0]?.id ?? "");
  const [home, setHome] = useState(data.teams[0]?.id ?? "");
  const [away, setAway] = useState(data.teams[1]?.id ?? "");
  const [ground, setGround] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [round, setRound] = useState("");
  const [busy, setBusy] = useState(false);
  const competition = data.competitions.find((item) => item.id === competitionId);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!competition || !competition.ruleVersionId) {
      setError("Choose a competition with an active rule version.");
      return;
    }
    if (
      home === away ||
      !data.teams.some((team) => team.id === home) ||
      !data.teams.some((team) => team.id === away)
    ) {
      setError("Choose two different registered teams.");
      return;
    }
    if (ground && !data.grounds.some((item) => item.id === ground)) {
      setError("Select a registered ground or leave it blank.");
      return;
    }
    if (startsAt && !Number.isFinite(new Date(startsAt).getTime())) {
      setError("Enter a valid start date and time.");
      return;
    }
    if (round.trim().length > 120) {
      setError("Keep the round name under 120 characters.");
      return;
    }
    setBusy(true);
    try {
      await run(() =>
        createFixture({
          competition,
          homeTeamId: home,
          awayTeamId: away,
          groundId: ground,
          startsAt,
          roundName: round.trim(),
        }),
      );
      setRound("");
      setStartsAt("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not schedule this fixture.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Schedule fixture"
      description="Fixture rows are governed by the selected competition's active rule version."
    >
      {data.competitions.length === 0 || data.teams.length < 2 ? (
        <EmptyState
          title="Competition and teams required"
          detail="Create those records before scheduling fixtures."
        />
      ) : (
        <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-3">
          <SelectField
            label="Competition"
            value={competitionId}
            setValue={setCompetitionId}
            options={data.competitions.map((item) => [item.id, item.name])}
          />
          <SelectField
            label="Home"
            value={home}
            setValue={setHome}
            options={data.teams.map((item) => [item.id, item.name])}
          />
          <SelectField
            label="Away"
            value={away}
            setValue={setAway}
            options={data.teams
              .filter((item) => item.id !== home)
              .map((item) => [item.id, item.name])}
          />
          <SelectField
            label="Ground"
            value={ground}
            setValue={setGround}
            allowBlank="Not selected"
            options={data.grounds.map((item) => [item.id, item.name])}
          />
          <Field label="Start">
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="scorer-input"
            />
            <span className="text-xs text-slate-400">
              Time is entered in your device’s local time zone. Confirm venue time before saving.
            </span>
          </Field>
          <Field label="Round">
            <input
              value={round}
              onChange={(event) => setRound(event.target.value)}
              className="scorer-input"
              placeholder="Round 1"
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-rose-200 md:col-span-3">
              {error}
            </p>
          )}
          <button
            disabled={busy || home === away}
            className="action-primary md:col-span-3 md:justify-self-end"
          >
            Schedule fixture
          </button>
        </form>
      )}
    </Panel>
  );
}

function Capture({
  data,
  role,
  run,
}: {
  data: PlatformDashboardData;
  role: PlatformRole;
  run: RunAction;
}) {
  const [matchId, setMatchId] = useState(data.matches[0]?.id ?? "");
  const [name, setName] = useState("Match camera room");
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState<{
    roomId: string;
    pairingToken: string;
    expiresAt: string;
  } | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      setPairing(await run(() => createCameraRoom({ matchId, name })));
    } finally {
      setBusy(false);
    }
  };
  const rooms = data.matches.flatMap((match) => match.cameraRooms);
  return (
    <div className="space-y-5">
      {can(role, "video.capture") && (
        <Panel
          title="Create camera room"
          description="Returns a short-lived token for phones at both ends and side-on angles."
        >
          {data.matches.length === 0 ? (
            <EmptyState
              title="Create a match first"
              detail="Camera rooms must be attached to an authorised cloud match."
            />
          ) : (
            <form
              onSubmit={(event) => void submit(event)}
              className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
            >
              <SelectField
                label="Match"
                value={matchId}
                setValue={setMatchId}
                options={data.matches.map((match) => [
                  match.id,
                  `${teamName(data, match.homeTeamId)} v ${teamName(data, match.awayTeamId)}`,
                ])}
              />
              <Field label="Room name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="scorer-input"
                />
              </Field>
              <div className="flex items-end">
                <button disabled={busy} className="action-primary">
                  Create room
                </button>
              </div>
            </form>
          )}
          {pairing && (
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
              <div className="text-xs text-slate-400">
                Pairing token · expires {formatDate(pairing.expiresAt)}
              </div>
              <div className="mt-2 break-all font-mono text-lg font-bold text-amber-200">
                {pairing.pairingToken}
              </div>
              <a
                href={`/camera/${pairing.roomId}`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-200 underline"
              >
                Open camera page <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </Panel>
      )}
      <Panel
        title="Active camera rooms"
        description="Device counts, labels and heartbeat state come from Realtime-backed records."
      >
        {rooms.length === 0 ? (
          <EmptyState
            title="No camera rooms"
            detail="Create one when the match camera crew is ready."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rooms.map((room) => (
              <div key={room.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{room.name}</h3>
                    <p className="text-xs text-slate-500">
                      {teamNameForMatch(data, room.matchId)} · {room.status}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-amber-200" aria-label={`${room.devices.length} of ${room.maxDevices} phones`}>
                    {room.devices.length}/{room.maxDevices} phones
                  </span>
                </div>
                {(can(role, "video.capture") || can(role, "match.score")) && room.status === "open" && (
                  <label className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-300">
                    Phones allowed in this match
                    <select
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1"
                      value={room.maxDevices}
                      onChange={(event) => void run(() => setCameraRoomCapacity(room.id, Number(event.target.value)))}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                        <option key={count} value={count} disabled={count < room.devices.length}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="mt-3 space-y-2">
                  {room.devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs"
                    >
                      <span>
                        {device.label} · {device.angle.replaceAll("_", " ")}
                      </span>
                      <span className="flex items-center gap-2 text-slate-500">
                        {device.clockOffsetMs} ms
                        {(can(role, "video.capture") || can(role, "match.score")) && room.status === "open" && (
                          <button
                            type="button"
                            className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300"
                            aria-label={`Remove ${device.label}`}
                            onClick={() => void run(() => removeCameraDevice(device.id))}
                          >
                            Remove
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  <a
                    href={`/camera/${room.id}`}
                    className="inline-flex text-xs font-bold text-amber-200"
                  >
                    Open phone camera
                  </a>
                  {(can(role, "video.capture") || can(role, "match.score")) && (
                    <a
                      href={`/director/${room.id}`}
                      className="inline-flex text-xs font-bold text-emerald-300"
                    >
                      Open live director
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel
        title="Video processing"
        description="These are real storage records, not provider estimates."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard
            icon={Video}
            label="Assets"
            value={String(data.videoCounts.total)}
            detail="Private source records"
          />
          <MetricCard
            icon={Cloud}
            label="Processing"
            value={String(data.videoCounts.processing)}
            detail="Upload or transcode"
          />
          <MetricCard
            icon={Check}
            label="Ready"
            value={String(data.videoCounts.ready)}
            detail="Available for review"
          />
          <MetricCard
            icon={ShieldCheck}
            label="Retention due"
            value={String(data.videoCounts.retentionDue)}
            detail="Within seven days"
          />
        </div>
      </Panel>
    </div>
  );
}

function Players({
  data,
  role,
  run,
}: {
  data: PlatformDashboardData;
  role: PlatformRole;
  run: RunAction;
}) {
  return (
    <div className="space-y-5">
      {can(role, "team.manage") && <TeamAndGroundForms data={data} run={run} />}
      {can(role, "player.manage") && <PlayerForm data={data} run={run} />}
      {can(role, "team.manage") && can(role, "player.manage") && <SquadImport data={data} run={run} />}
      <Panel
        title="Player histories"
        description="Career totals aggregate canonical delivery records visible to this organisation."
      >
        {data.players.length === 0 ? (
          <EmptyState
            title="No players registered"
            detail="Create a team, then add its players above."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.players.map((player) => (
              <article
                key={player.id}
                className="rounded-xl border border-white/10 bg-black/10 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold">{player.name}</h3>
                    <p className="text-[11px] text-slate-500">
                      {player.teamIds.map((id) => teamName(data, id)).join(", ") ||
                        "No active team"}
                    </p>
                  </div>
                  {player.isJunior && (
                    <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[10px] font-bold text-amber-200">
                      Junior
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Runs" value={player.career.runs} />
                  <MiniStat label="Wickets" value={player.career.wickets} />
                  <MiniStat label="Catches" value={player.career.catches} />
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function TeamAndGroundForms({ data, run }: { data: PlatformDashboardData; run: RunAction }) {
  const [team, setTeam] = useState("");
  const [short, setShort] = useState("");
  const [age, setAge] = useState("");
  const [ground, setGround] = useState("");
  const [busy, setBusy] = useState(false);
  const addTeam = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await run(() =>
        createTeam({
          organisationId: data.organisationId,
          name: team,
          shortName: short || team.slice(0, 3),
          ageGroup: age,
        }),
      );
      setTeam("");
      setShort("");
    } finally {
      setBusy(false);
    }
  };
  const addGround = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await run(() => createGround({ organisationId: data.organisationId, name: ground }));
      setGround("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Register team">
        <form onSubmit={(event) => void addTeam(event)} className="grid gap-3 sm:grid-cols-3">
          <Field label="Name">
            <input
              required
              value={team}
              onChange={(event) => setTeam(event.target.value)}
              className="scorer-input"
            />
          </Field>
          <Field label="Short name">
            <input
              value={short}
              onChange={(event) => setShort(event.target.value)}
              className="scorer-input"
              maxLength={12}
            />
          </Field>
          <Field label="Age group">
            <input
              value={age}
              onChange={(event) => setAge(event.target.value)}
              className="scorer-input"
              placeholder="Open / U15"
            />
          </Field>
          <button disabled={busy} className="action-primary sm:col-span-3 sm:justify-self-end">
            Add team
          </button>
        </form>
      </Panel>
      <Panel title="Register ground">
        <form
          onSubmit={(event) => void addGround(event)}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <Field label="Ground name" className="flex-1">
            <input
              required
              value={ground}
              onChange={(event) => setGround(event.target.value)}
              className="scorer-input"
            />
          </Field>
          <button disabled={busy} className="action-primary">
            Add ground
          </button>
        </form>
      </Panel>
    </div>
  );
}

function PlayerForm({ data, run }: { data: PlatformDashboardData; run: RunAction }) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(data.teams[0]?.id ?? "");
  const [junior, setJunior] = useState(false);
  const [publicProfile, setPublicProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await run(() =>
        createPlayer({
          organisationId: data.organisationId,
          teamId,
          name,
          isJunior: junior,
          publicProfile,
        }),
      );
      setName("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Register player"
      description="Junior and public-profile flags are explicit and can be changed only by authorised roles."
    >
      {data.teams.length === 0 ? (
        <EmptyState
          title="Create a team first"
          detail="Every new player is assigned to an active team roster."
        />
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          className="grid gap-3 md:grid-cols-[1.5fr_1fr_auto_auto_auto]"
        >
          <Field label="Player name">
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="scorer-input"
            />
          </Field>
          <SelectField
            label="Team"
            value={teamId}
            setValue={setTeamId}
            options={data.teams.map((team) => [team.id, team.name])}
          />
          <CheckField label="Junior" checked={junior} setChecked={setJunior} />
          <CheckField
            label="Public profile"
            checked={publicProfile}
            setChecked={setPublicProfile}
          />
          <div className="flex items-end">
            <button disabled={busy} className="action-primary">
              Add player
            </button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function Safeguarding({
  data,
  role,
  run,
}: {
  data: PlatformDashboardData;
  role: PlatformRole;
  run: RunAction;
}) {
  const [playerId, setPlayerId] = useState(data.players[0]?.id ?? "");
  const selected = data.players.find((player) => player.id === playerId);
  const [recording, setRecording] = useState<ConsentState>(
    selected?.consent?.recording ?? "pending",
  );
  const [coaching, setCoaching] = useState<ConsentState>(
    selected?.consent?.coachingAnalysis ?? "pending",
  );
  const [highlights, setHighlights] = useState<ConsentState>(
    selected?.consent?.publicHighlights ?? "pending",
  );
  const [biometric, setBiometric] = useState<ConsentState>(
    selected?.isJunior ? "denied" : (selected?.consent?.biometricAnalysis ?? "denied"),
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const player = data.players.find((item) => item.id === playerId);
    setRecording(player?.consent?.recording ?? "pending");
    setCoaching(player?.consent?.coachingAnalysis ?? "pending");
    setHighlights(player?.consent?.publicHighlights ?? "pending");
    setBiometric(player?.isJunior ? "denied" : (player?.consent?.biometricAnalysis ?? "denied"));
  }, [data.players, playerId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await run(() =>
        recordPlayerConsent({
          organisationId: data.organisationId,
          playerId,
          recording,
          coachingAnalysis: coaching,
          publicHighlights: highlights,
          biometricAnalysis: selected.isJunior ? "denied" : biometric,
          notes: "Updated in CricLume control centre",
        }),
      );
    } finally {
      setBusy(false);
    }
  };
  const pending = data.players.filter(
    (player) => !player.consent || player.consent.recording === "pending",
  ).length;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Users}
          label="Junior players"
          value={String(data.players.filter((player) => player.isJunior).length)}
          detail="Restricted media defaults"
        />
        <MetricCard
          icon={FileCheck2}
          label="Recording pending"
          value={String(pending)}
          detail="Consent action required"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Retention due"
          value={String(data.videoCounts.retentionDue)}
          detail="Assets due within 7 days"
        />
      </div>
      {can(role, "safeguarding.manage") ? (
        <Panel
          title="Record consent decision"
          description="Each save creates a dated consent record; junior biometric identification remains denied."
        >
          {data.players.length === 0 ? (
            <EmptyState title="No players" detail="Register players before recording consent." />
          ) : (
            <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-5">
              <SelectField
                label="Player"
                value={playerId}
                setValue={setPlayerId}
                options={data.players.map((player) => [
                  player.id,
                  `${player.name}${player.isJunior ? " · junior" : ""}`,
                ])}
              />
              <ConsentSelect label="Recording" value={recording} setValue={setRecording} />
              <ConsentSelect label="Coaching AI" value={coaching} setValue={setCoaching} />
              <ConsentSelect
                label="Public highlights"
                value={highlights}
                setValue={setHighlights}
              />
              <ConsentSelect
                label="Biometric"
                value={biometric}
                setValue={setBiometric}
                disabled={Boolean(selected?.isJunior)}
              />
              <button disabled={busy} className="action-primary md:col-span-5 md:justify-self-end">
                Save consent decision
              </button>
            </form>
          )}
        </Panel>
      ) : (
        <Panel title="Consent register">
          <p className="text-sm text-slate-400">
            Your role can view consent status but cannot change safeguarding decisions.
          </p>
        </Panel>
      )}
      <Panel title="Consent register" description="Current effective state for each player.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead>
              <tr className="text-slate-500">
                {["Player", "Junior", "Recording", "Coaching", "Highlights", "Biometric"].map(
                  (heading) => (
                    <th key={heading} className="border-b border-white/10 px-2 py-2">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.players.map((player) => (
                <tr key={player.id} className="border-b border-white/5">
                  <td className="px-2 py-3 font-bold">{player.name}</td>
                  <td className="px-2">{player.isJunior ? "Yes" : "No"}</td>
                  <td className="px-2">{player.consent?.recording ?? "pending"}</td>
                  <td className="px-2">{player.consent?.coachingAnalysis ?? "pending"}</td>
                  <td className="px-2">{player.consent?.publicHighlights ?? "pending"}</td>
                  <td className="px-2">
                    {player.isJunior ? "denied" : (player.consent?.biometricAnalysis ?? "denied")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Operations({
  data,
  role,
  organisationId,
  run,
}: {
  data: PlatformDashboardData;
  role: PlatformRole;
  organisationId: string;
  run: RunAction;
}) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<PlatformRole>("scorer");
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    void getCloudClient()
      .auth.getUser()
      .then(({ data: auth }) => setMe(auth.user?.id ?? null));
  }, []);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const priceId = import.meta.env["VITE_STRIPE_PRICE_CLUB"]?.trim() ?? "";
  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await run(() => inviteMember({ organisationId, email, role: inviteRole }));
      setEmail("");
      setSent(true);
    } finally {
      setBusy(false);
    }
  };
  const checkout = async () => {
    setBusy(true);
    try {
      const url = await run(() =>
        data.subscription?.hasBillingAccount
          ? openBillingPortal(organisationId)
          : createCheckout({ organisationId, priceId }),
      );
      window.location.assign(url);
    } finally {
      setBusy(false);
    }
  };
  const integrations = [
    [Database, "CricLume Cloud database", "Connected", true],
    [
      CircleDollarSign,
      "Stripe Billing",
      priceId ? "Plan configured" : "Price ID required",
      Boolean(priceId),
    ],
    [Mail, "Transactional email", "Server verification required", false],
    [Video, "Video transcoding", "Provider verification required", false],
    [Sparkles, "AI analysis", "Provider verification required", false],
    [FileCheck2, "Licensed rain rules", "Commercial provider required", false],
  ] as const;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map(([Icon, name, status, ready]) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4"
          >
            <span
              className={`flex size-10 items-center justify-center rounded-lg ${ready ? "bg-amber-300/12" : "bg-white/5"}`}
            >
              <Icon className={`size-5 ${ready ? "text-amber-300" : "text-slate-500"}`} />
            </span>
            <div>
              <div className="text-sm font-bold">{name}</div>
              <div className="mt-1 text-[10px] text-slate-500">{status}</div>
            </div>
          </div>
        ))}
      </div>
      {can(role, "billing.manage") && (
        <IntegrationReadinessPanel key={organisationId} organisationId={organisationId} />
      )}
      {can(role, "members.manage") && (
        <Panel
          title="Invite member"
          description="We email them a sign-in link. They only get the access their role allows."
        >
          <form
            onSubmit={(event) => void submitInvite(event)}
            className="grid gap-3 md:grid-cols-[1.5fr_1fr_auto]"
          >
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="scorer-input"
              />
            </Field>
            <SelectField
              label="Role"
              value={inviteRole}
              setValue={(value) => setInviteRole(value as PlatformRole)}
              options={assignableRoles(role)
                .filter((item) => item !== "owner")
                .map((item) => [item, roleLabels[item]])}
            />
            <div className="flex items-end">
              <button disabled={busy} className="action-primary">
                <UserPlus className="size-4" /> Invite
              </button>
            </div>
          </form>
          {sent && (
            <p className="mt-3 text-xs text-amber-200">Invitation requested successfully.</p>
          )}
        </Panel>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Members" description={`${data.members.length} organisation memberships`}>
          <div className="space-y-2">
            {data.members.map((member) => {
              const manageable =
                member.userId !== me &&
                assignableRoles(role).includes(member.role) &&
                can(role, "members.manage");
              return (
                <div
                  key={member.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 px-3 py-2 text-xs"
                >
                  <span className="font-bold">{member.displayName}</span>
                  {manageable ? (
                    <span className="flex items-center gap-2">
                      <select
                        aria-label={`Role for ${member.displayName}`}
                        className="scorer-input h-9 py-0 text-xs"
                        value={member.role}
                        onChange={(event) =>
                          void run(() =>
                            updateMember({ organisationId, userId: member.userId, role: event.target.value as PlatformRole }),
                          )
                        }
                      >
                        {assignableRoles(role).map((item) => (
                          <option key={item} value={item}>
                            {roleLabels[item]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="app-chip-button"
                        onClick={() =>
                          void run(() =>
                            updateMember({
                              organisationId,
                              userId: member.userId,
                              status: member.status === "suspended" ? "active" : "suspended",
                            }),
                          )
                        }
                      >
                        {member.status === "suspended" ? "Restore access" : "Suspend"}
                      </button>
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {roleLabels[member.role] ?? member.role} · {member.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Subscription" description="Entitlements are webhook-driven.">
          <div className="text-2xl font-bold">{data.subscription?.plan ?? "Starter"}</div>
          <p className="mt-1 text-xs text-slate-500">
            {data.subscription?.status ?? "No paid subscription"}
            {data.subscription?.currentPeriodEnd
              ? ` · renews ${formatDate(data.subscription.currentPeriodEnd)}`
              : ""}
          </p>
          {can(role, "billing.manage") && (
            <button
              type="button"
              disabled={(!data.subscription?.hasBillingAccount && !priceId) || busy}
              onClick={() => void checkout()}
              className="action-primary mt-4"
            >
              Manage subscription
            </button>
          )}
          {!data.subscription?.hasBillingAccount && !priceId && (
            <p className="mt-3 text-[11px] text-amber-200">
              Set VITE_STRIPE_PRICE_CLUB before enabling checkout.
            </p>
          )}
        </Panel>
      </div>
      <Panel
        title="Operational evidence"
        description="No invented uptime or backup figures are displayed."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            icon={Activity}
            label="Unread notifications"
            value={String(data.unreadNotifications)}
            detail="For this signed-in user"
          />
          <MetricCard
            icon={ShieldCheck}
            label="Audit entries"
            value={String(data.audit.length)}
            detail="Latest accessible records"
          />
          <MetricCard
            icon={RefreshCw}
            label="Last loaded"
            value={new Date(data.loadedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            detail="Realtime refresh enabled"
          />
        </div>
        {data.audit.length > 0 && (
          <div className="mt-4 space-y-2">
            {data.audit.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-lg border border-white/8 px-3 py-2 text-xs"
              >
                <span className="font-bold uppercase text-amber-200">{entry.action}</span>
                <span>
                  {entry.entityTable} · {entry.entityId.slice(0, 12)}
                </span>
                <span className="text-slate-500">{formatDate(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function PageFrame({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f0d17] text-slate-100">
      <AppHeader area="Club workspace" right={right} />
      {children}
    </div>
  );
}
function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
function SelectField({
  label,
  value,
  setValue,
  options,
  allowBlank,
  disabled,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: Array<[string, string]>;
  allowBlank?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        required={!allowBlank}
        disabled={disabled}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="scorer-input disabled:cursor-not-allowed disabled:opacity-50"
      >
        {allowBlank && <option value="">{allowBlank}</option>}
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </Field>
  );
}
function ConsentSelect({
  label,
  value,
  setValue,
  disabled,
}: {
  label: string;
  value: ConsentState;
  setValue: (value: ConsentState) => void;
  disabled?: boolean;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      setValue={(next) => setValue(next as ConsentState)}
      options={[
        ["pending", "Pending"],
        ["granted", "Granted"],
        ["denied", "Denied"],
        ["withdrawn", "Withdrawn"],
      ]}
      disabled={Boolean(disabled)}
    />
  );
}
function CheckField({
  label,
  checked,
  setChecked,
}: {
  label: string;
  checked: boolean;
  setChecked: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center gap-2 self-end rounded-xl border border-white/10 px-3 text-xs font-bold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        className="accent-amber-300"
      />{" "}
      {label}
    </label>
  );
}
function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs font-semibold">{label}</span>
        <Icon className="size-4 text-amber-300" />
      </div>
      <div className="mt-4 text-3xl font-bold">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
    </div>
  );
}
function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-2">
      <div className="font-bold">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
function ErrorNotice({ message }: { message: string }) {
  return (
    <p className="my-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200">
      {message}
    </p>
  );
}
function FullPageStatus({ title }: { title: string }) {
  return (
    <PageFrame>
      <div className="flex min-h-[70vh] items-center justify-center gap-3 text-sm text-slate-400">
        <LoaderCircle className="size-5 animate-spin text-amber-300" /> {title}
      </div>
    </PageFrame>
  );
}
function FullPanelStatus({ title }: { title: string }) {
  return (
    <div className="flex min-h-72 items-center justify-center gap-3 rounded-xl border border-white/10 text-sm text-slate-400">
      <LoaderCircle className="size-5 animate-spin text-amber-300" /> {title}
    </div>
  );
}
function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`hero-chip ${value === "live" || value === "in_progress" ? "hero-chip-live" : ""}`}>
      {(value === "live" || value === "in_progress") && <span className="live-dot" aria-hidden="true" />}
      {value.replaceAll("_", " ")}
    </span>
  );
}
function teamName(data: PlatformDashboardData, id: string) {
  return data.teams.find((team) => team.id === id)?.name ?? "Team";
}
function groundName(data: PlatformDashboardData, id: string | null) {
  return id ? (data.grounds.find((ground) => ground.id === id)?.name ?? "Ground") : "Ground TBC";
}
function teamNameForMatch(data: PlatformDashboardData, matchId: string) {
  const match = data.matches.find((item) => item.id === matchId);
  return match
    ? `${teamName(data, match.homeTeamId)} v ${teamName(data, match.awayTeamId)}`
    : "Match";
}
function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "Not scheduled";
}
