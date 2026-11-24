import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BellRing,
  Banknote,
  Car,
  Coins,
  ClipboardList,
  Gavel,
  HandHeart,
  History,
  KeyRound,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Shirt,
  Ticket,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { can } from "@/lib/platform";
import type { PlatformRole } from "@/lib/platform";
import type { PlatformDashboardData } from "@/lib/platform-cloud";
import { friendly, loadClubOffice, type ClubOfficeData } from "@/lib/club-office-cloud";
import { createRefreshCoordinator } from "@/lib/refresh-coordinator";
import { EventsPanel } from "./EventsPanel";
import { SelectionPanel } from "./SelectionPanel";
import { FeesPanel } from "./FeesPanel";
import { BookingsPanel } from "./BookingsPanel";
import { TravelPanel } from "./TravelPanel";
import { StorePanel } from "./StorePanel";
import { AccessPanel } from "./AccessPanel";
import { AdEarningsPanel } from "./AdEarningsPanel";
import { ClubPromosPanel } from "./ClubPromosPanel";
import { UmpiresPanel } from "./UmpiresPanel";
import { VolunteersPanel } from "./VolunteersPanel";
import { ActivityPanel, PeoplePanel } from "./PeoplePanel";
import { RemindersPanel } from "./RemindersPanel";
import { TicketsPanel } from "./TicketsPanel";
import { isTicketGate } from "@/lib/tickets";
import type { OfficeProps } from "./ui";

const tabs = [
  ["events", "Events", ClipboardList],
  ["selection", "Team selection", UsersRound],
  ["fees", "Fees", Banknote],
  ["bookings", "Bookings", MapPin],
  ["travel", "Travel", Car],
  ["store", "Kit and shop", Shirt],
  ["tickets", "Tickets", Ticket],
  ["volunteers", "Volunteers", HandHeart],
  ["umpires", "Umpires", Gavel],
  ["reminders", "Reminders", BellRing],
  ["people", "Join requests", UserPlus],
  ["ads", "Ad earnings", Coins],
  ["access", "Access", KeyRound],
  ["activity", "Activity", History],
] as const;
type Tab = (typeof tabs)[number][0];

const remindersVisible = (role: PlatformRole) =>
  role === "owner" ||
  role === "club_admin" ||
  role === "league_admin" ||
  can(role, "events.manage") ||
  can(role, "fees.manage") ||
  can(role, "umpires.manage");

type ClubOfficeProps = {
  organisationId: string;
  role: PlatformRole;
  club: PlatformDashboardData;
};

type OfficeScope = {
  coordinator: ReturnType<typeof createRefreshCoordinator>;
  ready: boolean;
  saving: boolean;
};

export function ClubOffice(props: ClubOfficeProps) {
  return <ScopedClubOffice key={`${props.organisationId}:${props.role}`} {...props} />;
}

