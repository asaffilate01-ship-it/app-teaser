import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  Database,
  ExternalLink,
  FileCheck2,
  Gauge,
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
import logoAsset from "@/assets/criclume-logo-header.png.asset.json";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { usePlatformDashboard } from "@/hooks/use-platform-dashboard";
import { listOrganisationMemberships, type OrganisationMembership } from "@/lib/cloud";
import {
  createCameraRoom,
  createCheckout,
  createCompetition,
  createFixture,
  createGround,
  createMatchWorkspace,
  createOrganisation,
  createPlayer,
  createTeam,
  inviteMember,
  recordPlayerConsent,
  setPublicScoreboard,
  type CompetitionRecord,
  type ConsentState,
  type MatchRecord,
  type PlatformDashboardData,
} from "@/lib/platform-cloud";
import { can, platformRoles, type PlatformRole } from "@/lib/platform";

export const Route = createFileRoute("/platform")({
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

type PlatformTab = "overview" | "competitions" | "capture" | "players" | "safety" | "operations";
type RunAction = <T>(action: () => Promise<T>) => Promise<T>;

const tabDefinitions: Array<[PlatformTab, LucideIcon, string]> = [
  ["overview", Gauge, "Overview"],
  ["competitions", Trophy, "Competitions"],
  ["capture", Camera, "Capture"],
  ["players", Users, "Players"],
  ["safety", ShieldCheck, "Safeguarding"],
  ["operations", Activity, "Operations"],
];

function Platform() {
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

  const reloadMemberships = useCallback(async () => {
    if (!session) return;
    setMembershipsLoading(true);
    try {
      const next = await listOrganisationMemberships();
      setMemberships(next);
      const saved = window.localStorage.getItem("criclume:selected-organisation");
      const selected = next.find((item) => item.organisationId === saved) ?? next[0] ?? null;
      setSelectedOrganisationId(selected?.organisationId ?? null);
    } finally {
      setMembershipsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) void reloadMemberships();
    else {
      setMemberships([]);
      setSelectedOrganisationId(null);
    }
  }, [reloadMemberships, session]);

  const selectOrganisation = (id: string) => {
    window.localStorage.setItem("criclume:selected-organisation", id);
    setSelectedOrganisationId(id);
  };

  if (!configured) return <ActivationGate />;
  if (sessionLoading) return <FullPageStatus title="Connecting to CricLume Cloud…" />;
  if (!session) return <SignInPanel error={sessionError} requestLink={requestLink} />;
  if (membershipsLoading) return <FullPageStatus title="Loading your organisations…" />;
  if (memberships.length === 0)
    return <OrganisationOnboarding user={session.user} onCreated={reloadMemberships} />;

  const selected =
    memberships.find((item) => item.organisationId === selectedOrganisationId) ?? memberships[0]!;
  return (
    <OperationalPlatform
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
      <main className="mx-auto flex min-h-[calc(100vh-74px)] max-w-4xl items-center px-4 py-12 md:px-8">
        <section className="w-full rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.09] via-white/[0.03] to-rose-400/[0.07] p-6 md:p-10">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300">
            <Database className="size-6" />
          </span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
            Production activation required
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-5xl">Connect the Supabase project</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Demo figures have been removed. CricLume will show only authenticated database records,
            so the production URL and publishable key must be present at build time.
          </p>
          <ol className="mt-7 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            {[
              "Apply both migrations in supabase/migrations",
              "Set VITE_SUPABASE_URL",
              "Set VITE_SUPABASE_PUBLISHABLE_KEY",
              "Configure Auth redirect URLs and production SMTP",
            ].map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-xl border border-white/10 bg-black/15 p-4"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-300 text-xs font-black text-[#1d1520]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-slate-500">
            No secret or service-role key belongs in a VITE_ variable.
          </p>
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
  return (
    <PageFrame>
      <main className="mx-auto flex min-h-[calc(100vh-74px)] max-w-xl items-center px-4 py-12">
        <form
          onSubmit={(event) => void submit(event)}
          className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-9"
        >
          <LockKeyhole className="size-9 text-amber-300" />
          <h1 className="mt-5 text-3xl font-bold">Sign in to your club or league</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            CricLume sends a secure magic link. Database row-level security applies your assigned
            role.
          </p>
          <Field label="Email address" className="mt-6">
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="scorer-input"
              placeholder="you@club.org"
            />
          </Field>
          <button
            disabled={busy}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400 text-sm font-extrabold disabled:opacity-50"
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />} Send secure link
          </button>
          {(sent || error) && (
            <p
              className={`mt-4 rounded-xl p-3 text-xs ${error ? "bg-rose-400/10 text-rose-200" : "bg-amber-300/10 text-amber-200"}`}
            >
              {error ?? "Check your inbox and return using the CricLume link."}
            </p>
          )}
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
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"club" | "league" | "school" | "academy">("club");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createOrganisation({
        name,
        kind,
        user: user as Parameters<typeof createOrganisation>[0]["user"],
      });
      await onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Organisation could not be created.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageFrame>
      <main className="mx-auto flex min-h-[calc(100vh-74px)] max-w-2xl items-center px-4 py-12">
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
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="scorer-input"
                placeholder="Riverside Cricket Club"
              />
            </Field>
            <Field label="Organisation type">
              <select
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
          {error && <ErrorNotice message={error} />}
          <button
            disabled={busy}
            className="mt-5 flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400 px-7 text-sm font-extrabold disabled:opacity-50"
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />} Create organisation
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
  const [tab, setTab] = useState<PlatformTab>("overview");
  const dashboard = usePlatformDashboard(membership.organisationId, membership.role);
  return (
    <PageFrame
      right={
        <div className="flex items-center gap-2">
          {memberships.length > 1 && (
            <select
              value={membership.organisationId}
              onChange={(event) => onSelectOrganisation(event.target.value)}
              className="h-9 max-w-48 rounded-md border border-white/10 bg-[#17111f] px-2 text-xs"
            >
              {memberships.map((item) => (
                <option key={item.organisationId} value={item.organisationId}>
                  {item.organisationName}
                </option>
              ))}
            </select>
          )}
          <Link to="/app" className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold">
            Scorer
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md bg-white/10 px-3 py-2 text-xs font-bold"
          >
            Sign out
          </button>
        </div>
      }
    >
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-9">
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
              Live organisation records protected by Postgres row-level security.
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
        <nav
          className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-1"
          aria-label="Platform sections"
        >
          {tabDefinitions.map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-xs font-bold transition ${tab === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>
        {dashboard.error && <ErrorNotice message={dashboard.error} />}
        {dashboard.loading || !dashboard.data ? (
          <FullPanelStatus title="Loading operational data…" />
        ) : (
          <>
            {tab === "overview" && (
              <Overview data={dashboard.data} role={membership.role} run={dashboard.run} />
            )}
            {tab === "competitions" && (
              <Competitions data={dashboard.data} role={membership.role} run={dashboard.run} />
            )}
            {tab === "capture" && (
              <Capture data={dashboard.data} role={membership.role} run={dashboard.run} />
            )}
            {tab === "players" && (
              <Players data={dashboard.data} role={membership.role} run={dashboard.run} />
            )}
            {tab === "safety" && (
              <Safeguarding data={dashboard.data} role={membership.role} run={dashboard.run} />
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
      </main>
    </PageFrame>
  );
}

function Overview({
  data,
  role,
  run,
}: {
  data: PlatformDashboardData;
  role: PlatformRole;
  run: RunAction;
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([Icon, label, value, detail]) => (
          <MetricCard key={label} icon={Icon} label={label} value={value} detail={detail} />
        ))}
      </div>
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
  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
          oversPerInnings: Number(overs),
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
    <article className="rounded-xl border border-white/10 bg-black/15 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusBadge value={match.status} />
          <h3 className="mt-2 text-lg font-bold">
            {teamName(data, match.homeTeamId)} v {teamName(data, match.awayTeamId)}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {groundName(data, match.groundId)} · {formatDate(match.scheduledAt)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            {runs}/{wickets}
          </div>
          <div className="text-xs text-slate-500">{overs} ov</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`/app?cloudMatch=${match.id}`} className="action-primary">
          Open scorer <ChevronRight className="size-3.5" />
        </a>
        {match.scoreboard?.enabled && (
          <a href={`/scoreboard/${match.scoreboard.slug}`} className="action-secondary">
            Public board <ExternalLink className="size-3.5" />
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

function Competitions({
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
      {can(role, "competition.manage") && <CompetitionForm data={data} run={run} />}
      {can(role, "fixtures.manage") && <FixtureForm data={data} run={run} />}
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
                  <span className="text-xs text-amber-200">
                    {
                      data.fixtures.filter((fixture) => fixture.competitionId === competition.id)
                        .length
                    }{" "}
                    fixtures
                  </span>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {data.fixtures
                    .filter((fixture) => fixture.competitionId === competition.id)
                    .map((fixture) => (
                      <div
                        key={fixture.id}
                        className="rounded-lg border border-white/8 bg-black/10 p-3"
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
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await run(() =>
        createCompetition({
          organisationId: data.organisationId,
          name,
          format,
          seasonName: season,
          oversPerInnings: Number(overs),
          inningsPerSide: 1,
          ballsPerOver: 6,
        }),
      );
      setName("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Create competition"
      description="Creates the season, competition and immutable rule version together."
    >
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-4">
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
            value={overs}
            onChange={(event) => setOvers(event.target.value)}
            className="scorer-input"
          />
        </Field>
        <button disabled={busy} className="action-primary md:col-span-4 md:justify-self-end">
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
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!competition) return;
    setBusy(true);
    try {
      await run(() =>
        createFixture({
          competition,
          homeTeamId: home,
          awayTeamId: away,
          groundId: ground,
          startsAt,
          roundName: round,
        }),
      );
      setRound("");
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
          </Field>
          <Field label="Round">
            <input
              value={round}
              onChange={(event) => setRound(event.target.value)}
              className="scorer-input"
              placeholder="Round 1"
            />
          </Field>
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
                  <span className="text-sm font-bold text-amber-200">
                    {room.devices.length}/{room.maxDevices}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {room.devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs"
                    >
                      <span>
                        {device.label} · {device.angle.replaceAll("_", " ")}
                      </span>
                      <span className="text-slate-500">{device.clockOffsetMs} ms</span>
                    </div>
                  ))}
                </div>
                <a
                  href={`/camera/${room.id}`}
                  className="mt-3 inline-flex text-xs font-bold text-amber-200"
                >
                  Open room
                </a>
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
      const url = await run(() => createCheckout({ organisationId, priceId }));
      window.location.assign(url);
    } finally {
      setBusy(false);
    }
  };
  const integrations = [
    [Database, "Supabase / Postgres", "Connected", true],
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
      {can(role, "members.manage") && (
        <Panel
          title="Invite member"
          description="The Edge Function sends an Auth invitation and records the organisation role."
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
              options={platformRoles
                .filter((item) => item !== "owner")
                .map((item) => [item, item.replaceAll("_", " ")])}
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
            {data.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2 text-xs"
              >
                <span className="font-bold">{member.displayName}</span>
                <span className="text-slate-500">
                  {member.role.replaceAll("_", " ")} · {member.status}
                </span>
              </div>
            ))}
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
              disabled={!priceId || busy}
              onClick={() => void checkout()}
              className="action-primary mt-4"
            >
              Manage subscription
            </button>
          )}
          {!priceId && (
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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f0d17]/95 px-4 py-3 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="CricLume home">
              <img src={logoAsset.url} alt="CricLume" className="h-9 w-auto md:h-11" />
            </Link>
            <span className="hidden rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200 sm:inline">
              Cloud control centre
            </span>
          </div>
          {right}
        </div>
      </header>
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
    <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300">
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
