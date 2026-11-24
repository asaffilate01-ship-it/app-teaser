import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Copy, Link2, Printer, Share2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CricketMatch } from "@/lib/cricket";
import type { PlayerRecord } from "@/lib/platform-cloud";
import { scoutingReport } from "@/lib/scouting";
import {
  hashShareToken,
  newShareToken,
  SHARE_DAYS,
  shareExpiry,
  shareLink,
} from "@/lib/scouting-share";
import type { Json } from "@/integrations/supabase/types";
import { ScoutingReportView } from "./ScoutingReportView";

interface ShareRow {
  id: string;
  recipient: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
}

/** Coach's scouting report for one player, with consent-checked secret links to send to bigger teams. */
export function ScoutingPanel({
  matches,
  playerId,
  organisationId,
  player,
}: {
  matches: readonly CricketMatch[];
  playerId: string;
  organisationId: string;
  player: PlayerRecord | undefined;
}) {
  const [notes, setNotes] = useState({ strengths: "", weaknesses: "", notes: "", author: "" });
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [days, setDays] = useState<number>(30);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const report = useMemo(
    () => scoutingReport(matches, playerId, notes),
    [matches, playerId, notes],
  );

  const loadShares = useCallback(async () => {
    const { data } = await supabase
      .from("scouting_reports")
      .select("id,recipient,created_at,expires_at,revoked_at,view_count,last_viewed_at")
      .eq("organisation_id", organisationId)
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(20);
    setShares((data as ShareRow[] | null) ?? []);
  }, [organisationId, playerId]);

  useEffect(() => {
    if (open) void loadShares();
  }, [open, loadShares]);

  async function createShare() {
    if (!report) return;
    if (recipient.trim().length < 2)
      return void toast.error(
        "Say who the report is for, e.g. 'Lahore Qalandars academy – Coach Ahmed'.",
      );
    if (!consented)
      return void toast.error("Tick the box to confirm the player (or parent) agreed.");
    setBusy(true);
    try {
      const token = newShareToken();
      const { error } = await supabase.from("scouting_reports").insert({
        organisation_id: organisationId,
        player_id: playerId,
        recipient: recipient.trim().slice(0, 160),
        report: report as unknown as Json,
        token_hash: await hashShareToken(token),
        expires_at: shareExpiry(days),
      });
      if (error) {
        const message = /row-level security|42501/i.test(error.message)
          ? player?.isJunior
            ? "Only the club owner or safeguarding officer can share a junior player's report, and the player needs coaching consent on file."
            : "This player needs coaching consent on file first, and only owners, admins, coaches or safeguarding officers can share."
          : "The report could not be shared. Try again.";
        throw new Error(message);
      }
      setLink(shareLink(window.location.origin, token));
      setRecipient("");
      setConsented(false);
      toast.success("Share link ready. Copy it now — for safety it is shown only once.");
      void loadShares();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The report could not be shared.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const { error } = await supabase
      .from("scouting_reports")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Could not switch off that link.");
    else {
      toast.success("Link switched off.");
      void loadShares();
    }
  }

  if (!report) return null;
  return (
    <section className="space-y-3" aria-label="Scouting report">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button
          type="button"
          className={open ? "action-secondary" : "action-primary"}
          onClick={() => setOpen((value) => !value)}
        >
          <ClipboardList className="size-4" aria-hidden="true" />{" "}
          {open ? "Hide scouting report" : "Scouting report"}
        </button>
        {open && (
          <button type="button" className="action-secondary" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" /> Print or save PDF
          </button>
        )}
      </div>
      {open && (
        <>
          <article className="broadcast-panel space-y-2 no-print">
            <p className="panel-kicker">Coach's view (added to the report)</p>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs">
                Strengths
                <textarea
                  className="scout-input"
                  rows={2}
                  maxLength={400}
                  value={notes.strengths}
                  onChange={(event) => setNotes({ ...notes, strengths: event.target.value })}
                  placeholder="e.g. Calm under pressure, strong cut shot"
                />
              </label>
              <label className="text-xs">
                To work on
                <textarea
                  className="scout-input"
                  rows={2}
                  maxLength={400}
                  value={notes.weaknesses}
                  onChange={(event) => setNotes({ ...notes, weaknesses: event.target.value })}
                  placeholder="e.g. Plays across the line early on"
                />
              </label>
              <label className="text-xs md:col-span-2">
                Notes for the scout
                <textarea
                  className="scout-input"
                  rows={3}
                  maxLength={1500}
                  value={notes.notes}
                  onChange={(event) => setNotes({ ...notes, notes: event.target.value })}
                  placeholder="Attitude, fitness, training, best role in the side…"
                />
              </label>
              <label className="text-xs">
                Your name and role
                <input
                  className="scout-input"
                  maxLength={80}
                  value={notes.author}
                  onChange={(event) => setNotes({ ...notes, author: event.target.value })}
                  placeholder="e.g. Imran Ali, Head Coach"
                />
              </label>
            </div>
          </article>

          <ScoutingReportView report={report} />

          <article className="broadcast-panel space-y-3 no-print">
            <p className="panel-kicker inline-flex items-center gap-1.5">
              <Share2 className="size-3.5" aria-hidden="true" /> Send to a bigger team or scout
            </p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <label className="text-xs">
                Who is it for?
                <input
                  className="scout-input"
                  maxLength={160}
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="e.g. County U19 selectors – Sarah Khan"
                />
              </label>
              <label className="text-xs">
                Link works for
                <select
                  className="scout-input"
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                >
                  {SHARE_DAYS.map((value) => (
                    <option key={value} value={value}>
                      {value} days
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
              />
              <span>
                <ShieldCheck className="mr-1 inline size-3.5 text-gold" aria-hidden="true" />
                The player{player?.isJunior ? "'s parent or guardian" : ""} agreed to this report
                being sent to this team. The link stops working if coaching consent is withdrawn.
              </span>
            </label>
            <button
              type="button"
              className="action-primary"
              onClick={() => void createShare()}
              disabled={busy}
            >
              <Link2 className="size-4" aria-hidden="true" />{" "}
              {busy ? "Creating…" : "Create secret link"}
            </button>
            {link && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 p-2 text-xs">
                <code className="min-w-0 flex-1 break-all">{link}</code>
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(link)
                      .then(() => toast.success("Link copied."))
                  }
                >
                  <Copy className="size-4" aria-hidden="true" /> Copy
                </button>
                <a
                  className="action-secondary"
                  href={`https://wa.me/?text=${encodeURIComponent(`Scouting report: ${link}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </div>
            )}
            {shares.length > 0 && (
              <ul className="space-y-1.5 text-xs">
                {shares.map((share) => {
                  const live = !share.revoked_at && new Date(share.expires_at) > new Date();
                  return (
                    <li
                      key={share.id}
                      className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-1.5"
                    >
                      <span className="min-w-0 flex-1">
                        <strong>{share.recipient}</strong>
                        <span className="block text-slate-400">
                          Sent {new Date(share.created_at).toLocaleDateString()} · opened{" "}
                          {share.view_count} time{share.view_count === 1 ? "" : "s"} ·{" "}
                          {share.revoked_at
                            ? "switched off"
                            : live
                              ? `works until ${new Date(share.expires_at).toLocaleDateString()}`
                              : "expired"}
                        </span>
                      </span>
                      {live && (
                        <button
                          type="button"
                          className="action-secondary"
                          onClick={() => void revoke(share.id)}
                        >
                          <XCircle className="size-4" aria-hidden="true" /> Switch off
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </>
      )}
    </section>
  );
}
