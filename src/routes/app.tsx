import { ScorerWagonWheel } from "@/components/ScorerWagonWheel";
import { ScorerBackupImport } from "@/components/ScorerBackupImport";
import { ScorerMatchNavigation } from "@/components/ScorerMatchNavigation";
import { defaultScorerDestination, type ScorerDestination } from "@/lib/scorer-navigation";
import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  Ban,
  Columns3,
  Footprints,
  MoveHorizontal,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Cloud,
  CloudOff,
  Download,
  Flag,
  History,
  ListPlus,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  Users,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import { useCricketStore } from "@/hooks/use-cricket-store";
import { validateDeviceMatchSetup } from "@/lib/match-setup";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { useAppPromos } from "@/hooks/use-app-promos";
import { PromoSlot } from "@/components/promo/PromoSlot";
import { useMatchCloudSync } from "@/hooks/use-match-cloud-sync";
import { cachedDuties, useMatchDuties } from "@/hooks/use-match-duties";
import { FieldingDesk } from "@/components/scorer/FieldingDesk";
import { ScoringTeamStrip, VideoDutyCard } from "@/components/scorer/ScoringTeam";
import { CheckScorerStrip } from "@/components/scorer/CheckScorerStrip";
import {
  applyPatch,
  applyPatches,
  bowlingHandledByOther,
  dutyAccess,
  isPatchEventType,
  readPatchEvent,
  type DeliveryTag,
  type ScoringPatch,
} from "@/lib/scoring-duties";
import { MatchRulesFields } from "@/components/scorer/MatchRulesFields";
import { RainPanel } from "@/components/scorer/RainPanel";
import { DayPanel } from "@/components/scorer/DayPanel";
import { StoppagePanel } from "@/components/scorer/StoppagePanel";
import { InstallBanner } from "@/components/app-shell/InstallApp";
import { RetirePanel, SquadPanel, SubstitutePanel, TossPanel, WorkloadPanel } from "@/components/scorer/MatchTools";
import { BallSpeedTool } from "@/components/scorer/BallSpeedTool";
import { BallTrackChart, BallTrackPad } from "@/components/scorer/BallTrack";
import { VideoLab } from "@/components/video/VideoLab";
import { bowlingTypeSplits, phaseSplits, type SplitRow } from "@/lib/phase-splits";
import { ballByBallCsv, downloadCsv, scorecardCsv } from "@/lib/stats-export";
import { FixBallPanel } from "@/components/scorer/FixBall";
import { canBowlNextOver } from "@/lib/bowling-workload";
import {
  allowedDismissals,
  canDeclare,
  createMatch,
  currentInnings,
  declareInnings,
  defaultRulesForFormat,
  deliveryLabel,
  endCurrentInnings,
  findPlayer,
  findTeam,
  isSuperOver,
  matchResult,
  nextBallIsFreeHit,
  nextInningsPlan,
  recordDelivery,
  startNextInnings,
  summarizeInnings,
  targetForCurrentInnings,
  undoLastDelivery,
  formatPreset,
  canBat,
  canBowl,
  setPlayerHand,
  undoRetirement,
  undoableRetirement,
  type CricketMatch,
  type MatchRules,
  type DeliveryEnd,
  type DeliveryStyle,
  type DismissalType,
  type BallPoint,
  type Delivery,
  type Extras,
  type FieldZone,
  type MatchFormat,
  type RecordDeliveryInput,
  type ShotOutcome,
} from "@/lib/cricket";
import {
  latestCloudEventDevice,
  loadCloudMatchSnapshot,
  readPendingEvents,
  scoringDeviceId,
  readRawPendingEventQueue,
} from "@/lib/cloud";
import { canResumeQueuedScoring, reviewCloudBootstrap, reviewRemoteScorerSnapshot } from "@/lib/scorer-reconciliation";
import { describeScorerSyncRecovery } from "@/lib/scorer-sync-status";
import { syncChipLabel } from "@/lib/sync-retry";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { AppTabBar } from "@/components/app-shell/AppTabBar";
import { BallTrail, CreaseStrip, RateStrip, ScoreHero, TeamCrest } from "@/components/scorer/Broadcast";
import { FielderChips, OutcomeChips, ShotSummary, ShotZonePicker } from "@/components/scorer/ShotEntry";
import { lastFielderInZone, orderFielders, outcomeAfterZone, recentZones } from "@/lib/shot-entry";
import { WinPredictor } from "@/components/scorer/WinPredictor";
import { CommentaryFeed } from "@/components/scorer/CommentaryFeed";
import { ScorecardView } from "@/components/scorer/ScorecardView";
import { commentaryFeed } from "@/lib/commentary";
import { currentPrediction, winTimeline } from "@/lib/win-timeline";
import { summariseOver } from "@/lib/over-summary.functions";
import { sendMatchAlerts } from "@/lib/push.functions";
import { alertsBetween } from "@/lib/match-alerts";

const batterHandKey = "criclume.batter-hands.v1";

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

