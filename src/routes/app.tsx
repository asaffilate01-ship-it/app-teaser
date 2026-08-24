import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  CloudOff,
  Download,
  FileVideo,
  Flag,
  Gauge,
  History,
  ListPlus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Trophy,
  Undo2,
  Users,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import { useCricketStore } from "@/hooks/use-cricket-store";
import {
  battingCard,
  bowlingCard,
  createMatch,
  currentInnings,
  deliveryLabel,
  deliveryRuns,
  endCurrentInnings,
  findPlayer,
  findTeam,
  recordDelivery,
  startNextInnings,
  summarizeInnings,
  targetForCurrentInnings,
  undoLastDelivery,
  type CricketMatch,
  type DeliveryEnd,
  type DeliveryStyle,
  type DismissalType,
  type Extras,
  type FieldZone,
  type MatchFormat,
  type RecordDeliveryInput,
  type ShotOutcome,
} from "@/lib/cricket";
import logoAsset from "@/assets/criclume-logo-header.png.asset.json";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "CricLume Scorer — Ball-by-ball cricket scoring" },
      {
        name: "description",
        content:
          "Create a match and record every delivery, outcome, field location, fielder and dismissal.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CricketApp,
});

type AppScreen = "dashboard" | "setup" | "match";
type MatchTab = "score" | "timeline" | "scorecard" | "analysis" | "video";

const defaultHomePlayers = [
  "A. Morgan",
  "J. Patel",
  "S. Williams",
  "T. Khan",
  "M. Davies",
  "R. Singh",
  "L. Brown",
  "D. Clarke",
  "N. Shah",
  "P. Evans",
  "K. James",
].join("\n");

const defaultAwayPlayers = [
  "O. Smith",
  "B. Taylor",
  "C. Ahmed",
  "H. Wilson",
  "F. Ali",
  "G. Thomas",
  "I. Roberts",
  "E. Walker",
  "V. Kumar",
  "W. Jones",
  "Y. Lewis",
].join("\n");

const fieldZones: FieldZone[] = [
  "Fine leg",
  "Square leg",
  "Mid-wicket",
  "Long on",
  "Straight",
  "Long off",
  "Cover",
  "Point",
  "Third",
  "Keeper",
  "Bowler",
  "Not recorded",
];

const deliveryStyles: DeliveryStyle[] = [
  "Fast",
  "Medium",
  "Off spin",
  "Leg spin",
  "Left-arm spin",
  "Other",
];

const dismissalTypes: { value: DismissalType; label: string }[] = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "stumped", label: "Stumped" },
  { value: "run-out", label: "Run out" },
  { value: "hit-wicket", label: "Hit wicket" },
  { value: "obstructing-the-field", label: "Obstructing the field" },
];

function CricketApp() {
  const { matches, loaded, upsertMatch, removeMatch } = useCricketStore();
  const [screen, setScreen] = useState<AppScreen>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedMatch = matches.find((match) => match.id === selectedId);

  const openMatch = (id: string) => {
    setSelectedId(id);
    setScreen("match");
  };

  return (
    <div className="min-h-screen bg-[#0f0d17] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f0d17]/95 px-4 py-3 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {screen !== "dashboard" && (
              <button
                type="button"
                onClick={() => setScreen(screen === "match" ? "dashboard" : "dashboard")}
                className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5"
                aria-label="Back to matches"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <Link to="/" aria-label="CricLume home">
              <img src={logoAsset.url} alt="CricLume" className="h-9 w-auto md:h-11" />
            </Link>
            <span className="hidden rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200 sm:inline">
              Scorer preview
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CloudOff className="size-3.5 text-amber-300" />
            <span className="hidden sm:inline">Saved on this device</span>
          </div>
        </div>
      </header>

      {!loaded ? (
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-400">
          Loading scorer…
        </div>
      ) : screen === "setup" ? (
        <MatchSetup
          onCancel={() => setScreen("dashboard")}
          onCreate={(match) => {
            upsertMatch(match);
            openMatch(match.id);
          }}
        />
      ) : screen === "match" && selectedMatch ? (
        <LiveMatch
          match={selectedMatch}
          onSave={upsertMatch}
          onExit={() => setScreen("dashboard")}
        />
      ) : (
        <Dashboard
          matches={matches}
          onNew={() => setScreen("setup")}
          onOpen={openMatch}
          onDelete={removeMatch}
        />
      )}
    </div>
  );
}

