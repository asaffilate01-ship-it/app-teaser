import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, recordDelivery, currentInnings } from "../src/lib/cricket.ts";
import {
  parseScorerMatches,
  parseScorerBackup,
  copyBackupMatches,
  maxBackupBytes,
  readScorerSnapshot,
  latestScorerSnapshot,
  recoverLatestScorerSnapshot,
  scorerSnapshotPageSize,
} from "../src/lib/scorer-storage.ts";
function fixture() {
  return createMatch({
    homeTeamName: "Home",
    awayTeamName: "Away",
    homePlayers: ["One", "Two"],
    awayPlayers: ["Three", "Four"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Ground",
      weather: "Dry",
      startTime: "2026-10-28",
    },
  });
}
test("saved matches round-trip deliveries and preserve future fields", () => {
  const match = fixture(),
    innings = currentInnings(match);
  const scored = recordDelivery(match, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: "Pavilion",
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 4,
  });
  const rows = [{ ...scored, futureField: { keep: true } }];
  assert.deepEqual(parseScorerMatches(JSON.stringify(rows)), JSON.parse(JSON.stringify(rows)));
  assert.deepEqual(parseScorerMatches("[]"), []);
});
test("malformed data and invalid scorer structure are rejected as a whole", () => {
  const match = fixture();
  for (const raw of [
    "{bad",
    "null",
    "{}",
    "[null]",
    JSON.stringify([match, { id: "incomplete" }]),
    JSON.stringify([match, match]),
    JSON.stringify([{ ...match, innings: [] }]),
    JSON.stringify([{ ...match, settings: { ...match.settings, ballsPerOver: 0 } }]),
    JSON.stringify([{ ...match, innings: [{ ...match.innings[0], battingTeamId: "missing" }] }]),
  ])
    assert.throws(() => parseScorerMatches(raw));
});

test("backup import accepts single exports and lists, but rejects empty or partial batches", () => {
  const original = fixture();
  assert.deepEqual(parseScorerBackup(JSON.stringify(original)), [original]);
  assert.deepEqual(parseScorerBackup(JSON.stringify([original])), [original]);
  for (const raw of ["[]", "null", "broken", JSON.stringify([original, {}])])
    assert.throws(() => parseScorerBackup(raw));
});
test("backup resource limits reject oversized files and more than 100 matches", () => {
  assert.throws(() => parseScorerBackup(" ".repeat(maxBackupBytes + 1)), /10 MB/);
  const original = fixture();
  const rows = Array.from({ length: 100 }, (_, index) => ({ ...original, id: String(index) }));
  assert.equal(parseScorerBackup(JSON.stringify(rows)).length, 100);
  assert.throws(
    () => parseScorerBackup(JSON.stringify([...rows, { ...original, id: "extra" }])),
    /1 to 100/,
  );
});
test("restoring always creates independent local identities and preserves source scores", () => {
  const original = fixture();
  original.id = "a1000000-0000-4000-8000-000000000001";
  const before = JSON.stringify(original);
  let sequence = 0;
  const copied = copyBackupMatches([original, original], () => String(++sequence));
  assert.deepEqual(
    copied.map((match) => match.id),
    ["restored-1", "restored-2"],
  );
  assert.equal(JSON.stringify(original), before);
  copied[0]!.teams[0].name = "Edited local copy";
  assert.equal(original.teams[0].name, "Home");
  assert.equal(copied[1]!.teams[0].name, "Home");
});

test("a stale scorer cannot overwrite another tab's save or cleared storage", async () => {
  const { commitScorerSnapshot } = await import("../src/lib/scorer-storage.ts");
  let value: string | null = "original";
  let writes = 0;
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
      writes++;
    },
  };
  assert.deepEqual(commitScorerSnapshot(storage, "original", "tab-a"), { saved: true });
  assert.deepEqual(commitScorerSnapshot(storage, "original", "tab-b"), {
    saved: false,
    current: "tab-a",
  });
  assert.equal(writes, 1);
  assert.equal(value, "tab-a");
  value = null;
  assert.deepEqual(commitScorerSnapshot(storage, "tab-a", "stale"), {
    saved: false,
    current: null,
  });
  assert.equal(writes, 1);
});
test("device write failures preserve the expected baseline for retry", async () => {
  const { commitScorerSnapshot } = await import("../src/lib/scorer-storage.ts");
  let value: string | null = null;
  let fail = true;
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      if (fail) throw Error("quota");
      value = next;
    },
  };
  assert.throws(() => commitScorerSnapshot(storage, null, "saved"), /quota/);
  assert.equal(value, null);
  fail = false;
  assert.deepEqual(commitScorerSnapshot(storage, null, "saved"), { saved: true });
});