export function CricketApp() {
  const {
    matches,
    loaded,
    upsertMatch,
    removeMatch,
    importMatches,
    storageIssue,
    storageConflict,
    recoveryData,
    saved,
    retrySave,
    canRetrySave,
  } = useCricketStore();
  const downloadBackup = (raw: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const cloudSession = useCloudSession();
  const [screen, setScreen] = useState<AppScreen>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bootstrapConflict, setBootstrapConflict] = useState<string | null>(null);
  const [cloudBootstrap, setCloudBootstrap] = useState<{
    status: "idle" | "loading" | "ready" | "error";
    message?: string;
  }>({ status: "idle" });
  const selectedMatch = matches.find((match) => match.id === selectedId);
  const cloudMatchId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("cloudMatch");
  }, []);
  // The server can't see the address's ?cloudMatch, so only show cloud-linked UI after hydration.
  const hydrated = useHydrated();
  const cloudLinked = hydrated && Boolean(cloudMatchId);

  useEffect(() => {
    // Offline, don't wait for the sign-in check (it can't finish without internet).
    const waitingForSession = cloudSession.loading && navigator.onLine;
    if (!cloudMatchId || !loaded || waitingForSession || cloudBootstrap.status !== "idle") {
      return;
    }
    if (!cloudSession.configured) {
      setCloudBootstrap({
        status: "error",
        message: "CricLume Cloud is briefly unavailable. Your scoring is saved on this device.",
      });
      return;
    }
    const local = matches.find((match) => match.id === cloudMatchId);
    if (!cloudSession.session || !navigator.onLine) {
      // Offline, or the sign-in is being renewed: keep scoring the copy saved on this phone.
      // Changes wait in the queue and are sent once the connection and sign-in are back.
      if (local) {
        setSelectedId(local.id);
        setScreen("match");
        setCloudBootstrap({ status: "ready" });
        return;
      }
      setCloudBootstrap({
        status: "error",
        message: !navigator.onLine
          ? "You're offline and this match isn't saved on this phone yet. Open it once with internet, then you can keep scoring offline."
          : "Sign in through the cloud control centre before opening this match.",
      });
      return;
    }
    setCloudBootstrap({ status: "loading" });
    void loadCloudMatchSnapshot(cloudMatchId)
      .then(async (match) => {
        let pendingEvents = 0;
        try {
          // Fielding notes waiting to send never conflict with the score.
          pendingEvents = readPendingEvents(cloudMatchId).filter((event) => !isPatchEventType(event.eventType)).length;
        } catch {
          if (!local) {
            setCloudBootstrap({
              status: "error",
              message:
                "The saved offline scoring queue is unreadable. No stored data was cleared. " +
                "Recover device data before opening this cloud match.",
            });
            return;
          }
          // A damaged offline queue may contain unacknowledged local deliveries.
          // Do not silently load the cloud score over a previously saved match.
          setBootstrapConflict(
            "The saved offline scoring queue is unreadable. No pending data was cleared.",
          );
          setSelectedId(local.id);
          setScreen("match");
          setCloudBootstrap({ status: "ready" });
          return;
        }
        const review = reviewCloudBootstrap(local, match, pendingEvents);
        if (!review.safe && local && pendingEvents > 0) {
          // Closed the scorer while offline and reopened: if nobody else scored since this
          // phone's last accepted change, carry on and send the saved changes in order.
          let latestDevice: string | null | undefined;
          try {
            latestDevice = await latestCloudEventDevice(cloudMatchId);
          } catch {
            latestDevice = undefined;
          }
          if (
            latestDevice !== undefined &&
            canResumeQueuedScoring({
              pendingEvents,
              hasLocalCopy: true,
              thisDeviceId: scoringDeviceId(),
              latestCloudDeviceId: latestDevice,
            })
          ) {
            setBootstrapConflict(null);
            setSelectedId(local.id);
            setScreen("match");
            setCloudBootstrap({ status: "ready" });
            return;
          }
        }
        const userId = cloudSession.session?.user.id;
        const saved = userId ? cachedDuties(cloudMatchId, userId) : null;
        if (!review.safe && pendingEvents === 0 && saved && !dutyAccess(saved).recordBalls) {
          // Bowling & fielding or video helpers only follow the ball scorer's copy: take the cloud's.
          upsertMatch(match);
          setBootstrapConflict(null);
          setSelectedId(match.id);
          setScreen("match");
          setCloudBootstrap({ status: "ready" });
          return;
        }
        if (!review.safe) {
          if (!local) {
            setCloudBootstrap({
              status: "error",
              message: `${review.reason} Restore the device's queued scoring data before opening this cloud match.`,
            });
            return;
          }
          // Keep every on-device delivery and pause scoring until a lead scorer
          // reviews the different versions. Never silently replace local work.
          setBootstrapConflict(review.reason);
        } else {
          upsertMatch(match);
          setBootstrapConflict(null);
        }
        setSelectedId(match.id);
        setScreen("match");
        setCloudBootstrap({ status: "ready" });
      })
      .catch((reason: unknown) => {
        if (local) {
          setSelectedId(local.id);
          setScreen("match");
          setCloudBootstrap({ status: "ready" });
          return;
        }
        setCloudBootstrap({
          status: "error",
          message:
            reason instanceof Error ? reason.message : "The cloud match could not be loaded.",
        });
      });
  }, [
    cloudBootstrap.status,
    cloudMatchId,
    cloudSession.configured,
    cloudSession.loading,
    cloudSession.session,
    loaded,
    matches,
    upsertMatch,
  ]);

  const openMatch = (id: string) => {
    setSelectedId(id);
    setScreen("match");
  };

  return (
    <div className="min-h-screen bg-background text-slate-100">
      <AppHeader
        area="Scorer"
        {...(screen !== "dashboard"
          ? { onBack: () => setScreen("dashboard"), backLabel: "Back to matches" }
          : {})}
        right={
          <>
            <span
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300"
              role="status"
            >
              {cloudLinked ? (
                <Cloud className="size-3.5 text-amber-300" aria-hidden="true" />
              ) : saved ? (
                <Check className="size-3.5 text-emerald-300" aria-hidden="true" />
              ) : (
                <CloudOff className="size-3.5 text-amber-300" aria-hidden="true" />
              )}
              <span className={screen === "match" ? "" : "hidden sm:inline"}>
                {cloudLinked ? "Cloud match linked" : saved ? "Saved" : "Saving…"}
              </span>
            </span>
            <Link to="/platform" className="app-chip-button hidden lg:inline-flex">
              Club workspace
            </Link>
          </>
        }
      />
      {screen === "dashboard" && <InstallBanner />}

      {storageIssue && (
        <section
          aria-label="Device storage recovery"
          className="mx-auto mt-4 max-w-7xl rounded-xl border border-amber-300/40 bg-amber-300/10 p-4 text-amber-100"
        >
          <p role="alert">{storageIssue}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="action-primary"
              onClick={() =>
                downloadBackup(JSON.stringify(matches, null, 2), "criclume-current-matches.json")
              }
            >
              Download current matches
            </button>
            {recoveryData !== null && (
              <button
                className="action-primary"
                onClick={() => downloadBackup(recoveryData, "criclume-preserved-device-data.json")}
              >
                Download preserved data
              </button>
            )}
            {storageConflict && (
              <button className="action-primary" onClick={() => window.location.reload()}>
                Reload latest device data
              </button>
            )}
            {canRetrySave && (
              <button className="action-primary" onClick={retrySave}>
                Retry device save
              </button>
            )}
          </div>
          {storageConflict && (
            <p className="mt-2 text-sm">
              Reload replaces this tab’s in-memory matches. Download your current matches first if
              you want to keep them.
            </p>
          )}
          <p className="mt-2 text-xs">
            Backups may contain player names and private notes. Keep them private. Cloud match
            linkage does not confirm that every change has synced.
          </p>
        </section>
      )}
      {!loaded || (cloudLinked && ["idle", "loading"].includes(cloudBootstrap.status)) ? (
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-400">
          {cloudLinked ? "Loading cloud match…" : "Loading scorer…"}
        </div>
      ) : cloudLinked && cloudBootstrap.status === "error" ? (
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12 text-center"
        >
          <section className="w-full rounded-3xl border border-rose-400/20 bg-white/[0.04] p-7">
            <CloudOff className="mx-auto size-10 text-rose-300" />
            <h1 className="mt-4 text-2xl font-bold">Cloud match unavailable</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">{cloudBootstrap.message}</p>
            <Link
              to="/platform"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-amber-300 px-6 text-sm font-extrabold text-gold-foreground"
            >
              Open cloud control centre
            </Link>
          </section>
        </main>
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
          initialCloudConflict={bootstrapConflict}
          onCloudConflictResolved={() => setBootstrapConflict(null)}
        />
      ) : (
        <>
          <Dashboard
            matches={matches}
            onNew={() => setScreen("setup")}
            onOpen={openMatch}
            onDelete={removeMatch}
            onImport={cloudLinked ? undefined : importMatches}
          />
          <div className="app-tabbar-spacer" aria-hidden="true" />
          <AppTabBar
            label="Scorer menu"
            tabs={[
              { id: "matches", label: "Matches", icon: ListPlus, active: true, onSelect: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
              { id: "new", label: "New match", icon: Plus, emphasis: true, onSelect: () => setScreen("setup") },
              { id: "club", label: "Club", icon: Users, to: "/platform" },
              { id: "more", label: "More", icon: MoreHorizontal, onSelect: openMoreSection },
            ]}
          />
        </>
      )}
    </div>
  );
}

