import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  FileCheck2,
  Gauge,
  LockKeyhole,
  Mail,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRoundCheck,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import logoAsset from "@/assets/criclume-logo-header.png.asset.json";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { listOrganisationMemberships, type OrganisationMembership } from "@/lib/cloud";
import {
  calculateCompetitionTable,
  can,
  platformRoles,
  type CompetitionRules,
} from "@/lib/platform";

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

const competitionRules: CompetitionRules = {
  version: 3,
  ballsPerOver: 6,
  oversPerInnings: 20,
  inningsPerSide: 1,
  points: { win: 4, tie: 2, noResult: 2, loss: 0 },
  tieBreakers: ["points", "wins", "net-run-rate"],
  rainRule: {
    provider: "Authorised provider required",
    method: "Competition-selected method",
    edition: "Version controlled",
    parameters: {},
  },
};

const demoTable = calculateCompetitionTable(
  ["Riverside CC", "Northfield CC", "St Anne's School", "Kingston Academy"],
  [
    {
      id: "f1",
      homeTeamId: "Riverside CC",
      awayTeamId: "Northfield CC",
      status: "completed",
      winnerTeamId: "Riverside CC",
      homeRuns: 162,
      homeLegalBalls: 120,
      awayRuns: 151,
      awayLegalBalls: 120,
    },
    {
      id: "f2",
      homeTeamId: "St Anne's School",
      awayTeamId: "Kingston Academy",
      status: "completed",
      winnerTeamId: "Kingston Academy",
      homeRuns: 119,
      homeLegalBalls: 114,
      awayRuns: 120,
      awayLegalBalls: 101,
    },
    {
      id: "f3",
      homeTeamId: "Northfield CC",
      awayTeamId: "St Anne's School",
      status: "abandoned",
      noResult: true,
    },
  ],
  competitionRules,
);

