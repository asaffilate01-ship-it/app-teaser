import { Check, ChevronRight } from "lucide-react";
import { buildSetupChecklist, setupProgress, type SetupStep } from "@/lib/setup-checklist";

export function SetupChecklist({
  counts,
  onOpen,
}: {
  counts: { teams: number; players: number; members: number; matches: number };
  onOpen: (section: SetupStep["section"]) => void;
}) {
  const steps = buildSetupChecklist(counts);
  const progress = setupProgress(steps);
  if (progress.done === progress.total) return null;
  const next = steps.find((step) => !step.done);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <section aria-labelledby="setup-title" className="setup-card">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r={radius} className="setup-ring-track" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="setup-ring-value"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress.percent / 100)}
          />
        </svg>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">Get match-ready</p>
          <h2 id="setup-title" className="mt-1 font-display text-2xl font-bold">
            {progress.done} of {progress.total} steps done
          </h2>
          {next && <p className="mt-1 text-sm text-muted-foreground">Next: {next.title.toLowerCase()}.</p>}
        </div>
      </div>
      <ol className="mt-5 grid gap-2 md:grid-cols-5">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              disabled={step.done}
              onClick={() => onOpen(step.section)}
              className={`setup-step ${step.done ? "setup-step-done" : ""} ${step === next ? "setup-step-next" : ""}`}
            >
              <span className="setup-step-dot" aria-hidden="true">
                {step.done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-bold">{step.title}</span>
                <span className="block text-xs text-muted-foreground">{step.detail}</span>
              </span>
              {!step.done && <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden="true" />}
              <span className="sr-only">{step.done ? "Completed" : "Not done yet"}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
