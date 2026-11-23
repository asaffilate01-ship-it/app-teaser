import assert from "node:assert/strict";
import test from "node:test";
import {
  addPlayer,
  battingFirstFromToss,
  createMatch,
  currentInnings,
  movePlayer,
  recordDelivery,
  recordToss,
  retireBatter,
  retiredHurtWaiting,
  setDeliverySpeed,
  setPlayerHand,
  summarizeInnings,
  tossSummary,
  undoRetirement,
  undoableRetirement,
  type CricketMatch,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";
import { bowlingWorkload, canBowlNextOver, youthBandFrom, youthBowlingLimits } from "../src/lib/bowling-workload.ts";
import { ballCandidates, ballSpeed, fitBallTrack } from "../src/lib/ball-speed.ts";
import { fanVoteStandings, fanVoterId } from "../src/lib/fan-vote.ts";
import { frameHeaders, isEmbeddablePath } from "../src/lib/frame-policy.ts";
import { embedCode } from "../src/lib/embed-code.ts";
import { resultProblem } from "../src/lib/results-desk.ts";
import { calculateCompetitionTable, type CompetitionRules } from "../src/lib/platform.ts";
import { viewHandFor, mixedHands, type WheelBall } from "../src/lib/wagon-geometry.ts";

const settings = { format: "T20" as const, oversPerInnings: 20, inningsPerSide: 1, ballsPerOver: 6, ground: "", weather: "", startTime: "2027-05-01T10:00:00Z" };
const make = (extra: Partial<Parameters<typeof createMatch>[0]> = {}) =>
  createMatch({
    homeTeamName: "Lions",
    awayTeamName: "Tigers",
    homePlayers: ["Ali", "Ben", "Cal", "Dev", "Eli"],
    awayPlayers: ["Fin", "Gus", "Hal", "Ian", "Jay"],
    battingFirst: "home",
    settings,
    ...extra,
  });
const ball = (m: CricketMatch, extra: Partial<RecordDeliveryInput> = {}): RecordDeliveryInput => {
  const i = currentInnings(m);
  return { strikerId: i.strikerId, nonStrikerId: i.nonStrikerId, bowlerId: i.bowlerId, end: "Pavilion", deliveryStyle: "Fast", outcome: "hit", batterRuns: 1, ...extra };
};

// --- Toss ---
test("toss: the winner bats if they chose to bat, otherwise the other side bats", () => {
  assert.equal(battingFirstFromToss("home", "bat"), "home");
  assert.equal(battingFirstFromToss("home", "bowl"), "away");
  assert.equal(battingFirstFromToss("away", "bowl"), "home");
  const match = make({ toss: { winner: "away", decision: "bowl" } });
  assert.equal(currentInnings(match).battingTeamId, match.teams[0].id);
});

test("toss: recording the winner after setup works out their decision", () => {
  const match = make();
  const tigers = recordToss(match, match.teams[1].id);
  assert.equal(tossSummary(tigers), "Tigers won the toss and chose to bowl");
  assert.equal(tossSummary(recordToss(match, match.teams[0].id)), "Lions won the toss and chose to bat");
});

// --- Retirements ---
test("retired hurt is not a wicket and the batter can come back", () => {
  const match = make();
  const ali = match.teams[0].players[0]!.id;
  const after = retireBatter(match, ali, "hurt");
  const innings = currentInnings(after);
  assert.equal(summarizeInnings(innings, 6).wickets, 0);
  assert.notEqual(innings.strikerId, ali);
  assert.deepEqual(retiredHurtWaiting(innings), [ali]);
});

test("retired out counts as a wicket", () => {
  const match = make();
  const after = retireBatter(match, currentInnings(match).strikerId, "out");
  assert.equal(summarizeInnings(currentInnings(after), 6).wickets, 1);
});

test("timed out only before the batter has faced a ball, and counts as a wicket", () => {
  let match = make();
  const ali = currentInnings(match).strikerId;
  match = recordDelivery(match, ball(match, { batterRuns: 0 }));
  assert.equal(retireBatter(match, ali, "timed-out"), match, "Ali has faced a ball");
  const fresh = make();
  const out = retireBatter(fresh, currentInnings(fresh).strikerId, "timed-out");
  assert.equal(summarizeInnings(currentInnings(out), 6).wickets, 1);
});

test("a retirement can be undone until the next ball is bowled", () => {
  const match = make();
  const before = currentInnings(match);
  const retired = retireBatter(match, before.strikerId, "out");
  assert.ok(undoableRetirement(retired));
  const undone = undoRetirement(retired);
  assert.equal(summarizeInnings(currentInnings(undone), 6).wickets, 0);
  assert.equal(currentInnings(undone).strikerId, before.strikerId);
  const bowled = recordDelivery(retired, ball(retired));
  assert.equal(undoableRetirement(bowled), null);
});

// --- Squad changes ---
test("players can be added, marked left-handed and moved in the batting order mid-match", () => {
  let match = make();
  const lions = match.teams[0].id;
  match = addPlayer(match, lions, "  Kit   Ng ");
  const kit = match.teams[0].players.at(-1)!;
  assert.equal(kit.name, "Kit Ng");
  match = setPlayerHand(match, kit.id, true);
  assert.equal(match.teams[0].players.at(-1)!.leftHanded, true);
  match = movePlayer(match, lions, kit.id, -1);
  assert.equal(match.teams[0].players.at(-2)!.id, kit.id);
});

test("ball speed is saved on one ball and can be cleared", () => {
  let match = make();
  match = recordDelivery(match, ball(match));
  const id = currentInnings(match).deliveries[0]!.id;
  match = setDeliverySpeed(match, id, 121.37);
  assert.equal(currentInnings(match).deliveries[0]!.speedKph, 121.4);
  match = setDeliverySpeed(match, id, null);
  assert.equal(currentInnings(match).deliveries[0]!.speedKph, undefined);
});

// --- Junior bowling limits (ECB directives) ---
test("junior limits: U13 is 4 overs a spell and 12 a day; U15 is 5 and 15; U17 is 6 and 18", () => {
  assert.deepEqual(youthBowlingLimits.U13, { spell: 4, day: 12 });
  assert.deepEqual(youthBowlingLimits.U15, { spell: 5, day: 15 });
  assert.deepEqual(youthBowlingLimits.U17, { spell: 6, day: 18 });
  assert.equal(youthBandFrom("Riverside Under 15s"), "U15");
  assert.equal(youthBandFrom("U11 Girls"), "U13");
  assert.equal(youthBandFrom("1st XI"), null);
});

function bowlOvers(match: CricketMatch, plan: string[]): CricketMatch {
  for (const bowlerId of plan) for (let b = 0; b < 6; b += 1) match = recordDelivery(match, ball(match, { bowlerId, batterRuns: 0 }));
  return match;
}

test("junior limits: a U13 pace bowler must rest after a 4-over spell", () => {
  let match = make();
  match = { ...match, settings: { ...match.settings, rules: { ...match.settings.rules, youthBowling: "U13" } } };
  const [fin, gus, hal] = match.teams[1].players.map((p) => p.id) as [string, string, string];
  // Fin bowls overs 0, 2, 4, 6 from one end; Gus from the other.
  match = bowlOvers(match, [fin, gus, fin, gus, fin, gus, fin, gus]);
  assert.equal(canBowlNextOver(match, fin)?.allowed, false, "fifth straight over would break the 4-over spell");
  // Hal takes Fin's end for over 8; Fin's spell is over and he must rest 4 overs from that end.
  match = bowlOvers(match, [hal, gus]);
  const load = bowlingWorkload(match).find((item) => item.bowlerId === fin)!;
  assert.equal(load.status, "resting");
  assert.equal(load.restOversLeft, 3);
});

test("junior limits: no warnings when the match has no junior limits", () => {
  const match = make();
  assert.equal(canBowlNextOver(match, match.teams[1].players[0]!.id), null);
});

// --- Automatic ball speed ---
test("ball tracking: a small moving blob on the line is found, still and slow movement is ignored", () => {
  const w = 100;
  const h = 60;
  const frame = (x: number) => {
    const grey = new Uint8ClampedArray(w * h);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) grey[(30 + dy!) * w + x + dx!] = 255;
    return grey;
  };
  const found = ballCandidates(frame(30), frame(50), frame(70), w, h, { x: 10, y: 30 }, { x: 90, y: 30 });
  assert.equal(found.length, 1);
  assert.ok(Math.abs(found[0]!.t - 0.51) < 0.02);
  assert.deepEqual(ballCandidates(frame(50), frame(50), frame(50), w, h, { x: 10, y: 30 }, { x: 90, y: 30 }), []);
});

