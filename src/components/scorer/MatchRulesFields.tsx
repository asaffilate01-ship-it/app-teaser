import type { MatchRules } from "@/lib/cricket";
import { rainMethods, type RainMethod } from "@/lib/rain-rules";

/** Free hit, Super Over, last man stands, follow-on and rain-rule choices, shared by match setup and the live scorer. */
export function MatchRulesFields({
  rules,
  onChange,
  inningsPerSide,
  limitedOvers,
  locked = {},
}: {
  rules: MatchRules;
  onChange: (rules: MatchRules) => void;
  inningsPerSide: 1 | 2;
  limitedOvers: boolean;
  /** Rules that can no longer change because play has already reached them. */
  locked?: { superOver?: boolean; followOn?: boolean };
}) {
  const toggle = (key: "freeHit" | "superOver" | "lastManStands", label: string, hint: string, disabled = false) => (
    <label className={`rule-toggle ${disabled ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        checked={Boolean(rules[key])}
        disabled={disabled}
        onChange={(event) => onChange({ ...rules, [key]: event.target.checked })}
      />
      <span>
        <span className="rule-toggle-title">{label}</span>
        <span className="rule-toggle-hint">{hint}</span>
      </span>
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {toggle("freeHit", "Free hit after a no-ball", "The next ball can only bring a run out. Carries on after a wide.")}
      {toggle("lastManStands", "Last man stands", "The last batter carries on alone and keeps the strike.")}
      {inningsPerSide === 1 &&
        toggle(
          "superOver",
          "Super Over if tied",
          limitedOvers ? "One over each, two wickets. Repeats if still level (up to 3)." : "Needs a set number of overs.",
          !limitedOvers || Boolean(locked.superOver),
        )}
      {inningsPerSide === 2 && (
        <label className={`rule-toggle ${locked.followOn ? "opacity-50" : ""}`}>
          <input
            type="checkbox"
            checked={rules.followOnLead != null}
            disabled={Boolean(locked.followOn)}
            onChange={(event) => onChange({ ...rules, followOnLead: event.target.checked ? 150 : null })}
          />
          <span className="min-w-0 flex-1">
            <span className="rule-toggle-title">Follow-on</span>
            <span className="rule-toggle-hint">Side batting first may make the other side bat again when it leads by:</span>
            {rules.followOnLead != null && (
              <span className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  value={rules.followOnLead}
                  disabled={Boolean(locked.followOn)}
                  aria-label="Follow-on lead in runs"
                  onChange={(event) => {
                    const value = Math.round(Number(event.target.value));
                    onChange({ ...rules, followOnLead: Number.isFinite(value) && value > 0 ? Math.min(500, value) : 1 });
                  }}
                  className="scorer-input h-10 w-24"
                />
                <span className="text-xs text-muted-foreground">runs</span>
              </span>
            )}
          </span>
        </label>
      )}
      {inningsPerSide === 2 && (
        <label className="rule-toggle">
          <span className="min-w-0 flex-1">
            <span className="rule-toggle-title">Days scheduled</span>
            <span className="rule-toggle-hint">The match is drawn if time runs out after the last day.</span>
            <select
              className="scorer-input mt-2 h-10 w-28"
              aria-label="Days scheduled"
              value={rules.days ?? ""}
              onChange={(event) => onChange({ ...rules, days: event.target.value ? Number(event.target.value) : undefined })}
            >
              <option value="">Not set</option>
              {[1, 2, 3, 4, 5].map((day) => (
                <option key={day} value={day}>
                  {day} day{day === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </span>
        </label>
      )}
      {inningsPerSide === 1 && limitedOvers && (
        <label className="rule-toggle">
          <span className="min-w-0 flex-1">
            <span className="rule-toggle-title">Rain rule</span>
            <span className="rule-toggle-hint">
              {rainMethods.find((item) => item.id === (rules.rainMethod ?? "arr"))?.hint}
            </span>
            <select
              value={rules.rainMethod ?? "arr"}
              onChange={(event) => onChange({ ...rules, rainMethod: event.target.value as RainMethod })}
              className="scorer-input mt-2 h-10"
              aria-label="Rain rule"
            >
              {rainMethods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      )}
    </div>
  );
}