function Dashboard({
  matches,
  onNew,
  onOpen,
  onDelete,
}: {
  matches: CricketMatch[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <section className="grid gap-6 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#2a1427] via-[#17111f] to-[#2b220e] p-6 shadow-2xl md:grid-cols-[1fr_auto] md:items-end md:p-10">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-amber-300">
            <CircleDot className="size-4" /> Match centre
          </span>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-none md:text-6xl">
            Score every ball.
            <br />
            Keep every detail.
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
            Start a match, select the players and record runs, extras, dismissals, field zones and
            fielders. Every entry is timestamped and kept on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400 px-7 text-sm font-extrabold uppercase tracking-[0.1em] text-white shadow-lg shadow-rose-950/40"
        >
          <Plus className="size-5" /> New match
        </button>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">
              On this device
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold md:text-3xl">Your matches</h2>
          </div>
          <span className="text-sm text-slate-400">{matches.length} saved</span>
        </div>

        {matches.length === 0 ? (
          <button
            type="button"
            onClick={onNew}
            className="flex min-h-64 w-full flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center transition hover:border-amber-300/40 hover:bg-white/[0.05]"
          >
            <span className="flex size-16 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300">
              <ListPlus className="size-7" />
            </span>
            <span>
              <strong className="block text-lg">Create your first match</strong>
              <span className="mt-1 block text-sm text-slate-400">
                It takes about a minute to add both line-ups.
              </span>
            </span>
          </button>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => {
              const innings = currentInnings(match);
              const summary = summarizeInnings(innings, match.settings.ballsPerOver);
              const batting = findTeam(match, innings.battingTeamId);
              const bowling = findTeam(match, innings.bowlingTeamId);
              return (
                <article
                  key={match.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.045] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                      {match.status.replace("-", " ")}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(match.id)}
                      className="text-slate-500 transition hover:text-rose-300"
                      aria-label={`Delete ${batting.name} versus ${bowling.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold">
                    {batting.name} v {bowling.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {match.settings.ground || "Ground not set"} • {match.settings.format}
                  </p>
                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <span className="font-display text-4xl font-bold">
                        {summary.runs}/{summary.wickets}
                      </span>
                      <span className="ml-2 text-sm text-slate-400">({summary.overs})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpen(match.id)}
                      className="flex size-11 items-center justify-center rounded-full bg-amber-300 text-[#1d1520]"
                      aria-label="Open match"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          [ShieldCheck, "No account needed", "Start scoring immediately"],
          [CloudOff, "Offline-first", "Ground signal is optional"],
          [Download, "Portable data", "Export-ready match records"],
        ].map(([Icon, title, body]) => {
          const FeatureIcon = Icon as typeof ShieldCheck;
          return (
            <div
              key={String(title)}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <FeatureIcon className="mt-0.5 size-5 shrink-0 text-amber-300" />
              <div>
                <p className="text-sm font-bold">{String(title)}</p>
                <p className="text-xs text-slate-400">{String(body)}</p>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function MatchSetup({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (match: CricketMatch) => void;
}) {
  const [format, setFormat] = useState<MatchFormat>("T20");
  const [overs, setOvers] = useState("20");
  const [inningsPerSide, setInningsPerSide] = useState<1 | 2>(1);
  const [homeName, setHomeName] = useState("Riverside CC");
  const [awayName, setAwayName] = useState("Northgate CC");
  const [homePlayers, setHomePlayers] = useState(defaultHomePlayers);
  const [awayPlayers, setAwayPlayers] = useState(defaultAwayPlayers);
  const [battingFirst, setBattingFirst] = useState<"home" | "away">("home");
  const [ground, setGround] = useState("The Riverside Ground");
  const [weather, setWeather] = useState("Dry, light cloud");
  const [error, setError] = useState("");

  const changeFormat = (next: MatchFormat) => {
    setFormat(next);
    const presets: Partial<Record<MatchFormat, string>> = {
      T10: "10",
      T20: "20",
      ODI: "50",
      School: "20",
      Club: "40",
    };
    if (next === "Multi-day") {
      setOvers("");
      setInningsPerSide(2);
    } else {
      setOvers(presets[next] ?? (overs || "20"));
      setInningsPerSide(1);
    }
  };

  const submit = () => {
    const homeLineup = homePlayers
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);
    const awayLineup = awayPlayers
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);
    if (!homeName.trim() || !awayName.trim() || homeLineup.length < 2 || awayLineup.length < 2) {
      setError("Add both team names and at least two players for each team.");
      return;
    }
    onCreate(
      createMatch({
        homeTeamName: homeName,
        awayTeamName: awayName,
        homePlayers: homeLineup,
        awayPlayers: awayLineup,
        battingFirst,
        settings: {
          format,
          oversPerInnings: overs ? Math.max(1, Number(overs)) : null,
          inningsPerSide,
          ballsPerOver: 6,
          ground: ground.trim(),
          weather: weather.trim(),
          startTime: new Date().toISOString(),
        },
      }),
    );
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">Match setup</p>
        <h1 className="mt-1 font-display text-4xl font-bold md:text-5xl">Set the game up once</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          The start time is automatic. You can change the striker, bowler and end at any point while
          scoring.
        </p>
      </div>

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-2 md:p-8">
        <Field label="Format">
          <select
            value={format}
            onChange={(event) => changeFormat(event.target.value as MatchFormat)}
            className="scorer-input"
          >
            {["T10", "T20", "ODI", "School", "Club", "Multi-day", "Custom"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Overs / innings">
            <input
              value={overs}
              disabled={format === "Multi-day"}
              onChange={(event) => setOvers(event.target.value)}
              type="number"
              min="1"
              className="scorer-input disabled:opacity-40"
              placeholder="No limit"
            />
          </Field>
          <Field label="Innings / side">
            <select
              value={inningsPerSide}
              onChange={(event) => setInningsPerSide(Number(event.target.value) as 1 | 2)}
              className="scorer-input"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </Field>
        </div>
        <Field label="Ground">
          <input
            value={ground}
            onChange={(event) => setGround(event.target.value)}
            className="scorer-input"
          />
        </Field>
        <Field label="Weather">
          <input
            value={weather}
            onChange={(event) => setWeather(event.target.value)}
            className="scorer-input"
          />
        </Field>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {[
          {
            side: "home" as const,
            title: "Home team",
            name: homeName,
            setName: setHomeName,
            players: homePlayers,
            setPlayers: setHomePlayers,
          },
          {
            side: "away" as const,
            title: "Away team",
            name: awayName,
            setName: setAwayName,
            players: awayPlayers,
            setPlayers: setAwayPlayers,
          },
        ].map((team) => (
          <div
            key={team.side}
            className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-7"
          >
            <div className="flex items-center gap-3">
              <Users className="size-5 text-amber-300" />
              <h2 className="font-display text-xl font-bold">{team.title}</h2>
            </div>
            <Field label="Team name">
              <input
                value={team.name}
                onChange={(event) => team.setName(event.target.value)}
                className="scorer-input"
              />
            </Field>
            <Field label="Playing XI — one player per line">
              <textarea
                value={team.players}
                onChange={(event) => team.setPlayers(event.target.value)}
                rows={11}
                className="scorer-input min-h-60 py-3 leading-7"
              />
            </Field>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${battingFirst === team.side ? "border-amber-300/60 bg-amber-300/10" : "border-white/10"}`}
            >
              <input
                type="radio"
                checked={battingFirst === team.side}
                onChange={() => setBattingFirst(team.side)}
                className="accent-amber-300"
              />
              <span className="text-sm font-bold">Batting first</span>
            </label>
          </div>
        ))}
      </section>

      {error && (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 rounded-full border border-white/15 px-7 text-sm font-bold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400 px-8 text-sm font-extrabold uppercase tracking-wider text-white"
        >
          <Play className="size-4" /> Start scoring
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function LiveMatch({
  match,
  onSave,
  onExit,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch) => void;
  onExit: () => void;
}) {
  const [tab, setTab] = useState<MatchTab>("score");
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  const battingTeam = findTeam(match, innings.battingTeamId);
  const bowlingTeam = findTeam(match, innings.bowlingTeamId);
  const target = targetForCurrentInnings(match);

  const exportMatch = () => {
    const blob = new Blob([JSON.stringify(match, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${battingTeam.name}-v-${bowlingTeam.name}.criclume.json`
      .replaceAll(" ", "-")
      .toLowerCase();
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto w-full max-w-7xl pb-28 md:px-8 md:py-8">
      <section className="border-b border-white/10 bg-gradient-to-br from-[#2c1429] via-[#17111f] to-[#2a210e] px-4 py-6 md:rounded-3xl md:border md:px-8 md:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-amber-300">
              <span className="rounded-full bg-rose-500/20 px-2 py-1 text-rose-300">
                {match.status.replace("-", " ")}
              </span>
              <span>Innings {innings.number}</span>
              <span>•</span>
              <span>{match.settings.format}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold md:text-4xl">
              {battingTeam.name} <span className="text-slate-500">v</span> {bowlingTeam.name}
            </h1>
            <p className="mt-1 text-xs text-slate-400 md:text-sm">
              {match.settings.ground} • {match.settings.weather}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-5xl font-bold md:text-6xl">
              {summary.runs}
              <span className="text-2xl text-slate-400">/{summary.wickets}</span>
            </p>
            <p className="text-xs text-slate-400">
              {summary.overs} overs • RR {summary.runRate.toFixed(2)}
              {target ? ` • Target ${target}` : ""}
            </p>
          </div>
        </div>
      </section>

      <nav className="no-scrollbar sticky top-[65px] z-30 flex gap-1 overflow-x-auto border-b border-white/10 bg-[#0f0d17]/95 px-3 py-2 backdrop-blur-xl md:top-[77px] md:mt-4 md:rounded-2xl md:border md:px-2">
        {[
          ["score", Gauge, "Score"],
          ["timeline", History, "Timeline"],
          ["scorecard", Trophy, "Scorecard"],
          ["analysis", BarChart3, "Analysis"],
          ["video", Video, "Video lab"],
        ].map(([id, Icon, label]) => {
          const TabIcon = Icon as typeof Gauge;
          return (
            <button
              key={String(id)}
              type="button"
              onClick={() => setTab(id as MatchTab)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ${tab === id ? "bg-amber-300 text-[#1d1520]" : "text-slate-400"}`}
            >
              <TabIcon className="size-4" />
              {String(label)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={exportMatch}
          className="ml-auto flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-400"
        >
          <Download className="size-4" /> Export
        </button>
      </nav>

      <div className="px-4 py-5 md:px-0">
        {tab === "score" && <ScoringPad match={match} onSave={onSave} onExit={onExit} />}
        {tab === "timeline" && <Timeline match={match} />}
        {tab === "scorecard" && <Scorecard match={match} />}
        {tab === "analysis" && <Analysis match={match} />}
        {tab === "video" && <VideoLab />}
      </div>
    </main>
  );
}

function ScoringPad({
  match,
  onSave,
  onExit,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch) => void;
  onExit: () => void;
}) {
  const innings = currentInnings(match);
  const battingTeam = findTeam(match, innings.battingTeamId);
  const bowlingTeam = findTeam(match, innings.bowlingTeamId);
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  const [strikerId, setStrikerId] = useState(innings.strikerId);
  const [nonStrikerId, setNonStrikerId] = useState(innings.nonStrikerId);
  const [bowlerId, setBowlerId] = useState(innings.bowlerId);
  const [end, setEnd] = useState<DeliveryEnd>(innings.end);
  const [deliveryStyle, setDeliveryStyle] = useState<DeliveryStyle>("Medium");
  const [outcome, setOutcome] = useState<ShotOutcome>("hit-no-run");
  const [fieldZone, setFieldZone] = useState<FieldZone>("Not recorded");
  const [fielderId, setFielderId] = useState("");
  const [note, setNote] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [detailBatterRuns, setDetailBatterRuns] = useState(0);
  const [detailExtras, setDetailExtras] = useState<Extras>({
    wide: 0,
    noBall: 0,
    bye: 0,
    legBye: 0,
    penalty: 0,
  });
  const [showWicket, setShowWicket] = useState(false);
  const [dismissalType, setDismissalType] = useState<DismissalType>("bowled");
  const [dismissedBatterId, setDismissedBatterId] = useState(innings.strikerId);
  const [dismissalFielderId, setDismissalFielderId] = useState("");
  const invalidDetailedExtras = detailExtras.wide > 0 && detailExtras.noBall > 0;

  useEffect(() => {
    setStrikerId(innings.strikerId);
    setNonStrikerId(innings.nonStrikerId);
    setBowlerId(innings.bowlerId);
    setEnd(innings.end);
    setDismissedBatterId(innings.strikerId);
  }, [
    innings.id,
    innings.deliveries.length,
    innings.strikerId,
    innings.nonStrikerId,
    innings.bowlerId,
    innings.end,
  ]);

  const saveBall = (partial: Partial<RecordDeliveryInput>) => {
    const input: RecordDeliveryInput = {
      strikerId,
      nonStrikerId,
      bowlerId,
      end,
      deliveryStyle,
      outcome,
      batterRuns: 0,
      fieldZone,
      fielderId: fielderId || undefined,
      note,
      ...partial,
    };
    onSave(recordDelivery(match, input));
    setNote("");
  };

  const resetDetailedRuns = () => {
    setDetailBatterRuns(0);
    setDetailExtras({ wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 });
  };

  const saveDetailedBall = () => {
    saveBall({
      batterRuns: detailBatterRuns,
      extras: detailExtras,
      outcome: detailBatterRuns ? "hit" : outcome,
    });
    resetDetailedRuns();
  };

  if (match.status === "innings-break") {
    const totalInnings = match.settings.inningsPerSide * 2;
    const finished = match.innings.length >= totalInnings;
    return (
      <section className="mx-auto max-w-xl space-y-5 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-7 text-center md:p-10">
        <Flag className="mx-auto size-10 text-amber-300" />
        <h2 className="font-display text-3xl font-bold">Innings complete</h2>
        <p className="text-sm text-slate-300">
          {findTeam(match, innings.battingTeamId).name} finished on {summary.runs}/{summary.wickets}{" "}
          from {summary.overs} overs.
        </p>
        <button
          type="button"
          onClick={() => onSave(startNextInnings(match))}
          className="h-12 rounded-full bg-amber-300 px-7 text-sm font-extrabold uppercase tracking-wider text-[#1d1520]"
        >
          {finished ? "Complete match" : "Start next innings"}
        </button>
        <button type="button" onClick={onExit} className="block w-full text-sm text-slate-400">
          Return to matches
        </button>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
      <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Striker">
            <PlayerSelect team={battingTeam} value={strikerId} onChange={setStrikerId} />
          </Field>
          <Field label="Non-striker">
            <PlayerSelect team={battingTeam} value={nonStrikerId} onChange={setNonStrikerId} />
          </Field>
          <Field label="Bowler">
            <PlayerSelect team={bowlingTeam} value={bowlerId} onChange={setBowlerId} />
          </Field>
          <Field label="Bowling end">
            <select
              value={end}
              onChange={(event) => setEnd(event.target.value as DeliveryEnd)}
              className="scorer-input"
            >
              <option>Pavilion</option>
              <option>Far</option>
            </select>
          </Field>
        </div>
        <button
          type="button"
          onClick={() => {
            setStrikerId(nonStrikerId);
            setNonStrikerId(strikerId);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-bold text-slate-300"
        >
          <RotateCcw className="size-3.5" /> Swap batters
        </button>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            What happened?
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            {[
              ["hit-no-run", "Hit, no run"],
              ["hit", "Shot played"],
              ["left", "Left"],
              ["missed", "Missed"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutcome(value as ShotOutcome)}
                className={`rounded-xl border px-3 py-3 text-xs font-bold ${outcome === value ? "border-amber-300 bg-amber-300/10 text-amber-200" : "border-white/10 text-slate-400"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <FieldMap value={fieldZone} onChange={setFieldZone} />
        <Field label="Fielder who stopped it">
          <PlayerSelect team={bowlingTeam} value={fielderId} onChange={setFielderId} allowNone />
        </Field>

        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex w-full items-center justify-between border-t border-white/10 pt-4 text-xs font-bold uppercase tracking-wider text-amber-300"
        >
          Delivery details <span>{showDetails ? "−" : "+"}</span>
        </button>
        {showDetails && (
          <div className="space-y-3">
            <Field label="Ball type">
              <select
                value={deliveryStyle}
                onChange={(event) => setDeliveryStyle(event.target.value as DeliveryStyle)}
                className="scorer-input"
              >
                {deliveryStyles.map((style) => (
                  <option key={style}>{style}</option>
                ))}
              </select>
            </Field>
            <Field label="Scorer note">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                className="scorer-input py-3"
                placeholder="Optional detail about line, length, movement or play"
              />
            </Field>
            <DetailedDeliveryFields
              batterRuns={detailBatterRuns}
              onBatterRuns={setDetailBatterRuns}
              extras={detailExtras}
              onExtras={setDetailExtras}
            />
            <button
              type="button"
              onClick={saveDetailedBall}
              disabled={invalidDetailedExtras}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 text-xs font-extrabold uppercase tracking-wider text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="size-4" /> Record detailed ball
            </button>
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-300">
              Record delivery
            </p>
            <h2 className="font-display text-2xl font-bold">Runs & extras</h2>
          </div>
          <div className="text-right text-xs text-slate-400">
            Next ball
            <br />
            <strong className="text-slate-100">
              {Math.floor(summary.legalBalls / match.settings.ballsPerOver)}.
              {(summary.legalBalls % match.settings.ballsPerOver) + 1}
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
            <button
              key={runs}
              type="button"
              onClick={() => saveBall({ batterRuns: runs, outcome: runs ? "hit" : outcome })}
              className={`aspect-square rounded-2xl border text-xl font-extrabold transition active:scale-95 ${runs === 4 || runs === 6 ? "border-amber-300/60 bg-amber-300/15 text-amber-200" : "border-white/10 bg-white/[0.04]"}`}
            >
              {runs}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickButton
            label="Wide"
            detail="+1, not legal"
            onClick={() => saveBall({ extras: { wide: 1 }, outcome: "missed" })}
          />
          <QuickButton
            label="No ball"
            detail="+1, not legal"
            onClick={() => saveBall({ extras: { noBall: 1 } })}
          />
          <QuickButton
            label="Bye"
            detail="+1 bye"
            onClick={() => saveBall({ extras: { bye: 1 }, outcome: "missed" })}
          />
          <QuickButton
            label="Leg bye"
            detail="+1 leg bye"
            onClick={() => saveBall({ extras: { legBye: 1 }, outcome: "missed" })}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowWicket(true)}
          className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-base font-extrabold uppercase tracking-wider shadow-lg shadow-rose-950/30"
        >
          <X className="size-5" /> Wicket
        </button>

        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            disabled={!innings.deliveries.length}
            onClick={() => onSave(undoLastDelivery(match))}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-xs font-bold disabled:opacity-30"
          >
            <Undo2 className="size-4" /> Undo last ball
          </button>
          <button
            type="button"
            onClick={() => onSave(endCurrentInnings(match))}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-xs font-bold"
          >
            <Flag className="size-4" /> End innings
          </button>
        </div>

        <RecentBalls match={match} />
      </section>

      {showWicket && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg space-y-5 rounded-t-3xl border border-white/10 bg-[#1a1622] p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  Dismissal
                </p>
                <h2 className="font-display text-2xl font-bold">Record the wicket</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowWicket(false)}
                className="flex size-9 items-center justify-center rounded-full bg-white/5"
              >
                <X className="size-4" />
              </button>
            </div>
            <Field label="How out">
              <select
                value={dismissalType}
                onChange={(event) => setDismissalType(event.target.value as DismissalType)}
                className="scorer-input"
              >
                {dismissalTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Batter out">
              <select
                value={dismissedBatterId}
                onChange={(event) => setDismissedBatterId(event.target.value)}
                className="scorer-input"
              >
                <option value={strikerId}>{findPlayer(match, strikerId)?.name}</option>
                <option value={nonStrikerId}>{findPlayer(match, nonStrikerId)?.name}</option>
              </select>
            </Field>
            {["caught", "stumped", "run-out"].includes(dismissalType) && (
              <Field
                label={
                  dismissalType === "caught"
                    ? "Catcher"
                    : dismissalType === "stumped"
                      ? "Wicketkeeper"
                      : "Fielder responsible"
                }
              >
                <PlayerSelect
                  team={bowlingTeam}
                  value={dismissalFielderId}
                  onChange={setDismissalFielderId}
                />
              </Field>
            )}
            {dismissalType === "caught" && (
              <FieldMap value={fieldZone} onChange={setFieldZone} compact />
            )}
            <DetailedDeliveryFields
              batterRuns={detailBatterRuns}
              onBatterRuns={setDetailBatterRuns}
              extras={detailExtras}
              onExtras={setDetailExtras}
            />
            <button
              type="button"
              disabled={invalidDetailedExtras}
              onClick={() => {
                saveBall({
                  outcome: "wicket",
                  batterRuns: detailBatterRuns,
                  extras: detailExtras,
                  dismissal: {
                    type: dismissalType,
                    batterId: dismissedBatterId,
                    fielderId: dismissalFielderId || undefined,
                    catchZone: dismissalType === "caught" ? fieldZone : undefined,
                  },
                });
                setShowWicket(false);
                setDismissalFielderId("");
                resetDetailedRuns();
              }}
              className="h-13 w-full rounded-full bg-rose-500 text-sm font-extrabold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm wicket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerSelect({
  team,
  value,
  onChange,
  allowNone = false,
}: {
  team: ReturnType<typeof findTeam>;
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="scorer-input"
    >
      {allowNone && <option value="">Not recorded</option>}
      {team.players.map((player) => (
        <option key={player.id} value={player.id}>
          {player.name}
        </option>
      ))}
    </select>
  );
}

function DetailedDeliveryFields({
  batterRuns,
  onBatterRuns,
  extras,
  onExtras,
}: {
  batterRuns: number;
  onBatterRuns: (runs: number) => void;
  extras: Extras;
  onExtras: (extras: Extras) => void;
}) {
  const fields: { key: keyof Extras; label: string }[] = [
    { key: "wide", label: "Wides" },
    { key: "noBall", label: "No-ball" },
    { key: "bye", label: "Byes" },
    { key: "legBye", label: "Leg byes" },
    { key: "penalty", label: "Penalty" },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        Completed runs & extras
      </p>
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-slate-500">Off bat</span>
          <input
            type="number"
            min="0"
            max="12"
            value={batterRuns}
            onChange={(event) => onBatterRuns(Math.max(0, Number(event.target.value)))}
            className="scorer-input"
          />
        </label>
        {fields.map((field) => (
          <label key={field.key} className="space-y-1">
            <span className="text-[10px] text-slate-500">{field.label}</span>
            <input
              type="number"
              min="0"
              max="12"
              value={extras[field.key]}
              onChange={(event) =>
                onExtras({
                  ...extras,
                  [field.key]: Math.max(0, Number(event.target.value)),
                })
              }
              className="scorer-input"
            />
          </label>
        ))}
      </div>
      {extras.wide > 0 && extras.noBall > 0 && (
        <p className="text-[10px] text-rose-300">A delivery cannot be both a wide and a no-ball.</p>
      )}
    </div>
  );
}

function QuickButton({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition active:scale-[0.98]"
    >
      <strong className="block text-sm">{label}</strong>
      <span className="text-[10px] text-slate-500">{detail}</span>
    </button>
  );
}

function FieldMap({
  value,
  onChange,
  compact = false,
}: {
  value: FieldZone;
  onChange: (zone: FieldZone) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {compact ? "Catch location" : "Shot / stop location"}
      </p>
      <div className="grid grid-cols-3 gap-1.5 rounded-[2rem] border border-white/10 bg-[#17131f] p-3">
        {fieldZones.map((zone) => (
          <button
            key={zone}
            type="button"
            onClick={() => onChange(zone)}
            className={`min-h-10 rounded-xl px-1.5 py-2 text-[10px] font-bold leading-tight ${value === zone ? "bg-amber-300 text-[#1d1520]" : "bg-white/[0.04] text-slate-400"}`}
          >
            {zone}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecentBalls({ match }: { match: CricketMatch }) {
  const deliveries = currentInnings(match).deliveries.slice(-12).reverse();
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        Recent deliveries
      </p>
      {deliveries.length ? (
        <div className="flex flex-wrap gap-2">
          {deliveries.map((ball) => (
            <span
              key={ball.id}
              title={`${ball.over}.${ball.ball} ${ball.fieldZone}`}
              className={`flex size-9 items-center justify-center rounded-full border text-xs font-extrabold ${ball.dismissal ? "border-rose-400 bg-rose-500/20 text-rose-200" : "border-white/10 bg-white/5"}`}
            >
              {deliveryLabel(ball)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No balls recorded yet.</p>
      )}
    </div>
  );
}

function Timeline({ match }: { match: CricketMatch }) {
  const innings = currentInnings(match);
  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Audit trail</p>
        <h2 className="font-display text-3xl font-bold">Every recorded delivery</h2>
      </div>
      {innings.deliveries.length ? (
        innings.deliveries
          .slice()
          .reverse()
          .map((ball) => (
            <article
              key={ball.id}
              className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <span
                className={`flex size-11 items-center justify-center rounded-full text-sm font-extrabold ${ball.dismissal ? "bg-rose-500 text-white" : "bg-amber-300 text-[#1d1520]"}`}
              >
                {deliveryLabel(ball)}
              </span>
              <div>
                <p className="text-sm font-bold">
                  {ball.over}.{ball.ball} • {findPlayer(match, ball.bowlerId)?.name} to{" "}
                  {findPlayer(match, ball.strikerId)?.name}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {ball.deliveryStyle} from {ball.end} end • {ball.outcome.replaceAll("-", " ")} •{" "}
                  {ball.fieldZone}
                  {ball.fielderId ? ` • stopped by ${findPlayer(match, ball.fielderId)?.name}` : ""}
                </p>
                {ball.dismissal && (
                  <p className="mt-1 text-xs font-bold text-rose-300">
                    {dismissalTypes.find((type) => type.value === ball.dismissal?.type)?.label}
                    {ball.dismissal.fielderId
                      ? ` • ${findPlayer(match, ball.dismissal.fielderId)?.name}`
                      : ""}
                  </p>
                )}
                {ball.note && <p className="mt-1 text-xs italic text-slate-400">“{ball.note}”</p>}
              </div>
              <time className="text-[10px] text-slate-500">
                {new Date(ball.recordedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
            </article>
          ))
      ) : (
        <EmptyState
          icon={History}
          title="No timeline yet"
          body="Record the first delivery and it will appear here with an automatic timestamp."
        />
      )}
    </section>
  );
}

function Scorecard({ match }: { match: CricketMatch }) {
  const [selected, setSelected] = useState(match.innings.length - 1);
  const innings = match.innings[selected] ?? currentInnings(match);
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  const batting = battingCard(match, innings);
  const bowling = bowlingCard(match, innings);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Scorecard</p>
          <h2 className="font-display text-3xl font-bold">
            {findTeam(match, innings.battingTeamId).name} {summary.runs}/{summary.wickets}
          </h2>
        </div>
        <select
          value={selected}
          onChange={(event) => setSelected(Number(event.target.value))}
          className="scorer-input w-auto"
        >
          {match.innings.map((item, index) => (
            <option key={item.id} value={index}>
              Innings {item.number}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        headings={["Batter", "Dismissal", "R", "B", "4", "6", "SR"]}
        rows={batting.map((row) => [
          row.name,
          row.dismissal,
          row.runs,
          row.balls,
          row.fours,
          row.sixes,
          row.strikeRate.toFixed(1),
        ])}
      />
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
        <strong>Extras {summary.extras.total}</strong>
        <span className="ml-2 text-slate-400">
          ({summary.extras.wide}w, {summary.extras.noBall}nb, {summary.extras.bye}b,{" "}
          {summary.extras.legBye}lb, {summary.extras.penalty}p)
        </span>
      </div>
      <h3 className="font-display text-2xl font-bold">Bowling</h3>
      {bowling.length ? (
        <DataTable
          headings={["Bowler", "O", "R", "W", "Econ", "Wd", "Nb"]}
          rows={bowling.map((row) => [
            row.name,
            row.overs,
            row.runs,
            row.wickets,
            row.economy.toFixed(2),
            row.wides,
            row.noBalls,
          ])}
        />
      ) : (
        <p className="text-sm text-slate-500">No bowling figures yet.</p>
      )}
    </section>
  );
}

function DataTable({ headings, rows }: { headings: string[]; rows: (string | number)[][] }) {
  return (
    <div className="no-scrollbar overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-white/[0.06] text-slate-400">
          <tr>
            {headings.map((heading) => (
              <th key={heading} className="px-4 py-3 font-bold uppercase tracking-wider">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-t border-white/10">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-4 py-3 ${cellIndex === 0 ? "font-bold text-slate-100" : "text-slate-400"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Analysis({ match }: { match: CricketMatch }) {
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  const zoneCounts = fieldZones
    .map((zone) => ({
      zone,
      count: innings.deliveries.filter((ball) => ball.fieldZone === zone).length,
      runs: innings.deliveries
        .filter((ball) => ball.fieldZone === zone)
        .reduce((sum, ball) => sum + deliveryRuns(ball), 0),
    }))
    .filter((item) => item.count);
  const missingZones = innings.deliveries.filter(
    (ball) => ball.fieldZone === "Not recorded",
  ).length;
  const missingFielders = innings.deliveries.filter(
    (ball) => ball.fieldZone !== "Not recorded" && !ball.fielderId && ball.batterRuns < 4,
  ).length;
  const wideCount = innings.deliveries.filter((ball) => ball.extras.wide).length;
  const audit = [
    {
      ok: missingZones === 0,
      text: missingZones
        ? `${missingZones} deliveries have no field location.`
        : "Every delivery has a field location.",
    },
    {
      ok: missingFielders === 0,
      text: missingFielders
        ? `${missingFielders} in-field events do not name a fielder.`
        : "All recorded in-field stops name a fielder.",
    },
    {
      ok: wideCount <= Math.max(2, summary.legalBalls * 0.08),
      text: `${wideCount} wides recorded (${innings.deliveries.length ? ((wideCount / innings.deliveries.length) * 100).toFixed(1) : "0"}% of entries).`,
    },
  ];
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Wagon-wheel data
          </p>
          <h2 className="font-display text-3xl font-bold">Scoring areas</h2>
        </div>
        {zoneCounts.length ? (
          zoneCounts.map((item) => (
            <div key={item.zone}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-bold">{item.zone}</span>
                <span className="text-slate-400">
                  {item.runs} runs • {item.count} balls
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-amber-300"
                  style={{
                    width: `${Math.max(5, (item.count / innings.deliveries.length) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon={Activity}
            title="No shot data yet"
            body="Locations build automatically as deliveries are scored."
          />
        )}
      </div>
      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-fuchsia-300">
              AI-ready audit
            </p>
            <h2 className="font-display text-3xl font-bold">Data quality</h2>
          </div>
          <WandSparkles className="size-7 text-fuchsia-300" />
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          This first build runs deterministic match checks on-device. Model-assisted video and
          anomaly analysis will plug into the same delivery records after cloud services are
          connected.
        </p>
        <div className="space-y-2">
          {audit.map((item) => (
            <div
              key={item.text}
              className="flex items-start gap-3 rounded-2xl border border-white/10 p-3"
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${item.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-300/15 text-amber-300"}`}
              >
                {item.ok ? <Check className="size-3" /> : <ClipboardCheck className="size-3" />}
              </span>
              <p className="text-xs text-slate-300">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface VideoAngle {
  id: string;
  name: string;
  url: string;
}

function VideoLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anglesRef = useRef<VideoAngle[]>([]);
  const [angles, setAngles] = useState<VideoAngle[]>([]);
  const [activeId, setActiveId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const drawing = useRef(false);
  const active = angles.find((angle) => angle.id === activeId);

  const addVideos = (event: ChangeEvent<HTMLInputElement>) => {
    const additions = Array.from(event.target.files ?? []).map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setAngles((current) => [...current, ...additions]);
    if (!activeId && additions[0]) setActiveId(additions[0].id);
  };

  useEffect(() => {
    anglesRef.current = angles;
  }, [angles]);

  useEffect(
    () => () => {
      anglesRef.current.forEach((angle) => URL.revokeObjectURL(angle.url));
    },
    [],
  );

  const seekFrames = (frames: number) => {
    if (videoRef.current)
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + frames / 30);
  };

  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (event: PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const point = canvasPoint(event);
    const context = canvasRef.current?.getContext("2d");
    context?.beginPath();
    context?.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const point = canvasPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.strokeStyle = "#fbbf24";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineTo(point.x, point.y);
    context.stroke();
  };
  const clearDrawing = () => canvasRef.current?.getContext("2d")?.clearRect(0, 0, 1280, 720);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Coaching review
          </p>
          <h2 className="font-display text-3xl font-bold">Multi-angle video lab</h2>
        </div>
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-amber-300 px-5 text-xs font-extrabold uppercase tracking-wider text-[#1d1520]">
          <Camera className="size-4" /> Add angle
          <input
            type="file"
            accept="video/*"
            multiple
            capture="environment"
            onChange={addVideos}
            className="sr-only"
          />
        </label>
      </div>
      {active ? (
        <>
          <div className="flex flex-wrap gap-2">
            {angles.map((angle, index) => (
              <button
                key={angle.id}
                type="button"
                onClick={() => setActiveId(angle.id)}
                className={`rounded-full px-4 py-2 text-xs font-bold ${angle.id === activeId ? "bg-fuchsia-500 text-white" : "border border-white/10 text-slate-400"}`}
              >
                Angle {index + 1}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black">
            <div className="relative aspect-video overflow-hidden">
              <video
                ref={videoRef}
                key={active.url}
                src={active.url}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                className="size-full object-contain transition-transform"
                style={{ transform: `scale(${zoom})` }}
                playsInline
              />
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={() => {
                  drawing.current = false;
                }}
                className="absolute inset-0 size-full touch-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-3">
              <button
                type="button"
                onClick={() => seekFrames(-1)}
                className="video-control"
                aria-label="Previous frame"
              >
                <SkipBack className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause()
                }
                className="video-control"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => seekFrames(1)}
                className="video-control"
                aria-label="Next frame"
              >
                <SkipForward className="size-4" />
              </button>
              <select
                value={rate}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRate(next);
                  if (videoRef.current) videoRef.current.playbackRate = next;
                }}
                className="h-9 rounded-full border border-white/10 bg-[#19151f] px-3 text-xs"
              >
                <option value={0.25}>0.25×</option>
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
              </select>
              <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                Zoom
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-24 accent-amber-300"
                />
              </label>
              <button
                type="button"
                onClick={clearDrawing}
                className="video-control"
                aria-label="Clear drawing"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Videos remain on this device in this preview. Frame stepping assumes 30 fps; exact
            source-frame metadata and synchronized remote phones require the cloud capture service.
          </p>
        </>
      ) : (
        <EmptyState
          icon={FileVideo}
          title="Add one or more phone angles"
          body="Record or choose videos, change angle, slow playback, step forward or back, zoom and draw directly over the action."
        />
      )}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
      <Icon className="size-8 text-amber-300" />
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-slate-500">{body}</p>
      </div>
    </div>
  );
}
