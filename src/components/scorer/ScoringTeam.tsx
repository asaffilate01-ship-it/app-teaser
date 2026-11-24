import { useState } from "react";
import { Camera, ExternalLink, ShieldCheck, Users } from "lucide-react";
import { setScoringDuty } from "@/lib/cloud";
import { createCameraRoom } from "@/lib/platform-cloud";
import {
  dutyLabel,
  scoringDuties,
  type ScoringDuty,
  type ScoringTeamMember,
} from "@/lib/scoring-duties";

function friendly(reason: unknown): string {
  const message =
    reason instanceof Error
      ? reason.message
      : String((reason as { message?: unknown })?.message ?? "");
  if (/active members/i.test(message))
    return "Only active members of the club can be given a scoring job.";
  if (/only club admins/i.test(message))
    return "Only club admins (or the lead scorer, for helpers) can hand out jobs.";
  return "That change didn't save. Check your connection and try again.";
}

/** "Your job" strip at the top of the scorer, with the scoring team underneath for managers. */
export function ScoringTeamStrip({
  matchId,
  duties,
  team,
  myUserId,
  onChanged,
}: {
  matchId: string;
  duties: readonly ScoringDuty[];
  team: readonly ScoringTeamMember[];
  myUserId: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = team.find((member) => member.userId === myUserId);
  const isAdmin = Boolean(me?.alwaysFull);
  const isLead = Boolean(me?.duties.includes("lead"));
  const canManage = isAdmin || isLead;
  const named = team.filter((member) => member.duties.length > 0);
  const mine: ScoringDuty[] = duties.includes("lead")
    ? ["lead"]
    : (["batting", "bowling", "video"] as const).filter((duty) => duties.includes(duty));

  const toggle = async (member: ScoringTeamMember, duty: ScoringDuty) => {
    const key = `${member.userId}:${duty}`;
    setBusy(key);
    setError(null);
    try {
      await setScoringDuty({
        matchId,
        userId: member.userId,
        duty,
        enabled: !member.duties.includes(duty),
      });
      onChanged();
    } catch (reason) {
      setError(friendly(reason));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="broadcast-panel mb-5 space-y-3" aria-label="Scoring team">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Your job
          </span>
          {mine.map((duty) => (
            <span key={duty} className="hero-chip">
              {isAdmin && duty === "lead" ? "Club admin · everything" : dutyLabel(duty)}
            </span>
          ))}
          {named.length > 0 && (
            <span className="text-xs text-slate-400">
              · {named.length} {named.length === 1 ? "person" : "people"} on the scoring team
            </span>
          )}
        </div>
        <button
          type="button"
          className="workspace-nav-item min-h-11"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Users className="size-4" aria-hidden="true" />{" "}
          {canManage ? "Scoring team" : "Who's scoring"}
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-white/10 pt-3">
          <p className="text-xs leading-relaxed text-slate-300">
            {named.length === 0
              ? "Nobody has been given a job yet, so any club scorer can score this match. Name people below and only they (and club admins) can."
              : "Only the people named here, and club admins, can score this match. Each person can only do their own job — the server checks every change."}
          </p>
          <ul className="space-y-2">
            {team.map((member) => (
              <li
                key={member.userId}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {member.name}
                    {member.userId === myUserId ? " (you)" : ""}
                  </p>
                  <p className="text-[11px] capitalize text-slate-400">
                    {member.alwaysFull
                      ? "Club admin · can do everything"
                      : member.clubRole.replaceAll("_", " ")}
                  </p>
                </div>
                {!member.alwaysFull && (
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label={`Jobs for ${member.name}`}
                  >
                    {scoringDuties.map((duty) => {
                      const on = member.duties.includes(duty.id);
                      const allowed = canManage && (duty.id !== "lead" || isAdmin);
                      return (
                        <button
                          key={duty.id}
                          type="button"
                          title={duty.detail}
                          aria-pressed={on}
                          disabled={!allowed || busy !== null}
                          onClick={() => void toggle(member, duty.id)}
                          className={`fielder-chip min-h-9 ${on ? "" : "opacity-70"}`}
                        >
                          {busy === `${member.userId}:${duty.id}` ? "Saving…" : duty.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="text-xs text-rose-200">
              {error}
            </p>
          )}
          {!canManage && (
            <p className="text-[11px] text-slate-400">
              Ask a club admin or the lead scorer to change jobs.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** For the video feed person: open a camera room for this match and jump to the director screen. */
export function VideoDutyCard({ matchId }: { matchId: string }) {
  const [pairing, setPairing] = useState<{ roomId: string; pairingToken: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      setPairing(await createCameraRoom({ matchId, name: "Match cameras" }));
    } catch {
      setError("Couldn't open a camera room. Check your connection, or ask the lead scorer.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="broadcast-panel space-y-3" aria-label="Video feed">
      <h2 className="panel-kicker flex items-center gap-2">
        <Camera className="size-4" aria-hidden="true" /> Video feed
      </h2>
      <p className="text-sm text-slate-300">
        You run the cameras for this match. Open a camera room, pair the phones, then direct them
        from the director screen. The score is kept by the scorers.
      </p>
      <button
        type="button"
        className="action-primary min-h-11"
        disabled={busy}
        onClick={() => void open()}
      >
        {busy ? "Opening…" : "Open a camera room"}
      </button>
      {pairing && (
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
          <p className="text-xs text-slate-400">
            Pairing code for the camera phones (valid 30 minutes)
          </p>
          <p className="mt-1 break-all font-mono text-lg font-bold text-amber-200">
            {pairing.pairingToken}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-amber-200">
            <a
              href={`/camera/${pairing.roomId}`}
              className="inline-flex items-center gap-1 underline"
            >
              Camera phone page <ExternalLink className="size-3" aria-hidden="true" />
            </a>
            <a
              href={`/director/${pairing.roomId}`}
              className="inline-flex items-center gap-1 underline"
            >
              Director screen <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
}
