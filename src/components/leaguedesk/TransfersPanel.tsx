import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { Empty, OfficeCard, OfficeField, Pill, day } from "@/components/office/ui";
import { attempt, isClubAdmin, must, type DeskProps } from "./shared";

interface Transfer {
  id: string;
  player_name: string;
  from_club_id: string;
  to_club_id: string;
  status: string;
  note: string | null;
  created_at: string;
}

/** Release a player to another club; the receiving club accepts and the player joins their list. */
export function TransfersPanel(props: DeskProps) {
  const { organisationId, club } = props;
  const db = getCloudClient();
  const admin = isClubAdmin(props);
  const [rows, setRows] = useState<Transfer[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    const { data } = await db
      .from("player_transfers")
      .select("id,player_name,from_club_id,to_club_id,status,note,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data ?? []) as Transfer[]);
  }, [db]);
  useEffect(() => void load(), [load]);
  const incoming = rows.filter((r) => r.to_club_id === organisationId && r.status === "offered");
  return (
    <div className="space-y-4">
      {admin && (
        <OfficeCard
          title="Release a player"
          description="Ask the other club for their CricLume web address name (for example riverside-cc)."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <OfficeField label="Player">
              <select
                className="scorer-input"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
              >
                <option value="">Choose</option>
                {club.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </OfficeField>
            <OfficeField label="To club">
              <input
                className="scorer-input"
                value={to}
                maxLength={80}
                onChange={(e) => setTo(e.target.value)}
                placeholder="riverside-cc"
              />
            </OfficeField>
            <OfficeField label="Note">
              <input
                className="scorer-input"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Moving to the area"
              />
            </OfficeField>
          </div>
          <button
            type="button"
            className="action-primary mt-3"
            disabled={!playerId || !to.trim()}
            onClick={() =>
              void attempt(
                () =>
                  must(
                    db.rpc("offer_player_transfer", {
                      p_player_id: playerId,
                      p_to_club: to.trim(),
                      p_note: note,
                    }),
                  ),
                "Transfer offered — the other club will see it",
                load,
              )
            }
          >
            <ArrowRightLeft className="size-4" /> Offer transfer
          </button>
        </OfficeCard>
      )}
      {incoming.length > 0 && (
        <OfficeCard title="Players joining you">
          <ul className="space-y-2">
            {incoming.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <span className="flex-1">
                  <strong>{r.player_name}</strong>
                  {r.note ? <small className="office-meta block">“{r.note}”</small> : null}
                </span>
                {admin && (
                  <>
                    <button
                      type="button"
                      className="action-secondary"
                      onClick={() =>
                        void attempt(
                          () =>
                            must(
                              db.rpc("answer_player_transfer", { p_id: r.id, p_answer: "accept" }),
                            ),
                          `${r.player_name} has joined your club`,
                          load,
                        )
                      }
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="app-chip-button"
                      onClick={() =>
                        void attempt(
                          () =>
                            must(
                              db.rpc("answer_player_transfer", { p_id: r.id, p_answer: "decline" }),
                            ),
                          "Declined",
                          load,
                        )
                      }
                    >
                      Decline
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </OfficeCard>
      )}
      <OfficeCard title="Transfer history">
        {rows.length === 0 ? (
          <Empty>No transfers yet.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1">
                  {r.player_name} ·{" "}
                  {r.from_club_id === organisationId
                    ? "leaving"
                    : r.to_club_id === organisationId
                      ? "joining"
                      : "between member clubs"}{" "}
                  · {day(r.created_at)}
                </span>
                <Pill
                  tone={r.status === "completed" ? "good" : r.status === "offered" ? "warn" : "bad"}
                >
                  {r.status}
                </Pill>
                {admin && r.status === "offered" && r.from_club_id === organisationId && (
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() =>
                      void attempt(
                        () =>
                          must(
                            db.rpc("answer_player_transfer", { p_id: r.id, p_answer: "cancel" }),
                          ),
                        "Transfer cancelled",
                        load,
                      )
                    }
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>
    </div>
  );
}