test("cloud event snapshots are validated before replacing local scores", () => {
  const original = fixture();
  const future = { ...original, futureMetadata: { matchRevision: 12 } };
  assert.deepEqual(readScorerSnapshot(future, original.id), future);

  for (const value of [
    null,
    [],
    {},
    { ...original, id: "another-match" },
    { ...original, teams: [] },
    { ...original, innings: [] },
    { ...original, status: "invalid" },
    { ...original, settings: { ...original.settings, ballsPerOver: 0 } },
    { ...original, innings: [{ ...original.innings[0], battingTeamId: "unknown-team" }] },
  ]) {
    assert.equal(readScorerSnapshot(value, original.id), null);
  }
});

test("malformed cloud delivery events fail closed without destroying the original match", () => {
  const original = fixture();
  const originalJson = JSON.stringify(original);
  const malformed = {
    ...original,
    innings: [
      {
        ...original.innings[0]!,
        deliveries: [
          {
            id: "delivery",
            legal: true,
            batterRuns: -1,
          },
        ],
      },
    ],
  };
  assert.equal(readScorerSnapshot(malformed, original.id), null);
  assert.equal(JSON.stringify(original), originalJson);
});

test("advanced match metadata is validated in saved scores and cloud snapshots", () => {
  const original = fixture();
  const invalid = [
    { ...original, rain: { method: "manual", officialTarget: "150" } },
    { ...original, days: { current: 1, atStumps: false, closes: "invalid" } },
    { ...original, stoppage: { reason: "unknown", since: "2026-11-24" } },
    { ...original, settings: { ...original.settings, rules: { pairs: { oversPerPair: 0 } } } },
    { ...original, innings: [{ ...original.innings[0], retirements: "invalid" }] },
  ];
  for (const value of invalid) {
    assert.equal(readScorerSnapshot(value, original.id), null);
    assert.throws(() => parseScorerBackup(JSON.stringify(value)), /incomplete or unsupported/);
  }
});

test("known optional delivery fields cannot corrupt restored scoring arithmetic", () => {
  const original = fixture();
  const innings = currentInnings(original);
  const scored = recordDelivery(original, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 4,
  });
  for (const fields of [
    { wicketPenalty: "5" },
    { wicketPenalty: -5 },
    { speedKph: "fast" },
    { pitch: { x: 2, y: 0.5 } },
    { freeHit: "true" },
  ]) {
    const value = structuredClone(scored);
    Object.assign(currentInnings(value).deliveries[0]!, fields);
    assert.equal(readScorerSnapshot(value, scored.id), null);
  }
});

test("valid advanced metadata and future extensions survive round-trip", () => {
  const original = fixture();
  const value = {
    ...original,
    rain: { method: "manual", officialTarget: 150, revisedOvers: 16, futureRule: true },
    days: { current: 1, atStumps: false, closes: [] },
    stoppage: null,
    futureMetadata: { version: 2 },
  };
  assert.deepEqual(readScorerSnapshot(value, original.id), value);
  assert.deepEqual(parseScorerBackup(JSON.stringify(value)), [value]);
});

test("retirements cannot refer to deliveries that do not exist", () => {
  const original = fixture();
  const innings = currentInnings(original);
  innings.retirements = [
    {
      batterId: innings.strikerId,
      kind: "hurt",
      afterBall: 1,
      prevStrikerId: innings.strikerId,
      prevNonStrikerId: innings.nonStrikerId,
      at: "2026-11-24T12:00:00Z",
    },
  ];
  assert.equal(readScorerSnapshot(original, original.id), null);
  innings.retirements[0]!.afterBall = 0;
  assert.deepEqual(readScorerSnapshot(original, original.id), original);
});

