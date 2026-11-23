import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Banknote, Car, Coins, ClipboardList, Gavel, HandHeart, History, KeyRound, LoaderCircle, MapPin, Shirt, UserPlus, UsersRound } from "lucide-react";
import { can } from "@/lib/platform";
import type { PlatformRole } from "@/lib/platform";
import type { PlatformDashboardData } from "@/lib/platform-cloud";
import { friendly, loadClubOffice, type ClubOfficeData } from "@/lib/club-office-cloud";
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
import type { OfficeProps } from "./ui";

const tabs = [
  ["events", "Events", ClipboardList],
  ["selection", "Team selection", UsersRound],
  ["fees", "Fees", Banknote],
  ["bookings", "Bookings", MapPin],
  ["travel", "Travel", Car],
  ["store", "Kit and shop", Shirt],
  ["volunteers", "Volunteers", HandHeart],
  ["umpires", "Umpires", Gavel],
  ["people", "Join requests", UserPlus],
  ["ads", "Ad earnings", Coins],
  ["access", "Access", KeyRound],
  ["activity", "Activity", History],
] as const;
type Tab = (typeof tabs)[number][0];

export function ClubOffice({ organisationId, role, club }: { organisationId: string; role: PlatformRole; club: PlatformDashboardData }) {
  const [tab, setTab] = useState<Tab>("events");
  const [data, setData] = useState<ClubOfficeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const next = await loadClubOffice(organisationId);
      if (id === request.current) {
        setData(next);
        setError(null);
      }
    } catch (reason) {
      if (id === request.current) setError(reason instanceof Error ? friendly(reason.message) : "The club office could not load.");
    }
  }, [organisationId]);
  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);
  const act = useCallback<OfficeProps["act"]>(
    async (action, done) => {
      try {
        await action();
        if (done) toast.success(done);
        await reload();
        return true;
      } catch (reason) {
        toast.error(reason instanceof Error ? friendly(reason.message) : "That didn't work.");
        await reload();
        return false;
      }
    },
    [reload],
  );
  const props: OfficeProps | null = data ? { organisationId, role, data, club, act } : null;
  return (
    <div className="space-y-4">
      <div>
        <p className="panel-kicker">Club office</p>
        <h2 className="text-2xl font-bold tracking-tight">Run the club</h2>
        <p className="office-meta">Events, availability, selection, fees, bookings, lifts, kit, volunteers and umpires — each person sees only what their role allows.</p>
      </div>
      <div className="office-tabs" role="tablist" aria-label="Club office">
        {tabs.filter(([value]) => value !== "umpires" || can(role, "umpires.pay")).map(([value, label, Icon]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className="office-tab" onClick={() => setTab(value)}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
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
        <div role="tabpanel">
          {tab === "events" && <EventsPanel {...props} />}
          {tab === "selection" && <SelectionPanel {...props} />}
          {tab === "fees" && <FeesPanel {...props} />}
          {tab === "bookings" && <BookingsPanel {...props} />}
          {tab === "travel" && <TravelPanel {...props} />}
          {tab === "store" && <StorePanel {...props} />}
          {tab === "volunteers" && <VolunteersPanel key={organisationId} {...props} />}
          {tab === "umpires" && can(role, "umpires.pay") && <UmpiresPanel key={organisationId} {...props} />}
          {tab === "ads" && (
            <div className="space-y-4">
              <AdEarningsPanel organisationId={organisationId} role={role} />
              <ClubPromosPanel organisationId={organisationId} role={role} />
            </div>
          )}
          {tab === "access" && <AccessPanel {...props} />}
          {tab === "people" && <PeoplePanel key={organisationId} {...props} />}
          {tab === "activity" && <ActivityPanel key={organisationId} {...props} />}
        </div>
      )}
    </div>
  );
}