function ScopedClubOffice({ organisationId, role, club }: ClubOfficeProps) {
  const [tab, setTab] = useState<Tab>("events");
  const [data, setData] = useState<ClubOfficeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<number | null>(null);
  const scopeRef = useRef<OfficeScope | null>(null);

  useEffect(() => {
    const coordinator = createRefreshCoordinator(async () => {
      if (!coordinator.isActive()) return;
      setRefreshing(true);
      try {
        const next = await loadClubOffice(organisationId);
        if (!coordinator.isActive()) return;
        scope.ready = true;
        setData(next);
        setError(null);
        setLastLoaded(Date.now());
      } catch (reason) {
        if (!coordinator.isActive()) return;
        scope.ready = false;
        setError(
          reason instanceof Error ? friendly(reason.message) : "The club office could not load.",
        );
      } finally {
        if (coordinator.isActive()) setRefreshing(false);
      }
    });
    const scope: OfficeScope = { coordinator, ready: false, saving: false };
    scopeRef.current = scope;
    const refresh = () => void coordinator.request();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      coordinator.dispose();
      if (scopeRef.current === scope) scopeRef.current = null;
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [organisationId]);

  const reload = useCallback(async () => {
    await scopeRef.current?.coordinator.request();
  }, []);

  const act = useCallback<OfficeProps["act"]>(async (action, done) => {
    const scope = scopeRef.current;
    if (!scope || !scope.coordinator.isActive()) return false;
    if (!scope.ready) {
      toast.error("Refresh the club office before making changes.");
      return false;
    }
    if (scope.saving) {
      toast.info("Another club office change is being saved.");
      return false;
    }
    scope.saving = true;
    setSaving(true);
    try {
      await action();
      if (scope.coordinator.isActive() && done) toast.success(done);
      await scope.coordinator.request();
      return true;
    } catch (reason) {
      if (scope.coordinator.isActive()) {
        toast.error(reason instanceof Error ? friendly(reason.message) : "That didn't work.");
      }
      await scope.coordinator.request();
      return false;
    } finally {
      scope.saving = false;
      if (scope.coordinator.isActive()) setSaving(false);
    }
  }, []);
  const props: OfficeProps | null = data ? { organisationId, role, data, club, act } : null;
  const visibleTabs = tabs.filter(
    ([value]) =>
      (value !== "umpires" || can(role, "umpires.pay")) &&
      (value !== "reminders" || remindersVisible(role)) &&
      (value !== "tickets" || isTicketGate(role)),
  );
  return (
    <div className="space-y-4">
      <div>
        <p className="panel-kicker">Club office</p>
        <h2 className="text-2xl font-bold tracking-tight">Run the club</h2>
        <p className="office-meta">
          Events, availability, selection, fees, bookings, lifts, kit, tickets, volunteers and
          umpires — each person sees only what their role allows.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="office-meta" role="status">
          {saving
            ? "Saving changes…"
            : refreshing
              ? "Refreshing office records…"
              : lastLoaded
                ? `Last loaded ${new Date(lastLoaded).toLocaleTimeString()}`
                : "Waiting for club office records"}
        </p>
        <button
          type="button"
          className="action-secondary"
          disabled={refreshing || saving}
          onClick={() => void reload()}
        >
          <RefreshCw className="size-4" aria-hidden="true" /> Refresh office
        </button>
      </div>
      {error && data && (
        <p
          role="alert"
          className="rounded-xl border border-amber-300/30 p-3 text-sm text-amber-200"
        >
          Refresh failed. Displayed records may be out of date. Refresh before saving changes.
        </p>
      )}
      <label className="block md:hidden">
        <span className="office-label">Club office section</span>
        <select
          className="scorer-input w-full"
          value={tab}
          onChange={(event) => {
            const selected = visibleTabs.find(([value]) => value === event.target.value);
            if (selected) setTab(selected[0]);
          }}
        >
          {visibleTabs.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="hidden md:block">
        <nav className="office-tabs" aria-label="Club office">
          {visibleTabs.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-current={tab === value ? "page" : undefined}
              className="office-tab"
              onClick={() => setTab(value)}
            >
              <Icon className="size-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>
      </div>
      {error && !data && (
        <div className="office-card">
          <p className="office-meta">{error}</p>
          <button type="button" className="action-secondary mt-3" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}
      {!props && !error && (
        <div className="office-card flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> Loading the club office…
        </div>
      )}
      {props && (
        <div aria-busy={saving || refreshing}>
          {tab === "events" && <EventsPanel {...props} />}
          {tab === "selection" && <SelectionPanel {...props} />}
          {tab === "fees" && <FeesPanel {...props} />}
          {tab === "bookings" && <BookingsPanel {...props} />}
          {tab === "travel" && <TravelPanel {...props} />}
          {tab === "store" && <StorePanel {...props} />}
          {tab === "tickets" && isTicketGate(role) && (
            <TicketsPanel key={organisationId} {...props} />
          )}
          {tab === "volunteers" && <VolunteersPanel key={organisationId} {...props} />}
          {tab === "umpires" && can(role, "umpires.pay") && (
            <UmpiresPanel key={organisationId} {...props} />
          )}
          {tab === "ads" && (
            <div className="space-y-4">
              <AdEarningsPanel organisationId={organisationId} role={role} />
              <ClubPromosPanel organisationId={organisationId} role={role} />
            </div>
          )}
          {tab === "access" && <AccessPanel {...props} />}
          {tab === "reminders" && remindersVisible(role) && (
            <RemindersPanel key={organisationId} {...props} />
          )}
          {tab === "people" && <PeoplePanel key={organisationId} {...props} />}
          {tab === "activity" && <ActivityPanel key={organisationId} {...props} />}
        </div>
      )}
    </div>
  );
}
