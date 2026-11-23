import { useState } from "react";
import { toast } from "sonner";
import { Check, CircleHelp, X } from "lucide-react";
import { Pill, when } from "@/components/office/ui";
import { flagStatusLabels, type CheckFlag } from "@/lib/check-scoring";
import { answerCheckFlag, friendlyCheck } from "@/lib/check-scoring-cloud";

/** Queries raised by the away check scorer. Home scorers answer them here ("fixed" or "kept as is"). */
export function FlagList({ flags, canAnswer, onChanged }: { flags: readonly CheckFlag[]; canAnswer: boolean; onChanged: () => void }) {
  if (flags.length === 0) return <p className="office-meta">No queries yet.</p>;
  return (
    <ul className="space-y-2">
      {flags.map((flag) => (
        <FlagItem key={flag.id} flag={flag} canAnswer={canAnswer} onChanged={onChanged} />
      ))}
    </ul>
  );
}

function FlagItem({ flag, canAnswer, onChanged }: { flag: CheckFlag; canAnswer: boolean; onChanged: () => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const answer = async (status: "fixed" | "kept") => {
    setBusy(true);
    try {
      await answerCheckFlag(flag.id, status, reply);
      toast.success(status === "fixed" ? "Marked as fixed." : "Kept as scored.");
      onChanged();
    } catch (reason) {
      toast.error(friendlyCheck(reason));
    } finally {
      setBusy(false);
    }
  };
  const tone = flag.status === "open" ? "warn" : "good";
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <CircleHelp className="size-4 text-gold" aria-hidden="true" />
          {flag.ball_label ? `Innings ${flag.innings_number ?? "?"} · ball ${flag.ball_label}` : "Whole scorecard"}
        </span>
        <Pill tone={tone}>{flagStatusLabels[flag.status]}</Pill>
      </div>
      <p className="mt-1.5 text-sm">{flag.note}</p>
      <p className="office-meta mt-1">Raised {when(flag.raised_at)}</p>
      {flag.reply && <p className="mt-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm">Scorer: {flag.reply}</p>}
      {canAnswer && flag.status === "open" && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`reply-${flag.id}`}>
            Reply to the check scorer
          </label>
          <input
            id={`reply-${flag.id}`}
            className="scorer-input flex-1"
            placeholder="Reply (optional)"
            maxLength={500}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
          />
          <button type="button" className="action-secondary inline-flex items-center justify-center gap-1.5" disabled={busy} onClick={() => void answer("fixed")}>
            <Check className="size-4" aria-hidden="true" /> Fixed it
          </button>
          <button type="button" className="action-secondary inline-flex items-center justify-center gap-1.5" disabled={busy} onClick={() => void answer("kept")}>
            <X className="size-4" aria-hidden="true" /> Keep as scored
          </button>
        </div>
      )}
    </li>
  );
}