function Platform() {
  const { configured, session, loading, error, requestLink, signOut } = useCloudSession();
  const [tab, setTab] = useState<PlatformTab>("overview");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [memberships, setMemberships] = useState<OrganisationMembership[]>([]);

  useEffect(() => {
    if (!session) return;
    void listOrganisationMemberships()
      .then(setMemberships)
      .catch(() => setMemberships([]));
  }, [session]);

  const organisation = memberships[0];

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    await requestLink(email.trim());
    setSent(true);
  };

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
          <div className="flex items-center gap-2">
            <Link
              to="/app"
              className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
            >
              Open scorer
            </Link>
            {session && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-md bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-9">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
              <span
                className={`size-2 rounded-full ${configured ? "bg-rose-400" : "bg-amber-300"}`}
              />
              {configured
                ? "Supabase connection configured"
                : "Demo data · connect services to activate"}
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              {organisation?.organisationName ?? "CricLume operations"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              One secure place for clubs, leagues, live matches, camera crews, coaching, player
              history and competition administration.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill icon={LockKeyhole} label="RLS protected" />
            <StatusPill icon={Radio} label="Realtime ready" />
            <StatusPill icon={ShieldCheck} label="Consent gated" />
          </div>
        </div>

        {configured && !session && !loading && (
          <section className="mb-6 rounded-xl border border-rose-300/20 bg-rose-400/[0.07] p-5">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h2 className="text-xl font-bold">Sign in to your club or league</h2>
                <p className="mt-1 text-sm text-slate-400">
                  We send a secure link. Your role controls exactly what you can see and change.
                </p>
              </div>
              <form
                onSubmit={(event) => void submitLogin(event)}
                className="flex min-w-0 gap-2 sm:min-w-[430px]"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@club.org"
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-amber-300/60"
                />
                <button className="rounded-md bg-gradient-to-r from-rose-500 to-amber-400 px-4 py-2.5 text-sm font-bold text-white">
                  Send link
                </button>
              </form>
            </div>
            {(sent || error) && (
              <p className={`mt-3 text-xs ${error ? "text-rose-300" : "text-amber-200"}`}>
                {error ?? "Check your inbox for the CricLume sign-in link."}
              </p>
            )}
          </section>
        )}

        <nav
          className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-1"
          aria-label="Platform sections"
        >
          {(
            [
              ["overview", Gauge, "Overview"],
              ["competitions", Trophy, "Competitions"],
              ["capture", Camera, "Capture"],
              ["players", Users, "Players"],
              ["safety", ShieldCheck, "Safeguarding"],
              ["operations", Activity, "Operations"],
            ] as Array<[PlatformTab, LucideIcon, string]>
          ).map(([value, Icon, label]) => (
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

        {tab === "overview" && (
          <Overview configured={configured} sessionEmail={session?.user.email} />
        )}
        {tab === "competitions" && <Competitions />}
        {tab === "capture" && <Capture />}
        {tab === "players" && <Players />}
        {tab === "safety" && <Safeguarding />}
        {tab === "operations" && <Operations configured={configured} />}
      </main>
    </div>
  );
}

function StatusPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300">
      <Icon className="size-3.5 text-amber-300" />
      {label}
    </span>
  );
}

function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
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

function Overview({
  configured,
  sessionEmail,
}: {
  configured: boolean;
  sessionEmail: string | undefined;
}) {
  const cards = [
    [Radio, "Live matches", "3", "2 scoring · 1 scheduled"],
    [Camera, "Camera angles", "4", "All synchronized"],
    [Users, "Registered players", "284", "18 junior profiles"],
    [FileCheck2, "Audit findings", "7", "Require human review"],
  ] as const;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([Icon, label, value, detail]) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">{label}</span>
              <Icon className="size-4 text-amber-300" />
            </div>
            <div className="mt-4 text-3xl font-bold">{value}</div>
            <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <Panel
          title="Live now"
          description="Scores update across authorized phones and the public scoreboard."
        >
          <div className="rounded-lg border border-rose-300/20 bg-gradient-to-r from-rose-500/10 to-amber-300/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">
                  Live · 14.3 overs
                </div>
                <h3 className="mt-1 text-xl font-bold">Riverside CC v Northfield CC</h3>
              </div>
              <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black uppercase">
                Live
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400">Riverside CC</div>
                <div className="mt-1 text-4xl font-bold">128/4</div>
              </div>
              <div className="border-l border-white/10 pl-4">
                <div className="text-xs text-slate-400">Current pair</div>
                <div className="mt-1 text-sm font-bold">A. Morgan 44* · J. Patel 18*</div>
                <div className="mt-2 text-xs text-slate-400">R. Singh 2/24 (3.3)</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/app"
                className="rounded-md bg-white px-3 py-2 text-xs font-bold text-[#160f18]"
              >
                Open scorer
              </Link>
              <Link
                to="/scoreboard/$slug"
                params={{ slug: "demo" }}
                className="rounded-md border border-white/15 px-3 py-2 text-xs font-bold"
              >
                View public board
              </Link>
            </div>
          </div>
        </Panel>
        <Panel
          title="Cloud account"
          description="Live access is controlled by your organisation membership."
        >
          <div className="space-y-3 text-sm">
            <Row
              label="Backend"
              value={configured ? "Configured" : "Awaiting environment"}
              ok={configured}
            />
            <Row
              label="Session"
              value={sessionEmail ?? (configured ? "Sign in required" : "Demo mode")}
              ok={Boolean(sessionEmail)}
            />
            <Row label="Access" value="Postgres row-level security" ok />
            <Row label="Scoring events" value="Immutable + idempotent" ok />
            <Row label="Offline recovery" value="On-device event queue" ok />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-400">{label}</span>
      <span className="flex items-center gap-1.5 text-right text-xs font-bold">
        {ok && <Check className="size-3.5 text-amber-300" />}
        {value}
      </span>
    </div>
  );
}