test("latest snapshot recovery skips non-snapshot events, but never skips an invalid snapshot", () => {
  const original = fixture();
  const valid = { payload: { matchSnapshot: original } };
  const patch = { payload: { tag: { fieldZone: "Cover" } } };
  assert.deepEqual(latestScorerSnapshot([patch, valid], original.id), original);
  assert.equal(latestScorerSnapshot([patch], original.id), null);
  for (const invalid of [null, {}, { ...original, id: "different" }]) {
    assert.throws(
      () =>
        latestScorerSnapshot([patch, { payload: { matchSnapshot: invalid } }, valid], original.id),
      /latest cloud scoring snapshot is invalid/,
    );
  }
});

test("recovery can find a valid snapshot beyond the first page of fielding events", async () => {
  const original = fixture();
  const rows = Array.from({ length: scorerSnapshotPageSize + 1 }, (_, index) => ({
    sequence: scorerSnapshotPageSize + 1 - index,
    payload: index === scorerSnapshotPageSize ? { matchSnapshot: original } : { tag: {} },
  }));
  const cursors: (number | null)[] = [];
  const result = await recoverLatestScorerSnapshot(original.id, async (before, limit) => {
    cursors.push(before);
    return rows.filter((row) => before === null || row.sequence < before).slice(0, limit);
  });
  assert.deepEqual(result, original);
  assert.deepEqual(cursors, [null, 2]);
});

test("out-of-order history and a non-advancing recovery cursor fail closed", async () => {
  const original = fixture();
  await assert.rejects(
    recoverLatestScorerSnapshot(original.id, async () => [
      { sequence: 2, payload: {} },
      { sequence: 2, payload: {} },
    ]),
    /out of order/,
  );
  const fullPage = Array.from({ length: scorerSnapshotPageSize }, (_, index) => ({
    sequence: scorerSnapshotPageSize - index,
    payload: {},
  }));
  await assert.rejects(
    recoverLatestScorerSnapshot(original.id, async () => fullPage),
    /out of order/,
  );
});

test("an exhausted empty history still permits legacy row reconstruction", async () => {
  const original = fixture();
  assert.equal(await recoverLatestScorerSnapshot(original.id, async () => []), null);
});

test("duplicate scoring identities cannot be restored or adopted from cloud snapshots", () => {
  const match = fixture();
  const innings = currentInnings(match);
  const scored = recordDelivery(match, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 4,
  });
  const duplicateBall = structuredClone(scored);
  const balls = currentInnings(duplicateBall).deliveries;
  balls.push({ ...balls[0]!, sequence: 2 });

  const duplicateInnings = structuredClone(scored);
  duplicateInnings.innings.push({ ...duplicateInnings.innings[0]!, deliveries: [] });

  const duplicatePlayer = structuredClone(scored);
  duplicatePlayer.teams[0].players.push({ ...duplicatePlayer.teams[0].players[0]! });

  const emptyIdentity = structuredClone(scored);
  currentInnings(emptyIdentity).deliveries[0]!.id = "";

  for (const value of [duplicateBall, duplicateInnings, duplicatePlayer, emptyIdentity]) {
    assert.equal(readScorerSnapshot(value, value.id), null);
    assert.throws(() => parseScorerBackup(JSON.stringify(value)), /incomplete or unsupported/);
  }
});

test("known player substitution and handedness metadata must use valid values", () => {
  const original = fixture();
  for (const metadata of [
    { leftHanded: "true" },
    { substitute: "unknown" },
    { replacedBy: 1 },
    { replaces: "" },
  ]) {
    const value = structuredClone(original);
    Object.assign(value.teams[0].players[0]!, metadata);
    assert.equal(readScorerSnapshot(value, value.id), null);
  }
  const valid = structuredClone(original);
  Object.assign(valid.teams[0].players[0]!, {
    leftHanded: true,
    substitute: "concussion",
    replaces: valid.teams[0].players[1]!.id,
    futurePlayerMetadata: { version: 2 },
  });
  assert.deepEqual(readScorerSnapshot(valid, valid.id), valid);
  assert.deepEqual(parseScorerBackup(JSON.stringify(valid)), [valid]);
});
