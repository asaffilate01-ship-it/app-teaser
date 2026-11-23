import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, type CricketMatch } from "../src/lib/cricket.ts";
import { alertsBetween } from "../src/lib/match-alerts.ts";
import { publicLiveState } from "../src/lib/public-match-state.ts";
import { resumePlay, stopPlay } from "../src/lib/stoppage.ts";

function liveMatch(): CricketMatch {
  const match = createMatch({
    homeTeamName: "Riverside CC",
    awayTeamName: "Kingsmead CC",
    homePlayers: ["A One", "A Two", "A Three"],
    awayPlayers: ["B One", "B Two", "B Three"],
    battingFirst: "home",
    settings: { format: "T20", oversPerInnings: 20, inningsPerSide: 1, ballsPerOver: 6, ground: "Park", weather: "Dry", startTime: new Date().toISOString() },
  } as Parameters<typeof createMatch>[0]);
  return { ...match, status: "live" };
}

test("stopping play for rain shows the delay on the public feed", () => {
  const stopped = stopPlay(liveMatch(), "rain", new Date("2026-11-23T10:00:00Z"));
  const state = publicLiveState(stopped) as { stoppage?: { reason: string; since: string } | null };
  assert.deepEqual(state.stoppage, { reason: "rain", since: "2026-11-23T10:00:00.000Z" });
});

test("resuming play clears the delay", () => {
  const resumed = resumePlay(stopPlay(liveMatch(), "bad-light"));
  assert.equal((publicLiveState(resumed) as { stoppage?: unknown }).stoppage, null);
});

test("play cannot be stopped once the match is finished", () => {
  const finished: CricketMatch = { ...liveMatch(), status: "completed" };
  assert.equal(stopPlay(finished, "rain").stoppage, undefined);
});

test("phone alerts announce a rain delay and play resuming", () => {
  const live = liveMatch();
  const stopped = stopPlay(live, "rain");
  assert.equal(alertsBetween(live, stopped)[0]?.title, "Rain delay");
  assert.equal(alertsBetween(stopped, resumePlay(stopped))[0]?.title, "Play resumes");
});
