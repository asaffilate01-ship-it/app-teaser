import { useState } from "react";
import { ArrowRightLeft, ClipboardCheck, FileUp, Gavel, Hammer, Star } from "lucide-react";
import { RegistrationPanel } from "./RegistrationPanel";
import { TransfersPanel } from "./TransfersPanel";
import { DisciplinePanel } from "./DisciplinePanel";
import { MarksPanel } from "./MarksPanel";
import { AuctionPanel } from "./AuctionPanel";
import { OldStatsPanel } from "./OldStatsPanel";
import type { DeskProps } from "./shared";

const tabs = [
  ["registration", "Registration", ClipboardCheck],
  ["transfers", "Transfers", ArrowRightLeft],
  ["discipline", "Discipline", Gavel],
  ["marks", "Captain's marks", Star],
  ["auction", "Auction", Hammer],
  ["history", "Old stats", FileUp],
] as const;
type Tab = (typeof tabs)[number][0];

/** Registration, eligibility, transfers, discipline, captain's marks, auctions and old-stat imports. */
export function LeagueDesk(props: DeskProps) {
  const [tab, setTab] = useState<Tab>("registration");
  const league = props.kind === "league";
  return (
    <div className="space-y-4">
      <div>
        <p className="panel-kicker">{league ? "League admin" : "Leagues & registration"}</p>
        <h2 className="text-2xl font-bold tracking-tight">{league ? "Entries, eligibility and discipline" : "Enter competitions and register players"}</h2>
        <p className="office-meta">{league ? "Open registration with fees and rules, approve teams, grant permits, handle discipline, and see captains' marks." : "Enter teams, register players, check a match XI is eligible, transfer players and mark umpires."}</p>
      </div>
      <div className="office-tabs" role="tablist" aria-label="League desk">
        {tabs.filter(([value]) => !(league && (value === "transfers" || value === "history"))).map(([value, label, Icon]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className="office-tab" onClick={() => setTab(value)}><Icon className="size-4" /> {label}</button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "registration" && <RegistrationPanel {...props} />}
        {tab === "transfers" && <TransfersPanel {...props} />}
        {tab === "discipline" && <DisciplinePanel {...props} />}
        {tab === "marks" && <MarksPanel {...props} />}
        {tab === "auction" && <AuctionPanel {...props} />}
        {tab === "history" && <OldStatsPanel {...props} />}
      </div>
    </div>
  );
}