test("ball tracking: the fitted path gives release and arrival between frames (120 km/h at 30 fps)", () => {
  const metres = 18.9;
  const rate = 120 / 3.6 / metres;
  const release = 0.517;
  const points = [];
  for (let frame = 0; frame < 40; frame += 1) {
    const time = frame / 30;
    points.push({ time, t: 0.02 }); // the bowler's arm, not moving down the pitch
    const t = (time - release) * rate;
    if (t >= 0 && t <= 1.05) points.push({ time, t });
  }
  const track = fitBallTrack(points, metres)!;
  assert.ok(track, "track found");
  assert.ok(Math.abs(track.releaseTime - release) < 0.005);
  const speed = ballSpeed(track.releaseTime, track.arrivalTime, metres, 30)!;
  assert.ok(Math.abs(speed.kph - 120) < 1, `got ${speed.kph}`);
});

test("ball tracking: no track when nothing moves at a bowling speed", () => {
  const points = Array.from({ length: 30 }, (_, i) => ({ time: i / 30, t: 0.3 + i * 0.001 }));
  assert.equal(fitBallTrack(points), null);
});

// --- Fan Player of the Match ---
test("fan vote: shares only count named players, most votes first", () => {
  const rows = fanVoteStandings({ aaaa: 3, bbbb: 1, hidden: 6 }, { aaaa: "Ali", bbbb: "Ben", cccc: "Cal" });
  assert.deepEqual(rows.map((row) => [row.name, row.votes, row.share]), [["Ali", 3, 75], ["Ben", 1, 25], ["Cal", 0, 0]]);
});

