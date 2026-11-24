import { useCallback, useEffect, useState } from "react";
import { Gavel, Plus } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { parseLots, teamPosition } from "@/lib/auction";
import { Empty, OfficeCard, OfficeField, Pill } from "@/components/office/ui";
import { attempt, money, must, toMinor, type DeskProps } from "./shared";

interface Auction {
  id: string;
  title: string;
  status: string;
  purse_minor: number;
  currency: string;
  max_squad: number;
  current_lot_id: string | null;
}
interface Lot {
  id: string;
  player_name: string;
  role: string | null;
  base_price_minor: number;
  sort: number;
  status: string;
  sold_team_id: string | null;
  sold_price_minor: number | null;
}

/** Franchise-style player auction: teams with a purse, player lots, and a sell button that checks the purse. */
export function AuctionPanel({ organisationId, role, club }: DeskProps) {
  const db = getCloudClient();
  const runner = ["owner", "league_admin", "club_admin"].includes(role);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [activeId, setActiveId] = useState("");
  const [title, setTitle] = useState("Players' auction");
  const [purse, setPurse] = useState("1000");
  const [currency, setCurrency] = useState("GBP");
  const [squad, setSquad] = useState("12");
  const load = useCallback(async () => {
    const { data } = await db
      .from("auctions")
      .select("*")
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Auction[];
    setAuctions(list);
    setActiveId((id) => id || list[0]?.id || "");
  }, [db, organisationId]);
  useEffect(() => void load(), [load]);
  const active = auctions.find((a) => a.id === activeId);
  return (
    <div className="space-y-4">
      {runner && (
        <OfficeCard title="New auction">
          <div className="grid gap-3 sm:grid-cols-4">
            <OfficeField label="Title">
              <input
                className="scorer-input"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </OfficeField>
            <OfficeField label="Purse per team">
              <input
                className="scorer-input"
                inputMode="decimal"
                value={purse}
                onChange={(e) => setPurse(e.target.value)}
              />
            </OfficeField>
            <OfficeField label="Currency">
              <input
                className="scorer-input"
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </OfficeField>
            <OfficeField label="Max squad">
              <input
                className="scorer-input"
                inputMode="numeric"
                value={squad}
                onChange={(e) => setSquad(e.target.value.replace(/\D/g, ""))}
              />
            </OfficeField>
          </div>
          <button
            type="button"
            className="action-primary mt-3"
            onClick={() =>
              void attempt(
                () =>
                  must(
                    db
                      .from("auctions")
                      .insert({
                        organisation_id: organisationId,
                        title: title.trim(),
                        purse_minor: toMinor(purse),
                        currency,
                        max_squad: Number(squad) || 12,
                      }),
                  ),
                "Auction created",
                load,
              )
            }
          >
            <Plus className="size-4" /> Create
          </button>
        </OfficeCard>
      )}
      {auctions.length > 1 && (
        <select
          className="scorer-input max-w-sm"
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          aria-label="Auction"
        >
          {auctions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      )}
      {!active ? (
        <Empty>No auctions yet.</Empty>
      ) : (
        <AuctionRoom
          key={active.id}
          auction={active}
          runner={runner}
          club={club}
          onChanged={load}
        />
      )}
    </div>
  );
}

function AuctionRoom({
  auction,
  runner,
  club,
  onChanged,
}: {
  auction: Auction;
  runner: boolean;
  club: DeskProps["club"];
  onChanged: () => Promise<void>;
}) {
  const db = getCloudClient();
  const [teams, setTeams] = useState<string[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [paste, setPaste] = useState("");
  const [bid, setBid] = useState<{ team: string; price: string }>({ team: "", price: "" });
  const load = useCallback(async () => {
    const [t, l] = await Promise.all([
      db.from("auction_teams").select("team_id").eq("auction_id", auction.id),
      db
        .from("auction_lots")
        .select("*")
        .eq("auction_id", auction.id)
        .order("sort")
        .order("player_name"),
    ]);
    setTeams(((t.data ?? []) as { team_id: string }[]).map((r) => r.team_id));
    setLots((l.data ?? []) as Lot[]);
  }, [auction.id, db]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (auction.status !== "live") return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [auction.status, load]);
  const teamName = (id: string) => club.teams.find((t) => t.id === id)?.name ?? "Team";
  const minBase = Math.min(
    ...lots.filter((l) => l.status !== "sold").map((l) => l.base_price_minor),
    Infinity,
  );
  const current =
    lots.find((l) => l.id === auction.current_lot_id) ?? lots.find((l) => l.status === "waiting");
  const reload = async () => {
    await load();
    await onChanged();
  };
  return (
    <div className="space-y-4">
      <OfficeCard
        title={auction.title}
        description={`Purse ${money(auction.purse_minor, auction.currency)} · squad of ${auction.max_squad}`}
        action={
          <Pill
            tone={auction.status === "live" ? "good" : auction.status === "closed" ? "bad" : "warn"}
          >
            {auction.status}
          </Pill>
        }
      >
        {runner && auction.status === "setup" && (
          <div className="space-y-3">
            <p className="office-label">Teams in the auction</p>
            <div className="flex flex-wrap gap-1.5">
              {club.teams.map((t) => {
                const on = teams.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="app-chip-button"
                    aria-pressed={on}
                    onClick={() =>
                      void attempt(
                        () =>
                          must(
                            on
                              ? db
                                  .from("auction_teams")
                                  .delete()
                                  .eq("auction_id", auction.id)
                                  .eq("team_id", t.id)
                              : db
                                  .from("auction_teams")
                                  .insert({ auction_id: auction.id, team_id: t.id }),
                          ),
                        on ? "Team removed" : "Team added",
                        load,
                      )
                    }
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            <OfficeField label="Add players — one per line: name, role, base price">
              <textarea
                className="scorer-input min-h-24"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"Ali Khan, Batter, 50\nSam Patel, Spinner, 30"}
              />
            </OfficeField>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="action-secondary"
                disabled={!parseLots(paste).length}
                onClick={() =>
                  void attempt(
                    () =>
                      must(
                        db
                          .from("auction_lots")
                          .insert(
                            parseLots(paste).map((l, i) => ({
                              ...l,
                              auction_id: auction.id,
                              sort: lots.length + i,
                            })),
                          ),
                      ),
                    "Players added",
                    async () => {
                      setPaste("");
                      await load();
                    },
                  )
                }
              >
                Add {parseLots(paste).length || ""} players
              </button>
              <button
                type="button"
                className="action-primary"
                disabled={teams.length < 2 || !lots.length}
                onClick={() =>
                  void attempt(
                    () => must(db.from("auctions").update({ status: "live" }).eq("id", auction.id)),
                    "Auction is live",
                    reload,
                  )
                }
              >
                <Gavel className="size-4" /> Start auction
              </button>
            </div>
          </div>
        )}
        {auction.status === "live" && current && (
          <div className="rounded-2xl border border-gold/50 p-4">
            <p className="panel-kicker">Now under the hammer</p>
            <p className="font-display text-3xl font-bold">{current.player_name}</p>
            <p className="office-meta">
              {current.role ?? "Player"} · base {money(current.base_price_minor, auction.currency)}
            </p>
            {runner && (
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  className="scorer-input w-auto"
                  value={bid.team}
                  onChange={(e) => setBid({ ...bid, team: e.target.value })}
                  aria-label="Winning team"
                >
                  <option value="">Winning team</option>
                  {teams.map((id) => (
                    <option key={id} value={id}>
                      {teamName(id)}
                    </option>
                  ))}
                </select>
                <input
                  className="scorer-input w-28"
                  inputMode="decimal"
                  placeholder="Price"
                  value={bid.price}
                  onChange={(e) => setBid({ ...bid, price: e.target.value })}
                />
                <button
                  type="button"
                  className="action-primary"
                  disabled={!bid.team}
                  onClick={() =>
                    void attempt(
                      () =>
                        must(
                          db.rpc("sell_auction_lot", {
                            p_lot_id: current.id,
                            p_team_id: bid.team,
                            p_price_minor: toMinor(bid.price),
                          }),
                        ),
                      `Sold to ${teamName(bid.team)}`,
                      async () => {
                        setBid({ team: "", price: "" });
                        await load();
                      },
                    )
                  }
                >
                  Sold
                </button>
                <button
                  type="button"
                  className="app-chip-button"
                  onClick={() =>
                    void attempt(
                      () =>
                        must(
                          db
                            .from("auction_lots")
                            .update({ status: "unsold", sort: lots.length + 1 })
                            .eq("id", current.id),
                        ),
                      "Unsold — moved to the end",
                      load,
                    )
                  }
                >
                  Unsold
                </button>
              </div>
            )}
          </div>
        )}
        {auction.status === "live" && runner && !current && (
          <button
            type="button"
            className="action-primary"
            onClick={() =>
              void attempt(
                () => must(db.from("auctions").update({ status: "closed" }).eq("id", auction.id)),
                "Auction closed",
                reload,
              )
            }
          >
            Close auction
          </button>
        )}
      </OfficeCard>
      {teams.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((id) => {
            const pos = teamPosition(
              lots,
              id,
              auction.purse_minor,
              auction.max_squad,
              Number.isFinite(minBase) ? minBase : 0,
            );
            return (
              <OfficeCard
                key={id}
                title={teamName(id)}
                description={`${pos.bought}/${auction.max_squad} players · ${money(pos.left, auction.currency)} left · max bid ${money(pos.maxBid, auction.currency)}`}
              >
                <ul className="space-y-0.5 text-sm">
                  {lots
                    .filter((l) => l.sold_team_id === id && l.status === "sold")
                    .map((l) => (
                      <li key={l.id} className="flex justify-between">
                        <span>{l.player_name}</span>
                        <span className="tabular-nums">
                          {money(l.sold_price_minor ?? 0, auction.currency)}
                        </span>
                      </li>
                    ))}
                </ul>
              </OfficeCard>
            );
          })}
        </div>
      )}
      <OfficeCard
        title="All players"
        description={`${lots.filter((l) => l.status === "sold").length} sold · ${lots.filter((l) => l.status === "waiting").length} waiting · ${lots.filter((l) => l.status === "unsold").length} unsold`}
      >
        {lots.length === 0 ? (
          <Empty>Add players to the auction.</Empty>
        ) : (
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {lots.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5"
              >
                <span className="truncate">
                  {l.player_name} <small className="office-meta">{l.role}</small>
                </span>
                {l.status === "sold" ? (
                  <Pill tone="good">{teamName(l.sold_team_id ?? "")}</Pill>
                ) : (
                  <Pill tone={l.status === "unsold" ? "bad" : undefined}>{l.status}</Pill>
                )}
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>
    </div>
  );
}