function Competitions() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Panel
        title="Premier Division table"
        description={`Rule pack v${competitionRules.version} · points, tie-breakers and NRR are rebuilt from signed results.`}
        action={
          <button className="rounded-md bg-white/10 px-3 py-2 text-xs font-bold">
            Configure rules
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                {["Team", "P", "W", "T", "L", "NR", "Pts", "NRR"].map((heading) => (
                  <th key={heading} className="border-b border-white/10 px-2 py-2 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demoTable.map((row, index) => (
                <tr key={row.teamId} className="border-b border-white/5 last:border-0">
                  <td className="px-2 py-3 font-bold">
                    <span className="mr-2 text-slate-500">{index + 1}</span>
                    {row.teamId}
                  </td>
                  <td className="px-2">{row.played}</td>
                  <td className="px-2">{row.won}</td>
                  <td className="px-2">{row.tied}</td>
                  <td className="px-2">{row.lost}</td>
                  <td className="px-2">{row.noResult}</td>
                  <td className="px-2 font-bold text-amber-200">{row.points}</td>
                  <td className="px-2">{row.netRunRate.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Upcoming fixtures"
        description="Venue, team and blackout constraints are stored with the schedule."
      >
        <div className="space-y-3">
          {[
            ["Sat 29 Aug · 13:00", "Riverside CC", "Kingston Academy", "Meadow Ground"],
            ["Sun 30 Aug · 11:00", "Northfield CC", "St Anne's School", "Northfield Oval"],
            ["Wed 2 Sep · 17:30", "Kingston Academy", "Northfield CC", "Academy Ground"],
          ].map(([date, home, away, ground]) => (
            <div key={date} className="rounded-lg border border-white/8 bg-black/10 p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                <CalendarDays className="size-3" />
                {date}
              </div>
              <div className="mt-2 text-sm font-bold">
                {home} <span className="text-slate-500">v</span> {away}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{ground}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Capture() {
  const devices = [
    ["Pavilion end", "iPhone 17", "Recording", "96%", "18 ms"],
    ["Far end", "Pixel 11", "Recording", "81%", "24 ms"],
    ["Off side", "Galaxy S27", "Ready", "74%", "31 ms"],
    ["Leg side", "iPhone 16", "Ready", "68%", "27 ms"],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <Panel
        title="Match camera room"
        description="Pair up to eight signed-in phones. Clock offsets align clips with scoring events."
        action={
          <button className="rounded-md bg-gradient-to-r from-rose-500 to-amber-400 px-3 py-2 text-xs font-bold">
            Create room
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.map(([angle, phone, status, battery, offset]) => (
            <div key={angle} className="rounded-lg border border-white/10 bg-black/15 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${status === "Recording" ? "animate-pulse bg-rose-400" : "bg-amber-300"}`}
                  />
                  <span className="text-sm font-bold">{angle}</span>
                </div>
                <span className="text-[10px] font-bold uppercase text-slate-400">{status}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                <span>{phone}</span>
                <span>{battery} battery</span>
                <span>{offset} offset</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        title="Video pipeline"
        description="Resumable upload, integrity check, retention and processing are tracked separately."
      >
        <div className="space-y-3">
          {[
            [Cloud, "Resumable source upload", "TUS · 6 MB chunks"],
            [Database, "Private object storage", "RLS + signed URLs"],
            [Video, "Transcode and proxy", "Provider adapter"],
            [ShieldCheck, "Consent and retention", "Fail closed"],
          ].map(([Icon, title, detail]) => {
            const ItemIcon = Icon as LucideIcon;
            return (
              <div
                key={title as string}
                className="flex items-center gap-3 rounded-lg border border-white/8 p-3"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-amber-300/10">
                  <ItemIcon className="size-4 text-amber-300" />
                </span>
                <div>
                  <div className="text-xs font-bold">{title as string}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{detail as string}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function Players() {
  const players = [
    {
      name: "A. Morgan",
      team: "Riverside CC",
      bat: "1,284 runs · 34.8 avg",
      bowl: "8 wickets",
      field: "21 catches",
    },
    {
      name: "R. Singh",
      team: "Northfield CC",
      bat: "436 runs · 18.2 avg",
      bowl: "67 wickets · 5.42 econ",
      field: "14 catches",
    },
    {
      name: "J. Patel",
      team: "Riverside CC",
      bat: "976 runs · 31.5 avg",
      bowl: "22 wickets",
      field: "9 catches · 4 run outs",
    },
    {
      name: "M. Davies",
      team: "St Anne's School",
      bat: "522 runs · 27.4 avg",
      bowl: "31 wickets",
      field: "12 catches",
    },
  ];
  return (
    <Panel
      title="Player career histories"
      description="Batting, bowling and fielding records aggregate from consented, linked delivery records."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {players.map((player) => (
          <div key={player.name} className="rounded-lg border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-bold">{player.name}</div>
                <div className="text-[11px] text-slate-500">{player.team}</div>
              </div>
              <UserRoundCheck className="size-5 text-amber-300" />
            </div>
            <div className="mt-4 grid gap-2 text-xs">
              <Row label="Batting" value={player.bat} />
              <Row label="Bowling" value={player.bowl} />
              <Row label="Fielding" value={player.field} />
            </div>
            <button className="mt-4 flex items-center gap-1 text-[11px] font-bold text-amber-200">
              Open analysis <ChevronRight className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Safeguarding() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel
        title="Consent register"
        description="Recording, coaching analysis, public highlights and biometric processing are separate permissions."
      >
        <div className="space-y-3">
          {[
            ["Recording consent", "276 granted · 8 pending", true],
            ["Coaching analysis", "251 granted · 33 restricted", true],
            ["Public highlights", "198 granted · 86 restricted", false],
            ["Biometric identification", "Disabled for juniors", true],
          ].map(([label, value, ok]) => (
            <Row
              key={label as string}
              label={label as string}
              value={value as string}
              ok={ok as boolean}
            />
          ))}
        </div>
      </Panel>
      <Panel
        title="Junior media policy"
        description="Public release is blocked until the club safeguarding officer confirms the decision."
      >
        <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.06] p-4 text-sm leading-6 text-slate-300">
          <ShieldCheck className="mb-3 size-6 text-amber-300" />
          Junior clips default to private, carry a maximum 90-day retention window, never enable
          public identity recognition, and can require face or full-person blurring before export.
        </div>
        <div className="mt-4 space-y-2 text-xs">
          <Row label="Awaiting consent" value="8 players" />
          <Row label="Awaiting public review" value="5 clips" />
          <Row label="Retention deletion due" value="12 assets this week" />
        </div>
      </Panel>
    </div>
  );
}

function Operations({ configured }: { configured: boolean }) {
  const integrations = [
    [
      Database,
      "Supabase / Postgres",
      configured ? "Configured" : "Environment required",
      configured,
    ],
    [CircleDollarSign, "Stripe Billing", "Secret + webhook required", false],
    [Mail, "Transactional email", "Custom SMTP/provider required", false],
    [Video, "Video transcoding", "Provider endpoint required", false],
    [Sparkles, "AI analysis", "Provider endpoint required", false],
    [FileCheck2, "Licensed rain rules", "Commercial provider required", false],
  ] as const;
  const roleSummary = useMemo(
    () =>
      platformRoles.map((role) => ({
        role,
        score: can(role, "match.score"),
        billing: can(role, "billing.manage"),
        private: can(role, "player.private_data"),
      })),
    [],
  );
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
      <Panel
        title="Permission audit"
        description="The UI mirrors the database policy, but Postgres RLS remains authoritative."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="border-b border-white/10 px-2 py-2">Role</th>
                <th className="border-b border-white/10 px-2 py-2">Score</th>
                <th className="border-b border-white/10 px-2 py-2">Billing</th>
                <th className="border-b border-white/10 px-2 py-2">Private player data</th>
              </tr>
            </thead>
            <tbody>
              {roleSummary.map((row) => (
                <tr key={row.role} className="border-b border-white/5">
                  <td className="px-2 py-3 font-bold capitalize">
                    {row.role.replaceAll("_", " ")}
                  </td>
                  {[row.score, row.billing, row.private].map((allowed, index) => (
                    <td key={index} className="px-2">
                      {allowed ? (
                        <Check className="size-4 text-amber-300" />
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Monitoring">
          <div className="text-2xl font-bold text-amber-200">99.98%</div>
          <p className="mt-1 text-xs text-slate-500">Target service availability</p>
        </Panel>
        <Panel title="Backups">
          <div className="text-2xl font-bold">Daily + PITR</div>
          <p className="mt-1 text-xs text-slate-500">Restore drills recorded separately</p>
        </Panel>
        <Panel title="Security">
          <div className="text-2xl font-bold">0 critical</div>
          <p className="mt-1 text-xs text-slate-500">Dependency and RLS checks in CI</p>
        </Panel>
      </div>
    </div>
  );
}
