import { useMemo } from "react";
import type { Innings, Player } from "@/lib/cricket";
import type { WheelBall } from "@/lib/wagon-geometry";
import { WagonWheelField } from "./WagonWheelField";

/** The scorer's wagon wheel for one innings: every ball with a recorded field position. */
export function ScorerWagonWheel({ innings, players }: { innings: Innings; players: Player[] }) {
  const lefties = useMemo(
    () => new Set(players.filter((p) => p.leftHanded).map((p) => p.id)),
    [players],
  );
  const balls = useMemo<WheelBall[]>(
    () =>
      innings.deliveries.map((ball) => ({
        id: ball.id,
        over: ball.over,
        ball: ball.ball,
        strikerId: ball.strikerId,
        bowlerId: ball.bowlerId,
        batterRuns: ball.batterRuns,
        fieldZone: ball.fieldZone,
        wicket: Boolean(ball.dismissal),
        ...(lefties.has(ball.strikerId) ? { leftHanded: true } : {}),
      })),
    [innings.deliveries, lefties],
  );
  const names = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);
  return (
    <WagonWheelField
      balls={balls}
      playerName={(id) => names.get(id) ?? "Player"}
      kicker={`Innings ${innings.number} · shot map`}
      showBowlerFilter
    />
  );
}