function openMoreSection() {
  const section = document.getElementById("scorer-more");
  if (section instanceof HTMLDetailsElement) section.open = true;
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Dashboard({
  matches,
  onNew,
  onOpen,
  onDelete,
  onImport,
}: {
  matches: CricketMatch[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: ((matches: CricketMatch[]) => void) | undefined;
}) {
  const { promos, onPlay } = useAppPromos();
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 md:px-8 md:py-12"
    >
      <PromoSlot items={promos.top} slot="top" onPlay={onPlay} />
      <div className={promos.side.length > 0 ? "promo-with-side" : ""}>
      <div className="min-w-0 space-y-8">
      <section className="grid gap-6 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-2xl md:grid-cols-[1fr_auto] md:items-end md:p-10">
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
            fielders. Every entry is timestamped; check the device saving status before closing.
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400 px-7 text-sm font-extrabold uppercase tracking-[0.1em] text-primary-foreground shadow-lg shadow-rose-950/40"
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
          <span className="text-sm text-slate-400">{matches.length} matches</span>
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
                <article key={match.id} className="match-card group">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`hero-chip ${match.status === "live" ? "hero-chip-live" : ""}`}
                    >
                      {match.status === "live" && <span className="live-dot" aria-hidden="true" />}
                      {match.status === "completed" ? "Completed" : match.status.replace("-", " ")}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete ${batting.name} v ${bowling.name} from this device?`))
                          onDelete(match.id);
                      }}
                      className="app-icon-button size-9 text-slate-400 hover:text-rose-300"
                      aria-label={`Delete ${batting.name} versus ${bowling.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {match.id.startsWith("restored-") && (
                    <p className="mt-3 text-xs font-semibold text-amber-200">Restored local copy</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpen(match.id)}
                    className="mt-4 block w-full text-left"
                    aria-label={`Open ${batting.name} versus ${bowling.name}`}
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <TeamCrest name={batting.name} />
                        <span className="line-clamp-1 text-xs font-bold uppercase tracking-wider">
                          {batting.name}
                        </span>
                        <span className="font-display text-3xl font-bold tabular-nums text-gold">
                          {summary.runs}/{summary.wickets}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider text-slate-400">
                          {summary.overs} overs
                        </span>
                      </div>
                      <span className="hero-vs">v</span>
                      <div className="flex flex-col items-center gap-2 text-center">
                        <TeamCrest name={bowling.name} />
                        <span className="line-clamp-1 text-xs font-bold uppercase tracking-wider">
                          {bowling.name}
                        </span>
                        <span className="font-display text-xl text-slate-400">
                          {match.innings.length > 1 ? "Batted" : "Yet to bat"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-slate-400">
                      <span className="truncate">
                        {match.settings.ground || "Ground not set"} · {match.settings.format}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-bold text-gold transition group-hover:translate-x-0.5">
                        {match.status === "completed" ? "View" : "Resume"}{" "}
                        <ChevronRight className="size-4" />
                      </span>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <details id="scorer-more" className="scorer-more group rounded-2xl border border-white/10 bg-white/[0.03]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-bold">
          More options
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
        </summary>
        <div className="space-y-5 border-t border-white/10 p-5">
          {onImport && (
            <div>
              <h2 className="text-base font-bold">Restore from a backup</h2>
              <div className="mt-2">
                <ScorerBackupImport onImport={onImport} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            <Link to="/" className="app-chip-button">
              CricLume website
            </Link>
            <Link to="/privacy" className="app-chip-button">
              Privacy
            </Link>
          </div>
        </div>
      </details>

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
      </div>
      {promos.side.length > 0 && (
        <div className="promo-side-rail">
          <PromoSlot items={promos.side} slot="side" onPlay={onPlay} />
        </div>
      )}
      </div>
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
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [homePlayers, setHomePlayers] = useState("");
  const [awayPlayers, setAwayPlayers] = useState("");
  const [battingFirst, setBattingFirst] = useState<"home" | "away">("home");
  const [ground, setGround] = useState("");
  const [weather, setWeather] = useState("");
  const [rules, setRules] = useState<MatchRules>(() => defaultRulesForFormat("T20"));
  const [error, setError] = useState("");

  const changeFormat = (next: MatchFormat) => {
    setFormat(next);
    setRules(defaultRulesForFormat(next));
    if (next === "Multi-day") {
      setOvers("");
      setInningsPerSide(2);
    } else {
      const preset = formatPreset(next);
      setOvers(next === "Custom" ? overs || "20" : String(preset.overs ?? 20));
      setInningsPerSide(1);
    }
  };
  const preset = formatPreset(format);

  const submit = () => {
    setError("");
    const parsed = validateDeviceMatchSetup({
      homeName,
      awayName,
      homePlayers,
      awayPlayers,
      overs,
      format,
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onCreate(
      createMatch({
        homeTeamName: homeName.trim(),
        awayTeamName: awayName.trim(),
        homePlayers: parsed.homeLineup,
        awayPlayers: parsed.awayLineup,
        battingFirst,
        settings: {
          format,
          oversPerInnings: parsed.oversPerInnings,
          inningsPerSide,
          ballsPerOver: preset.ballsPerOver,
          ground: ground.trim(),
          weather: weather.trim(),
          startTime: new Date().toISOString(),
          rules: {
            freeHit: Boolean(rules.freeHit),
            lastManStands: Boolean(rules.lastManStands),
            superOver: inningsPerSide === 1 && parsed.oversPerInnings !== null && Boolean(rules.superOver),
            followOnLead: inningsPerSide === 2 ? (rules.followOnLead ?? null) : null,
            ...(inningsPerSide === 1 && parsed.oversPerInnings !== null && rules.rainMethod ? { rainMethod: rules.rainMethod } : {}),
            ...(inningsPerSide === 2 && rules.days ? { days: rules.days } : {}),
            ...(rules.pairs ? { pairs: rules.pairs } : {}),
            ...(rules.endsChangeEvery ? { endsChangeEvery: rules.endsChangeEvery } : {}),
          },
        },
      }),
    );
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 md:px-8 md:py-12"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">Match setup</p>
        <h1 className="mt-1 font-display text-4xl font-bold md:text-5xl">Set the game up once</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Add your actual teams and playing lineups before starting. The start time is automatic,
          and you can change the striker, bowler and end while scoring.
        </p>
      </div>

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-2 md:p-8">
        <Field label="Format">
          <select
            value={format}
            onChange={(event) => changeFormat(event.target.value as MatchFormat)}
            className="scorer-input"
          >
            {["T10", "T20", "ODI", "The Hundred", "Tape-ball", "Indoor", "School", "Club", "Multi-day", "Custom"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          {preset.note && <span className="mt-1 block text-[11px] text-slate-400">{preset.note}</span>}
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
              placeholder={format === "Multi-day" ? "No limit" : "e.g. 20"}
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
            placeholder="Optional — match ground"
          />
        </Field>
        <Field label="Weather">
          <input
            value={weather}
            onChange={(event) => setWeather(event.target.value)}
            className="scorer-input"
            placeholder="Optional — actual conditions"
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-8" aria-label="Match rules">
        <div>
          <h2 className="font-display text-xl font-bold">Match rules</h2>
          <p className="mt-1 text-xs text-slate-400">
            Set for this format. You can change them during the match from the scoring screen.
          </p>
        </div>
        <MatchRulesFields
          rules={rules}
          onChange={setRules}
          inningsPerSide={inningsPerSide}
          limitedOvers={format !== "Multi-day" && overs.trim() !== ""}
        />
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
                placeholder={team.side === "home" ? "Enter home team" : "Enter away team"}
              />
            </Field>
            <Field label="Playing XI — one player per line">
              <textarea
                value={team.players}
                onChange={(event) => team.setPlayers(event.target.value)}
                rows={11}
                className="scorer-input min-h-60 py-3 leading-7"
                placeholder={
                  "Enter the players in batting order, one per line\nAt least 2, maximum 11"
                }
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
        <p
          role="alert"
          className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200"
        >
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
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400 px-8 text-sm font-extrabold uppercase tracking-wider text-primary-foreground"
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
  initialCloudConflict,
  onCloudConflictResolved,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch) => void;
  onExit: () => void;
  initialCloudConflict: string | null;
  onCloudConflictResolved: () => void;
}) {
  const [tab, setTab] = useState<ScorerDestination>(defaultScorerDestination);
  const changeTab = (next: ScorerDestination) => {
    setTab(next);
    if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: "auto" });
  };
  const [cloudActionError, setCloudActionError] = useState<string | null>(null);
  const [cloudConflict, setCloudConflict] = useState<string | null>(initialCloudConflict);
  const [backupRequested, setBackupRequested] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const cloudMatchId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("cloudMatch");
  }, []);
  const cloudSession = useCloudSession();
  const myUserId = cloudSession.session?.user.id ?? null;
  const dutyState = useMatchDuties(cloudMatchId, myUserId);
  // Ads sit above the score, away from the scoring buttons.
  const { promos, onPlay } = useAppPromos(cloudMatchId);
  // Until the first check finishes (or for a match only on this phone) the screen offers everything;
  // the server still refuses anything this person isn't allowed to do.
  const access = dutyAccess(dutyState.duties ?? ["lead"]);
  const bowlingByOther = Boolean(cloudMatchId) && bowlingHandledByOther(dutyState.team, myUserId);
  // People who don't record balls follow the batting scorer's score and never send their own.
  const follower = Boolean(cloudMatchId) && !access.recordBalls;

  // Bowling & fielding notes, kept so they survive a newer score arriving from the ball scorer.
  const matchRef = useRef(match);
  matchRef.current = match;
  const ledger = useRef(new Map<string, ScoringPatch>());
  const remember = useCallback((patch: ScoringPatch) => {
    const key = patch.kind === "delivery.tagged" ? `ball:${patch.deliveryId}` : `bowler:${patch.inningsId}`;
    const previous = ledger.current.get(key);
    if (!previous || previous.sequence <= patch.sequence) ledger.current.set(key, patch);
  }, []);
  useEffect(() => {
    if (!cloudMatchId) return;
    try {
      // This phone's own unsent notes (e.g. after reopening offline) are newest of all.
      for (const event of readPendingEvents(cloudMatchId)) {
        if (!isPatchEventType(event.eventType)) continue;
        const patch = readPatchEvent({ ...event, sequence: Number.MAX_SAFE_INTEGER });
        if (patch) remember(patch);
      }
    } catch {
      /* unreadable queue is reported by the sync status */
    }
  }, [cloudMatchId, remember]);
  const acceptRemotePatch = useCallback(
    (patch: ScoringPatch) => {
      remember(patch);
      const next = applyPatch(matchRef.current, patch);
      if (next !== matchRef.current) onSave(next);
    },
    [onSave, remember],
  );
  const acceptRemoteMatch = useCallback(
    (remote: CricketMatch): boolean => {
      if (remote.id !== match.id || cloudConflict) return false;
      const merged = applyPatches(remote, ledger.current.values());
      if (!follower) {
        const review = reviewRemoteScorerSnapshot(match, merged);
        if (!review.safe) {
          setCloudConflict(review.reason);
          setBackupRequested(false);
          return false;
        }
      }
      onSave(merged);
      return true;
    },
    [cloudConflict, follower, match, onSave],
  );
  const cloudSync = useMatchCloudSync(cloudMatchId, acceptRemoteMatch, Boolean(cloudConflict), acceptRemotePatch);
  const sendOwnPatch = (patch: ScoringPatch, payload: Record<string, unknown>) => {
    remember(patch);
    onSave(applyPatch(match, patch));
    cloudSync.publishPatch(patch.kind, payload);
  };
  const sendBowler = (bowlerId: string, end: DeliveryEnd) => {
    const inningsId = currentInnings(match).id;
    sendOwnPatch(
      { kind: "bowling.updated", sequence: Number.MAX_SAFE_INTEGER, occurredAt: new Date().toISOString(), inningsId, bowlerId, end },
      { inningsId, bowlerId, end },
    );
  };
  const sendTag = (ball: { id: string }, tag: DeliveryTag) => {
    const inningsId = currentInnings(match).id;
    sendOwnPatch(
      { kind: "delivery.tagged", sequence: Number.MAX_SAFE_INTEGER, occurredAt: new Date().toISOString(), inningsId, deliveryId: ball.id, tag },
      { inningsId, deliveryId: ball.id, tag },
    );
  };
  const syncRecovery = describeScorerSyncRecovery(
    cloudSync.status,
    cloudSync.pendingCount,
    cloudSync.queueUnreadable,
  );
  const syncLabel = syncChipLabel({
    status: cloudSync.status,
    pending: cloudSync.pendingCount,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
  });
  const saveAndSync = (next: CricketMatch, eventType = "match.snapshot", extraPayload?: Record<string, unknown>) => {
    if (cloudConflict) return;
    if (follower) {
      setCloudActionError("Only the batting & runs scorer (or the lead scorer) can change the score for this match.");
      return;
    }
    onSave(next);
    void cloudSync.publish(next, eventType, extraPayload);
    // Fans' phone alerts: best-effort and live-only — a late wicket alert after reconnecting would mislead.
    if (cloudMatchId && navigator.onLine) {
      const alerts = alertsBetween(match, next);
      if (alerts.length) void sendMatchAlerts({ data: { matchId: cloudMatchId, alerts } }).catch(() => undefined);
    }
  };
  const advanceInnings = (options: { followOn?: boolean } = {}) => {
    if (cloudConflict) return;
    setCloudActionError(null);
    let next = startNextInnings(match, options);
    if (next.innings.length === match.innings.length || !cloudMatchId) {
      saveAndSync(next, next.status === "completed" ? "match.completed" : "innings.started");
      return;
    }
    // Works offline: the phone picks the new innings' ID and the start is saved in the queue,
    // ahead of the balls that follow, and sent in order when the connection is back.
    const nextInnings = currentInnings(next);
    const inningsId = crypto.randomUUID();
    next = {
      ...next,
      innings: [...next.innings.slice(0, -1), { ...nextInnings, id: inningsId }],
    };
    saveAndSync(next, "innings.started", {
      inningsStart: {
        inningsId,
        inningsNumber: nextInnings.number,
        battingTeamId: nextInnings.battingTeamId,
        bowlingTeamId: nextInnings.bowlingTeamId,
      },
    });
  };
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

  const exportPreservedQueue = () => {
    if (!cloudMatchId) return;
    try {
      const raw = readRawPendingEventQueue(cloudMatchId);
      if (raw === null) {
        setCloudActionError("This device has no saved offline events for this match.");
        return;
      }
      const url = URL.createObjectURL(new Blob([raw], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `criclume-offline-queue-${cloudMatchId.slice(0, 8).replace(/[^a-zA-Z0-9-]/g, "")}.txt`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setCloudActionError(
        "This browser could not read the saved offline events. Keep this device data for recovery.",
      );
    }
  };

  const replaceLocalWithCloud = async () => {
    if (!cloudMatchId || !backupRequested || reconciling) return;
    let pendingEvents = 0;
    try {
      pendingEvents = readPendingEvents(cloudMatchId).length;
    } catch {
      setCloudActionError(
        "Saved offline deliveries could not be read. Nothing was cleared or replaced. " +
          "Ask your club administrator to recover the device queue.",
      );
      return;
    }
    if (pendingEvents > 0) {
      setCloudActionError(
        "Unsent deliveries are still queued. Keep your local copy and ask the lead scorer to reconcile.",
      );
      return;
    }
    if (
      !window.confirm(
        "Replace this device's working match with the latest cloud copy? Check that your local backup downloaded first.",
      )
    ) {
      return;
    }
    setReconciling(true);
    setCloudActionError(null);
    try {
      const current = await loadCloudMatchSnapshot(cloudMatchId);
      if (current.id !== match.id) throw new Error("Cloud returned a different match.");
      onSave(current);
      setCloudConflict(null);
      onCloudConflictResolved();
      setBackupRequested(false);
    } catch (reason) {
      setCloudActionError(
        reason instanceof Error ? reason.message : "The cloud score could not be loaded.",
      );
    } finally {
      setReconciling(false);
    }
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-7xl pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-8 md:py-8"
    >
      <PromoSlot items={promos.top} slot="top" onPlay={onPlay} className="mx-3 mb-3 mt-3 md:mx-auto md:mt-0" />
      <ScoreHero
        match={match}
        sync={
          cloudSync.enabled ? (
            <span className="hero-chip" role="status" aria-live="polite" data-sync={cloudSync.status}>
              {syncLabel}
            </span>
          ) : undefined
        }
      />

      <ScorerMatchNavigation active={tab} onChange={changeTab} onExport={exportMatch} />

      {tab === "score" && (
        <aside
          aria-label="Compact live score"
          className="sticky top-[68px] z-30 grid grid-cols-[1fr_auto] items-center gap-2 border-b border-amber-300/20 bg-card/95 px-4 py-2 text-slate-100 shadow-lg backdrop-blur-xl md:hidden"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              {findPlayer(match, innings.strikerId)?.name ?? "Set striker"}
              <span className="px-1 text-slate-500">·</span>
              {findPlayer(match, innings.bowlerId)?.name ?? "Set bowler"}
            </p>
            <p className="text-[11px] text-slate-300">
              {summary.overs} overs ·{" "}
              {cloudSync.enabled ? syncLabel : "On this device"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="font-display text-2xl font-bold tabular-nums text-amber-200">
                {summary.runs}/{summary.wickets}
              </p>
              {target != null && <p className="text-[10px] text-slate-300">Target {target}</p>}
            </div>
            <button
              type="button"
              onClick={exportMatch}
              aria-label="Export current match backup"
              title="Export match backup"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/20 bg-white/5 text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
            >
              <Download className="size-5" aria-hidden="true" />
            </button>
          </div>
        </aside>
      )}

      <div className="px-4 py-5 md:px-0">
        {cloudActionError && (
          <p className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">
            {cloudActionError}
          </p>
        )}
        {cloudSync.enabled && syncRecovery.show && !cloudConflict && (
          <section
            role="status"
            aria-live="polite"
            aria-label="Cloud scoring recovery"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/35 bg-amber-300/[0.06] p-4"
          >
            <div className="min-w-0">
              <h2 className="font-bold text-amber-200">{syncRecovery.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{syncRecovery.detail}</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {syncRecovery.canRetry && (
                <button
                  type="button"
                  className="action-primary min-h-11"
                  onClick={() => void cloudSync.retry()}
                >
                  Retry cloud sync
                </button>
              )}
              <button type="button" className="workspace-nav-item min-h-11" onClick={exportMatch}>
                Export device backup
              </button>
              {cloudSync.queueUnreadable && (
                <button
                  type="button"
                  className="workspace-nav-item min-h-11"
                  onClick={exportPreservedQueue}
                >
                  Export preserved queue
                </button>
              )}
            </div>
          </section>
        )}
        {cloudConflict && (
          <section
            role="alert"
            className="mb-5 space-y-3 rounded-2xl border border-rose-300/60 bg-rose-950/50 p-5 text-slate-100"
          >
            <h2 className="text-xl font-bold text-rose-200">Scorer versions need review</h2>
            <p className="text-sm leading-relaxed">
              {cloudConflict} This device's recorded deliveries have been kept. Scoring is paused to
              prevent a different device overwriting your work.
            </p>
            <p className="text-sm">
              Download your local copy, check your Downloads folder, and agree the correct score
              with the lead scorer before replacing this working copy.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="action-primary"
                onClick={() => {
                  exportMatch();
                  setBackupRequested(true);
                }}
              >
                Download local backup
              </button>
              <button
                type="button"
                className="workspace-nav-item"
                disabled={!backupRequested || reconciling}
                onClick={() => void replaceLocalWithCloud()}
              >
                {reconciling ? "Loading cloud score…" : "Replace with reviewed cloud copy"}
              </button>
              {cloudMatchId && (
                <button type="button" className="workspace-nav-item" onClick={exportPreservedQueue}>
                  Export offline queue
                </button>
              )}
            </div>
            <p className="text-xs text-slate-300">
              A requested download does not prove a backup was saved. Check the file before choosing
              the cloud version. No automated merge has been performed.
            </p>
          </section>
        )}
        {cloudMatchId && dutyState.duties && access.onTeam && (
          <ScoringTeamStrip
            matchId={cloudMatchId}
            duties={dutyState.duties}
            team={dutyState.team}
            myUserId={myUserId}
            onChanged={() => void dutyState.refresh()}
          />
        )}
        {cloudMatchId && dutyState.duties && access.onTeam && <CheckScorerStrip matchId={cloudMatchId} />}
        {cloudMatchId && dutyState.duties && !access.onTeam && (
          <section role="status" className="broadcast-panel mb-5 text-sm text-slate-200">
            <h2 className="font-bold text-amber-200">You're not on this match's scoring team</h2>
            <p className="mt-1 text-slate-300">
              You can follow the score here, but only the people the club named for this match can score it.
              Ask a club admin or the lead scorer to give you a job.
            </p>
          </section>
        )}
        <div hidden={tab !== "score"}>
          {!cloudConflict && access.recordBalls && <DayPanel match={match} onSave={saveAndSync} />}
          {!cloudConflict && access.recordBalls && <StoppagePanel match={match} onSave={saveAndSync} />}
          {!cloudConflict && access.recordBalls && !match.days?.atStumps && !match.stoppage && (
            <ScoringPad
              match={match}
              onSave={saveAndSync}
              onAdvanceInnings={(options) => advanceInnings(options)}
              onExit={onExit}
              bowlingByOther={bowlingByOther}
            />
          )}
          {!cloudConflict && !access.recordBalls && access.bowlingFielding && (
            <FieldingDesk match={match} onBowler={sendBowler} onTag={sendTag} />
          )}
          {!cloudConflict && !access.recordBalls && !access.bowlingFielding && access.video && cloudMatchId && (
            <VideoDutyCard matchId={cloudMatchId} />
          )}
        </div>
        {tab === "score" && !cloudConflict && access.recordBalls && (
          <div className="mt-5 space-y-5">
            {match.status === "live" && <RetirePanel match={match} onSave={saveAndSync} />}
            <SquadPanel match={match} onSave={saveAndSync} cloudMatchId={cloudMatchId} />
            <SubstitutePanel match={match} onSave={saveAndSync} cloudMatchId={cloudMatchId} />
            <TossPanel match={match} onSave={saveAndSync} />
            <WorkloadPanel match={match} onSave={saveAndSync} />
            <MatchPredictorPanel match={match} onSave={saveAndSync} />
            <LiveRulesPanel match={match} onSave={saveAndSync} />
            <RainPanel match={match} onSave={saveAndSync} />
          </div>
        )}
        {tab === "timeline" && <Timeline match={match} onSave={saveAndSync} canFix={!follower && !cloudConflict && access.recordBalls} />}
        {tab === "scorecard" && <Scorecard match={match} onSave={saveAndSync} />}
        {tab === "analysis" && <Analysis match={match} />}
        {tab === "video" && (
          <div className="space-y-5">
            {cloudMatchId && access.video && <VideoDutyCard matchId={cloudMatchId} />}
            <BallSpeedTool match={match} onSave={access.recordBalls && !cloudConflict ? saveAndSync : undefined} />
            <VideoLab />
          </div>
        )}
      </div>
    </main>
  );
}

function ScoringPad({
  match,
  onSave,
  onAdvanceInnings,
  onExit,
  bowlingByOther = false,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch, eventType?: string) => void;
  onAdvanceInnings: (options?: { followOn?: boolean }) => void;
  onExit: () => void;
  /** Another phone has the bowling & fielding job: bowler comes from them, fielding is theirs. */
  bowlingByOther?: boolean;
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
  const [pitch, setPitch] = useState<BallPoint | undefined>(undefined);
  const [beehive, setBeehive] = useState<BallPoint | undefined>(undefined);
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
  const [leftHanders, setLeftHanders] = useState<Record<string, boolean>>({});
  const invalidDetailedExtras = detailExtras.wide > 0 && detailExtras.noBall > 0;
  const freeHit = match.status === "live" && nextBallIsFreeHit(match);
  const allowedOut = allowedDismissals(match);
  const superOver = isSuperOver(innings);

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

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(batterHandKey) ?? "{}") as unknown;
      if (saved && typeof saved === "object") setLeftHanders(saved as Record<string, boolean>);
    } catch {
      /* ignore unreadable preference */
    }
  }, []);

  const setBatterHand = (playerId: string, left: boolean) => {
    setLeftHanders((current) => {
      const next = { ...current, [playerId]: left };
      try {
        window.localStorage.setItem(batterHandKey, JSON.stringify(next));
      } catch {
        /* storage may be unavailable */
      }
      return next;
    });
  };
  const recentPositions = recentZones(innings.deliveries);
  const workloadCheck = canBowlNextOver(match, bowlerId);
  const workloadNote = workloadCheck?.message ? workloadCheck : null;

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
      ...(pitch ? { pitch } : {}),
      ...(beehive ? { beehive } : {}),
      ...partial,
    };
    onSave(recordDelivery(match, input), "delivery.recorded");
    setNote("");
    clearShot();
  };

  const clearShot = () => {
    setFieldZone("Not recorded");
    setFielderId("");
    setOutcome("hit-no-run");
    setPitch(undefined);
    setBeehive(undefined);
  };

  const chooseZone = (zone: FieldZone) => {
    setFieldZone(zone);
    setOutcome((current) => outcomeAfterZone(zone, current));
    setFielderId(zone === "Not recorded" ? "" : (lastFielderInZone(innings.deliveries, zone) ?? ""));
  };

  const suggestedFielderId = lastFielderInZone(innings.deliveries, fieldZone);
  const orderedFielders = orderFielders(
    bowlingTeam.players.map((player) => player.id),
    innings.deliveries,
    fieldZone,
  )
    .map((id) => bowlingTeam.players.find((player) => player.id === id))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));

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

  if (match.status === "innings-break" || match.status === "completed") {
    const plan = match.status === "completed" ? null : nextInningsPlan(match);
    const result = matchResult(match);
    const nextTeam = (id: string) => findTeam(match, id).name;
    const firstName = plan?.kind === "regular" ? nextTeam(plan.battingTeamId) : "";
    return (
      <section
        className="mx-auto max-w-xl space-y-5 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-7 text-center md:p-10"
        aria-live="polite"
      >
        <Flag className="mx-auto size-10 text-amber-300" />
        <h2 className="font-display text-3xl font-bold">
          {result ? "Match result" : plan?.kind === "super-over" ? "Super Over" : "Innings complete"}
        </h2>
        <p className="text-sm text-slate-300">
          {findTeam(match, innings.battingTeamId).name} {superOver ? "scored" : "finished on"}{" "}
          {summary.runs}/{summary.wickets} from {summary.overs} overs
          {innings.declared ? " (declared)" : ""}
          {superOver ? " in the Super Over" : ""}.
        </p>
        {result && <p className="font-display text-2xl font-bold text-amber-200">{result.text}</p>}
        {plan?.kind === "super-over" && (
          <p className="text-sm text-slate-200">
            {match.innings.filter(isSuperOver).length % 2 === 0
              ? "Scores are level. "
              : ""}
            {nextTeam(plan.battingTeamId)} bat next: one over, two wickets.
          </p>
        )}
        {plan?.kind === "regular" && plan.followOnTeamId && (
          <p className="text-sm text-slate-200">
            {nextTeam(plan.battingTeamId)} lead by {plan.lead} runs and can make{" "}
            {nextTeam(plan.followOnTeamId)} follow on.
          </p>
        )}
        {plan && plan.kind !== "complete" ? (
          <div className="flex flex-col items-center gap-3">
            {plan.kind === "regular" && plan.followOnTeamId && (
              <button
                type="button"
                onClick={() => onAdvanceInnings({ followOn: true })}
                className="h-12 rounded-full bg-amber-300 px-7 text-sm font-extrabold uppercase tracking-wider text-gold-foreground"
              >
                Enforce follow-on
              </button>
            )}
            <button
              type="button"
              onClick={() => onAdvanceInnings()}
              className={
                plan.kind === "regular" && plan.followOnTeamId
                  ? "h-12 rounded-full border border-amber-300/50 px-7 text-sm font-bold text-amber-100"
                  : "h-12 rounded-full bg-amber-300 px-7 text-sm font-extrabold uppercase tracking-wider text-gold-foreground"
              }
            >
              {plan.kind === "super-over"
                ? "Start Super Over"
                : plan.followOnTeamId
                  ? `${firstName} bat again`
                  : "Start next innings"}
            </button>
          </div>
        ) : (
          match.status === "innings-break" && (
            <button
              type="button"
              onClick={() => onAdvanceInnings()}
              className="h-12 rounded-full bg-amber-300 px-7 text-sm font-extrabold uppercase tracking-wider text-gold-foreground"
            >
              Complete match
            </button>
          )
        )}
        <button type="button" onClick={onExit} className="block w-full text-sm text-slate-400">
          Return to matches
        </button>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
      <section className="broadcast-panel order-2 space-y-5 self-start md:p-6 lg:order-1" aria-label="Ball details">
        <h2 className="panel-kicker">Ball details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="hidden lg:block">
            <Field label="Striker">
              <PlayerSelect team={battingTeam} value={strikerId} onChange={setStrikerId} role="bat" />
            </Field>
          </div>
          <Field label="Non-striker">
            <PlayerSelect team={battingTeam} value={nonStrikerId} onChange={setNonStrikerId} role="bat" />
          </Field>
          <div className="hidden lg:block">
            <Field label="Bowler">
              <PlayerSelect team={bowlingTeam} value={bowlerId} onChange={setBowlerId} disabled={bowlingByOther} role="bowl" />
            </Field>
          </div>
          <Field label="Bowling end">
            <select
              disabled={bowlingByOther}
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
                disabled={bowlingByOther}
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

      <section className="order-1 space-y-5 lg:order-2" aria-label="Record delivery">
        <CreaseStrip
          match={match}
          strikerId={strikerId}
          nonStrikerId={nonStrikerId}
          bowlerId={bowlerId}
        />

        <div className="grid grid-cols-2 gap-3 lg:hidden">
          <Field label="Striker">
            <PlayerSelect team={battingTeam} value={strikerId} onChange={setStrikerId} role="bat" />
          </Field>
          <Field label="Bowler">
            <PlayerSelect team={bowlingTeam} value={bowlerId} onChange={setBowlerId} disabled={bowlingByOther} role="bowl" />
          </Field>
        </div>
        {bowlingByOther && (
          <p className="text-[11px] text-slate-400">
            The bowler and end are set by the bowling & fielding scorer.
          </p>
        )}
        {workloadNote && (
          <p role="status" className={`rounded-xl border px-3 py-2 text-xs ${workloadNote.allowed ? "border-amber-300/30 text-amber-200" : "border-rose-400/40 text-rose-200"}`}>
            {findPlayer(match, bowlerId)?.name ?? "Bowler"}: {workloadNote.message}
          </p>
        )}

        {bowlingByOther ? (
          <div className="broadcast-panel space-y-3" aria-label="How was the ball played?">
            <p className="text-xs text-slate-300">
              Fielding positions and fielders are added by the bowling & fielding scorer.
            </p>
            <OutcomeChips value={outcome} onChange={setOutcome} />
          </div>
        ) : (
        <div className="broadcast-panel shot-card" aria-label="Where did the ball go?">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="panel-kicker">Where did it go?</h2>
            <span className="text-[11px] text-muted-foreground">
              Optional · {findPlayer(match, strikerId)?.name ?? "Striker"} on strike
            </span>
          </div>
          <div className="shot-card-grid">
            <ShotZonePicker
              value={fieldZone}
              onChange={chooseZone}
              leftHanded={Boolean(findPlayer(match, strikerId)?.leftHanded ?? leftHanders[strikerId])}
              onHandChange={(left) => {
                setBatterHand(strikerId, left);
                // Saved on the player too, so wagon wheels flip for them everywhere.
                onSave(setPlayerHand(match, strikerId, left));
              }}
              recent={recentPositions}
            />
            <div className="space-y-4">
              {fieldZone !== "Not recorded" ? (
                <FielderChips
                  label="Who fielded it?"
                  players={orderedFielders}
                  value={fielderId}
                  onChange={setFielderId}
                  suggestedId={suggestedFielderId}
                />
              ) : (
                <p className="shot-summary-hint">Pick a fielding position to choose the fielder.</p>
              )}
              <OutcomeChips value={outcome} onChange={setOutcome} />
            </div>
          </div>
          <ShotSummary
            zone={fieldZone}
            fielderName={fielderId ? findPlayer(match, fielderId)?.name : undefined}
            onClear={clearShot}
          />
        </div>
        )}

        <BallTrackPad
          pitch={pitch}
          beehive={beehive}
          onPitch={setPitch}
          onBeehive={setBeehive}
          leftHanded={Boolean(findPlayer(match, strikerId)?.leftHanded ?? leftHanders[strikerId])}
        />

        {(freeHit || superOver) && (
          <div className="rule-banner" role="status">
            <strong>{freeHit ? "Free hit" : "Super Over"}</strong>
            <span>
              {freeHit
                ? "Only a run out (or obstructing the field) can dismiss the batter."
                : "One over, two wickets. Highest score wins."}
            </span>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="panel-kicker">Select runs</h2>
            <p className="text-xs text-muted-foreground">
              Ball{" "}
              <strong className="tabular-nums text-foreground">
                {Math.floor(summary.legalBalls / match.settings.ballsPerOver)}.
                {(summary.legalBalls % match.settings.ballsPerOver) + 1}
              </strong>
            </p>
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
            {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
              <button
                key={runs}
                type="button"
                aria-label={`${runs} ${runs === 1 ? "run" : "runs"}`}
                onClick={() => {
                  navigator.vibrate?.(12);
                  saveBall({ batterRuns: runs, outcome: runs ? "hit" : outcome });
                }}
                className={`run-ring ${runs === 4 || runs === 6 ? "run-ring-boundary" : ""}`}
              >
                {runs}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="panel-kicker mb-3">Extras</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["No ball", Ban, () => saveBall({ extras: { noBall: 1 } })],
                ["Wide", MoveHorizontal, () => saveBall({ extras: { wide: 1 }, outcome: "missed" })],
                ["Bye", CircleDot, () => saveBall({ extras: { bye: 1 }, outcome: "missed" })],
                ["Leg bye", Footprints, () => saveBall({ extras: { legBye: 1 }, outcome: "missed" })],
              ] as const
            ).map(([label, Icon, action]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  navigator.vibrate?.(12);
                  action();
                }}
                className="extra-tile"
              >
                <Icon className="size-4 text-gold" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="panel-kicker mb-3">Wicket</h2>
          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.([20, 40, 20]);
              if (!allowedOut.includes(dismissalType)) setDismissalType(allowedOut[0]!);
              setShowWicket(true);
            }}
            className="wicket-bar"
          >
            <Columns3 className="size-6" aria-hidden="true" /> Wicket
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {freeHit ? "Free hit: run out only" : "Choose how out on the next step"}
          </p>
        </div>

        <BallTrail match={match} />
        <RateStrip match={match} />

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={!innings.deliveries.length || Boolean(undoableRetirement(match))}
            onClick={() => onSave(undoLastDelivery(match), "delivery.voided")}
            className="app-chip-button disabled:opacity-30"
          >
            <Undo2 className="size-4" /> Undo last ball
          </button>
          {undoableRetirement(match) && (
            <button type="button" onClick={() => onSave(undoRetirement(match))} className="app-chip-button">
              <Undo2 className="size-4" /> Undo retirement
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("End this innings now?")) onSave(endCurrentInnings(match));
            }}
            className="app-chip-button"
          >
            <Flag className="size-4" /> End innings
          </button>
          {canDeclare(match) && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Declare ${battingTeam.name}'s innings closed?`)) onSave(declareInnings(match));
              }}
              className="app-chip-button"
            >
              <Flag className="size-4" /> Declare
            </button>
          )}
        </div>
      </section>

      {showWicket && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg space-y-5 rounded-t-3xl border border-white/10 bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-7">
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
                {dismissalTypes.filter((type) => allowedOut.includes(type.value)).map((type) => (
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
              <FielderChips
                label={
                  dismissalType === "caught"
                    ? "Catcher"
                    : dismissalType === "stumped"
                      ? "Wicketkeeper"
                      : "Fielder responsible"
                }
                players={orderedFielders}
                value={dismissalFielderId}
                onChange={setDismissalFielderId}
                allowNone={false}
              />
            )}
            {dismissalType === "caught" && (
              <div>
                <p className="shot-step-label">Catch location</p>
                <ShotZonePicker
                  value={fieldZone}
                  onChange={chooseZone}
                  label="Catch location"
                  leftHanded={Boolean(leftHanders[dismissedBatterId])}
                />
              </div>
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
                  fielderId: dismissalFielderId || undefined,
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
              className="h-13 w-full rounded-full bg-rose-500 text-sm font-extrabold uppercase tracking-wider text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
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
  disabled = false,
  role,
}: {
  team: ReturnType<typeof findTeam>;
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
  disabled?: boolean;
  /** Hide players who can't do this job (fielding subs can't bat or bowl; replaced players can't play on). */
  role?: "bat" | "bowl" | "field";
}) {
  const players = team.players.filter(
    (player) =>
      player.id === value ||
      (role === "bat" ? canBat(player) : role === "bowl" ? canBowl(player) : role === "field" ? !player.replacedBy : true),
  );
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="scorer-input disabled:cursor-not-allowed disabled:opacity-60"
    >
      {allowNone && <option value="">Not recorded</option>}
      {players.map((player) => (
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

function Timeline({
  match,
  onSave,
  canFix,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch, eventType?: string, extra?: Record<string, unknown>) => void;
  canFix: boolean;
}) {
  const [view, setView] = useState<"commentary" | "audit">("commentary");
  return (
    <section className="space-y-4">
      <div className="card-tabs max-w-sm" role="tablist" aria-label="Ball by ball view" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <button type="button" role="tab" aria-selected={view === "commentary"} onClick={() => setView("commentary")}>
          Commentary
        </button>
        <button type="button" role="tab" aria-selected={view === "audit"} onClick={() => setView("audit")}>
          Audit trail
        </button>
      </div>
      {view === "commentary" ? <CommentaryPanel match={match} onSave={onSave} /> : <AuditTrail match={match} onSave={onSave} canFix={canFix} />}
    </section>
  );
}

function CommentaryPanel({
  match,
  onSave,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch, eventType?: string) => void;
}) {
  const innings = currentInnings(match);
  const battingTeam = findTeam(match, innings.battingTeamId);
  const bowlingTeam = findTeam(match, innings.bowlingTeamId);
  const cloudSession = useCloudSession();
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarising, setSummarising] = useState(false);
  const lines = commentaryFeed(innings, match.settings.ballsPerOver, {
    player: (id) => (id ? findPlayer(match, id)?.name : undefined),
    battingTeam: battingTeam.name,
    freeHits: Boolean(match.settings.rules?.freeHit),
  });
  const shared = Boolean(match.audience?.commentary);
  const totals = summarizeInnings(innings, match.settings.ballsPerOver);
  const target = targetForCurrentInnings(match);

  const writeSummary = async () => {
    setSummarising(true);
    setSummaryError(null);
    try {
      // Name-free lines only: roles, never player names, go to the AI.
      const anonymous = commentaryFeed(innings, match.settings.ballsPerOver, { battingTeam: battingTeam.name }, 14)
        .reverse()
        .map((line) => `${line.over}: ${line.text}`);
      const result = await summariseOver({
        data: {
          battingTeam: battingTeam.name,
          bowlingTeam: bowlingTeam.name,
          score: `${totals.runs}/${totals.wickets} after ${totals.overs} overs`,
          ...(target ? { chase: `Chasing ${target}, need ${Math.max(0, target - totals.runs)} more` } : {}),
          lines: anonymous,
        },
      });
      if ("summary" in result) setSummary(result.summary);
      else setSummaryError(result.error);
    } catch {
      setSummaryError("The over summary could not be written right now.");
    } finally {
      setSummarising(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <div className="broadcast-panel p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="panel-kicker">Ball by ball</h2>
          <span className="text-[11px] text-muted-foreground">Written automatically from each ball</span>
        </div>
        <CommentaryFeed lines={lines} />
      </div>
      <div className="space-y-4">
        <div className="broadcast-panel space-y-3 p-4">
          <h2 className="panel-kicker">Share with viewers</h2>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--gold)]"
              checked={shared}
              onChange={(event) =>
                onSave({
                  ...match,
                  audience: { ...match.audience, commentary: event.target.checked },
                  updatedAt: new Date().toISOString(),
                })
              }
            />
            <span>
              <strong className="block">Show ball-by-ball text on the public scoreboard</strong>
              <span className="text-xs text-muted-foreground">
                Viewers see roles like "the batter" instead of player names, to keep juniors private.
              </span>
            </span>
          </label>
        </div>
        <div className="broadcast-panel space-y-3 p-4">
          <h2 className="panel-kicker">AI over summary</h2>
          <p className="text-xs text-muted-foreground">
            A short write-up of the latest overs, written by Lovable AI. Uses AI credits each time.
          </p>
          {cloudSession.session ? (
            <button
              type="button"
              className="action-primary"
              disabled={summarising || innings.deliveries.length === 0}
              onClick={() => void writeSummary()}
            >
              {summarising ? "Writing summary…" : "Write over summary"}
            </button>
          ) : (
            <p className="text-xs text-amber-200">Sign in to your club account to use AI summaries.</p>
          )}
          {summary && <p className="rounded-xl bg-white/[0.05] p-3 text-sm leading-relaxed">{summary}</p>}
          {summaryError && <p className="text-xs text-rose-300">{summaryError}</p>}
        </div>
      </div>
    </div>
  );
}

function AuditTrail({
  match,
  onSave,
  canFix,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch, eventType?: string, extra?: Record<string, unknown>) => void;
  canFix: boolean;
}) {
  const innings = currentInnings(match);
  const [fixing, setFixing] = useState<string | null>(null);
  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Audit trail</p>
        <h2 className="font-display text-3xl font-bold">Every recorded delivery</h2>
        {canFix && <p className="mt-1 text-xs text-muted-foreground">Tap Fix on any ball to change runs, extras, the bowler, the fielder or the wicket.</p>}
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
                className={`flex size-11 items-center justify-center rounded-full text-sm font-extrabold ${ball.dismissal ? "bg-rose-500 text-primary-foreground" : "bg-amber-300 text-gold-foreground"}`}
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
              <div className="flex flex-col items-end gap-2">
                <time className="text-[10px] text-slate-500">
                  {new Date(ball.recordedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                {canFix && fixing !== ball.id && (
                  <button type="button" className="app-chip-button" onClick={() => setFixing(ball.id)}>
                    Fix
                  </button>
                )}
              </div>
              {fixing === ball.id && (
                <div className="col-span-3">
                  <FixBallPanel match={match} delivery={ball} onSave={onSave} onClose={() => setFixing(null)} />
                </div>
              )}
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

function MatchPredictorPanel({
  match,
  onSave,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch, eventType?: string) => void;
}) {
  const innings = currentInnings(match);
  const prediction = currentPrediction(match);
  const [home, away] = match.teams;
  const battingIsHome = innings.battingTeamId === home.id;
  const firstWin = prediction ? (battingIsHome ? prediction.battingWin : prediction.bowlingWin) : null;
  return (
    <WinPredictor
      firstName={home.name}
      secondName={away.name}
      firstWin={firstWin}
      prediction={prediction}
      battingName={findTeam(match, innings.battingTeamId).name}
      timeline={winTimeline(match)}
      conditions={match.conditions}
      onConditionsChange={(conditions) => onSave({ ...match, conditions, updatedAt: new Date().toISOString() })}
      homeName={home.name}
      awayName={away.name}
      unavailableReason={
        match.status === "completed"
          ? `This match has finished. The line shows how ${home.name}'s chances swung.`
          : undefined
      }
    />
  );
}

/** Change free hit, Super Over, last man stands and follow-on during a match (works for cloud matches too). */
function LiveRulesPanel({
  match,
  onSave,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch, eventType?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rules = match.settings.rules ?? {};
  const active = [
    rules.freeHit && "Free hit",
    rules.superOver && "Super Over",
    rules.lastManStands && "Last man stands",
    rules.followOnLead != null && `Follow-on ${rules.followOnLead}`,
  ].filter(Boolean);
  return (
    <section className="broadcast-panel" aria-label="Match rules">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="panel-kicker block">Match rules</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {active.length ? active.join(" · ") : "Standard rules only"}
          </span>
        </span>
        <span className="text-sm font-bold text-gold">{open ? "Close" : "Change"}</span>
      </button>
      {open && (
        <div className="mt-4">
          <MatchRulesFields
            rules={rules}
            inningsPerSide={match.settings.inningsPerSide}
            limitedOvers={match.settings.oversPerInnings !== null}
            locked={{
              superOver: match.innings.some(isSuperOver),
              followOn: match.innings.length > 2,
            }}
            onChange={(next) =>
              onSave({
                ...match,
                settings: { ...match.settings, rules: next },
                updatedAt: new Date().toISOString(),
              })
            }
          />
        </div>
      )}
    </section>
  );
}

function Scorecard({
  match,
  onSave,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch, eventType?: string) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <ScorecardView match={match} />
      <MatchPredictorPanel match={match} onSave={onSave} />
    </div>
  );
}

function SplitTable({ title, rows }: { title: string; rows: SplitRow[] }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 text-left font-semibold"> </th>
            <th className="text-right font-semibold">Runs</th>
            <th className="text-right font-semibold">Balls</th>
            <th className="text-right font-semibold">Wkts</th>
            <th className="text-right font-semibold">Dots</th>
            <th className="text-right font-semibold">4s/6s</th>
            <th className="text-right font-semibold">Rate</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border/60">
              <td className="py-1.5 font-semibold">{row.label}</td>
              <td className="text-right">{row.runs}</td>
              <td className="text-right">{row.balls}</td>
              <td className="text-right">{row.wickets}</td>
              <td className="text-right">{row.dots}</td>
              <td className="text-right">{row.boundaries}</td>
              <td className="text-right">{row.runRate.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Powerplay / middle / death and pace / spin, for the team or one batter, plus a spreadsheet download. */
function MatchSplits({ match }: { match: CricketMatch }) {
  const innings = currentInnings(match);
  const batting = findTeam(match, innings.battingTeamId);
  const [batterId, setBatterId] = useState("");
  const filter = (d: Delivery) => !batterId || d.strikerId === batterId;
  const faced = batting.players.filter((p) => innings.deliveries.some((d) => d.strikerId === p.id));
  const stamp = new Date(match.createdAt).toISOString().slice(0, 10);
  const base = `${match.teams[0].name}-v-${match.teams[1].name}-${stamp}`;
  return (
    <div className="broadcast-panel space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-kicker">Phases &amp; bowling types</h2>
        <select className="scorer-input w-auto" value={batterId} onChange={(e) => setBatterId(e.target.value)} aria-label="Whose balls">
          <option value="">{batting.name} (all)</option>
          {faced.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <SplitTable title="By phase" rows={phaseSplits(match, innings, filter)} />
      <SplitTable title="Against pace and spin" rows={bowlingTypeSplits(innings.deliveries.filter(filter))} />
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <button type="button" className="action-secondary" onClick={() => downloadCsv(`${base}-ball-by-ball.csv`, ballByBallCsv(match))}>
          <Download className="size-4" /> Ball by ball (spreadsheet)
        </button>
        <button type="button" className="action-secondary" onClick={() => downloadCsv(`${base}-scorecard.csv`, scorecardCsv(match))}>
          <Download className="size-4" /> Scorecard (spreadsheet)
        </button>
      </div>
    </div>
  );
}

function Analysis({ match }: { match: CricketMatch }) {
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
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
  const leftHanded = (id: string) => Boolean(findPlayer(match, id)?.leftHanded);
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <ScorerWagonWheel
        key={innings.id}
        innings={innings}
        players={match.teams.flatMap((team) => team.players)}
      />
      <div className="broadcast-panel space-y-3 p-5">
        <h2 className="panel-kicker">Pitch map &amp; beehive</h2>
        <BallTrackChart deliveries={innings.deliveries} leftHanded={leftHanded} />
      </div>
      <MatchSplits match={match} />
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
