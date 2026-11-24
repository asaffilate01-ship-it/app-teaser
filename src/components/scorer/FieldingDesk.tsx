import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { FielderChips, ShotZonePicker } from "@/components/scorer/ShotEntry";
import {
  currentInnings,
  findPlayer,
  findTeam,
  type CricketMatch,
  type Delivery,
  type DeliveryEnd,
  type DeliveryStyle,
  type FieldZone,
} from "@/lib/cricket";
import { ballsNeedingFielding, type DeliveryTag } from "@/lib/scoring-duties";

const styles: DeliveryStyle[] = [
  "Fast",
  "Medium",
  "Off spin",
  "Leg spin",
  "Left-arm spin",
  "Other",
];

function ballText(ball: Delivery) {
  const extras =
    ball.extras.wide +
    ball.extras.noBall +
    ball.extras.bye +
    ball.extras.legBye +
    ball.extras.penalty;
  if (ball.dismissal) return "Wicket";
  if (extras && !ball.batterRuns) return `${extras} extra${extras === 1 ? "" : "s"}`;
  return ball.batterRuns === 0
    ? "Dot"
    : `${ball.batterRuns} run${ball.batterRuns === 1 ? "" : "s"}`;
}

/**
 * The bowling & fielding scorer's screen: pick the bowler for the next ball, and add fielder,
 * fielding position and ball type to balls the batting scorer has already recorded.
 */
export function FieldingDesk({
  match,
  onBowler,
  onTag,
}: {
  match: CricketMatch;
  onBowler: (bowlerId: string, end: DeliveryEnd) => void;
  onTag: (ball: Delivery, tag: DeliveryTag) => void;
}) {
  const innings = currentInnings(match);
  const bowlingTeam = findTeam(match, innings.bowlingTeamId);
  const [bowlerId, setBowlerId] = useState(innings.bowlerId);
  const [end, setEnd] = useState<DeliveryEnd>(innings.end);
  const balls = ballsNeedingFielding(match);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = balls.find((item) => item.ball.id === selectedId)?.ball;
  const [zone, setZone] = useState<FieldZone>("Not recorded");
  const [fielderId, setFielderId] = useState("");
  const [catcherId, setCatcherId] = useState("");
  const [style, setStyle] = useState<DeliveryStyle>("Medium");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setBowlerId(innings.bowlerId);
    setEnd(innings.end);
  }, [innings.id, innings.bowlerId, innings.end]);

  useEffect(() => {
    if (!selected) return;
    setZone(selected.fieldZone);
    setFielderId(selected.fielderId ?? "");
    setCatcherId(selected.dismissal?.fielderId ?? "");
    setStyle(selected.deliveryStyle);
    // Only when a different ball is picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  if (match.status !== "live") {
    return (
      <section className="broadcast-panel text-sm text-slate-300">
        Waiting for the batting & runs scorer to start the innings.
      </section>
    );
  }

  const bowlerChanged = bowlerId !== innings.bowlerId || end !== innings.end;
  const needsCatcher =
    selected?.dismissal && ["caught", "run-out", "stumped"].includes(selected.dismissal.type);

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <section
        className="broadcast-panel space-y-4 self-start"
        aria-label="Bowler for the next ball"
      >
        <h2 className="panel-kicker">Next ball</h2>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Bowler</span>
          <select
            value={bowlerId}
            onChange={(event) => setBowlerId(event.target.value)}
            className="scorer-input"
          >
            {bowlingTeam.players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Bowling end
          </span>
          <select
            value={end}
            onChange={(event) => setEnd(event.target.value as DeliveryEnd)}
            className="scorer-input"
          >
            <option>Pavilion</option>
            <option>Far</option>
          </select>
        </label>
        <button
          type="button"
          className="action-primary min-h-11 w-full"
          disabled={!bowlerChanged}
          onClick={() => onBowler(bowlerId, end)}
        >
          {bowlerChanged
            ? "Send to batting scorer"
            : `${findPlayer(match, innings.bowlerId)?.name ?? "Bowler"} is bowling`}
        </button>
        <p className="text-[11px] leading-relaxed text-slate-400">
          The batting & runs scorer's next ball uses this bowler. Change it at the end of each over.
        </p>
      </section>

      <section className="space-y-4" aria-label="Add fielding to recorded balls">
        <div className="broadcast-panel">
          <h2 className="panel-kicker mb-3">Recent balls</h2>
          {balls.length === 0 ? (
            <p className="text-sm text-slate-300">
              No balls yet. They appear here as soon as they're scored.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {balls.map(({ ball, needsFielding }) => (
                <li key={ball.id}>
                  <button
                    type="button"
                    aria-pressed={selectedId === ball.id}
                    onClick={() => setSelectedId(selectedId === ball.id ? null : ball.id)}
                    className={`w-full rounded-xl border p-2.5 text-left text-xs ${
                      selectedId === ball.id
                        ? "border-amber-300 bg-amber-300/10"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <span className="block font-bold tabular-nums text-slate-100">
                      {ball.over}.{ball.ball} · {ballText(ball)}
                    </span>
                    <span className={needsFielding ? "text-amber-200" : "text-slate-400"}>
                      {needsFielding
                        ? "Needs fielding"
                        : ball.fieldZone === "Not recorded"
                          ? "No fielding needed"
                          : ball.fieldZone}
                      {saved === ball.id ? " · saved" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <div
            className="broadcast-panel shot-card space-y-4"
            aria-label={`Fielding for ball ${selected.over}.${selected.ball}`}
          >
            <h2 className="panel-kicker">
              Ball {selected.over}.{selected.ball} ·{" "}
              {findPlayer(match, selected.strikerId)?.name ?? "Batter"} · {ballText(selected)}
            </h2>
            <div className="shot-card-grid">
              <ShotZonePicker value={zone} onChange={setZone} />
              <div className="space-y-4">
                <FielderChips
                  label="Who fielded it?"
                  players={bowlingTeam.players}
                  value={fielderId}
                  onChange={setFielderId}
                />
                {needsCatcher && (
                  <FielderChips
                    label={
                      selected.dismissal!.type === "caught"
                        ? "Caught by"
                        : selected.dismissal!.type === "stumped"
                          ? "Stumped by"
                          : "Run out by"
                    }
                    players={bowlingTeam.players}
                    value={catcherId}
                    onChange={setCatcherId}
                  />
                )}
                <label className="block space-y-1.5">
                  <span className="shot-step-label">Ball type</span>
                  <select
                    value={style}
                    onChange={(event) => setStyle(event.target.value as DeliveryStyle)}
                    className="scorer-input"
                  >
                    {styles.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <button
              type="button"
              className="action-primary min-h-11 w-full"
              onClick={() => {
                onTag(selected, {
                  fieldZone: zone,
                  fielderId: fielderId || null,
                  deliveryStyle: style,
                  ...(needsCatcher ? { dismissalFielderId: catcherId || null } : {}),
                });
                setSaved(selected.id);
                setSelectedId(null);
              }}
            >
              <Check className="size-4" aria-hidden="true" /> Save fielding
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