test("fan vote: one voter id per phone", () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const first = fanVoterId(storage, () => "a".repeat(32));
  const second = fanVoterId(storage, () => "b".repeat(32));
  assert.equal(first, second);
});

// --- Score widget ---
test("only the score widget may be shown inside other websites", () => {
  assert.equal(isEmbeddablePath("/embed/lions-v-tigers"), true);
  assert.equal(frameHeaders("/embed/lions-v-tigers").xFrameOptions, null);
  for (const path of ["/", "/app", "/platform", "/scoreboard/lions-v-tigers", "/embed/../app", "/embed/a/b"]) {
    assert.equal(isEmbeddablePath(path), false, path);
    assert.equal(frameHeaders(path).frameAncestors, "frame-ancestors 'none'");
    assert.equal(frameHeaders(path).xFrameOptions, "DENY");
  }
});

test("widget code points at the embed page and strips odd characters from the link", () => {
  const code = embedCode("https://criclume.com/", "lions\"><script>-v-tigers");
  assert.match(code, /src="https:\/\/criclume\.com\/embed\/lionsscript-v-tigers"/);
  assert.doesNotMatch(code, /<script>/);
});

// --- Walkovers and point deductions ---
test("walkover: needs the awarded team but no scores", () => {
  assert.equal(resultProblem({ walkover: true, winnerTeamId: "h" }, "h", "a"), null);
  assert.equal(resultProblem({ walkover: true }, "h", "a"), "Pick a winner, a tie or no result.");
});

test("league table: walkover gives win points and deductions change the total", () => {
  const rules: CompetitionRules = { version: 1, ballsPerOver: 6, oversPerInnings: 20, inningsPerSide: 1, points: { win: 2, tie: 1, noResult: 1, loss: 0 }, tieBreakers: ["points"] };
  const table = calculateCompetitionTable(
    ["h", "a"],
    [{ id: "f1", homeTeamId: "h", awayTeamId: "a", status: "completed", walkover: true, winnerTeamId: "h" }],
    rules,
    [{ teamId: "h", points: -1, reason: "Late team sheet" } as never],
  );
  const home = table.find((row) => row.teamId === "h")!;
  assert.equal(home.won, 1);
  assert.equal(home.points, 1);
  assert.equal(home.pointsAdjustment, -1);
  assert.equal(home.netRunRate, 0);
});

// --- Wagon wheel left-handers ---
test("wagon wheel: flips to the left-hander's view only when every shot shown is by a left-hander", () => {
  const shot = (strikerId: string, leftHanded: boolean): WheelBall => ({ id: strikerId + Math.random(), over: 0, ball: 1, strikerId, bowlerId: "b", batterRuns: 1, fieldZone: "cover", wicket: false, leftHanded });
  const balls = [shot("lh", true), shot("rh", false)];
  assert.equal(viewHandFor(balls, "lh"), true);
  assert.equal(viewHandFor(balls, "rh"), false);
  assert.equal(viewHandFor(balls), false);
  assert.equal(mixedHands(balls), true);
});
