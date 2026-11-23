import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidWebSlug,
  readSocials,
  readSponsors,
  safeLink,
  siteFilePaths,
  siteSchedule,
  siteTables,
  suggestWebSlug,
  type PublicClubSite,
  type SiteFixture,
  type SiteMatch,
} from "../src/lib/club-site.ts";

const now = Date.parse("2026-11-23T12:00:00Z");
const match = (patch: Partial<SiteMatch>): SiteMatch => ({
  id: "m",
  status: "scheduled",
  scheduledAt: null,
  startedAt: null,
  completedAt: null,
  home: "Riverside",
  away: "Hilltop",
  ground: null,
  runs: null,
  wickets: null,
  overs: null,
  target: null,
  battingIsHome: null,
  result: null,
  scoreboard: null,
  ...patch,
});
const fixture = (patch: Partial<SiteFixture>): SiteFixture => ({
  id: "f",
  competitionId: "c1",
  competition: "Sunday League",
  round: "Round 1",
  startsAt: "2026-11-30T10:00:00Z",
  status: "scheduled",
  homeTeamId: "a",
  awayTeamId: "b",
  home: "Riverside",
  away: "Hilltop",
  ground: null,
  result: null,
  signedOff: false,
  signedOffAt: null,
  ruleVersionId: "r1",
  ...patch,
});

test("only https links are kept on a club website", () => {
  assert.equal(safeLink("https://facebook.com/riverside"), "https://facebook.com/riverside");
  assert.equal(safeLink("http://facebook.com/riverside"), null);
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.deepEqual(readSocials({ facebook: "https://fb.com/x", instagram: "ftp://x", evil: "https://x.com" }), { facebook: "https://fb.com/x" });
  assert.deepEqual(readSponsors([{ name: "Ali Sports", url: "http://x" }, { name: "" }]), [{ name: "Ali Sports", url: null }]);
});

test("web address is 3–40 lowercase letters, numbers and single dashes", () => {
  assert.equal(isValidWebSlug("riverside-cc"), true);
  assert.equal(isValidWebSlug("ab"), false);
  assert.equal(isValidWebSlug("Riverside"), false);
  assert.equal(isValidWebSlug("river--side"), false);
  assert.equal(isValidWebSlug("a".repeat(41)), false);
  assert.equal(suggestWebSlug("Riverside Cricket Club"), "riverside-cricket-club");
  assert.equal(isValidWebSlug(suggestWebSlug("Lahore Gymkhana (U-19) — XI")), true);
});

test("schedule splits live, coming up (soonest first, no duplicates) and results (newest first)", () => {
  const site = {
    matches: [
      match({ id: "live", status: "live" }),
      match({ id: "old", status: "completed", completedAt: "2026-11-01T18:00:00Z" }),
      match({ id: "new", status: "completed", completedAt: "2026-11-20T18:00:00Z" }),
      match({ id: "next", status: "scheduled", scheduledAt: "2026-11-30T10:00:00Z" }),
      match({ id: "past", status: "scheduled", scheduledAt: "2026-11-01T10:00:00Z" }),
    ],
    fixtures: [
      fixture({ id: "same-as-next" }),
      fixture({ id: "soon", startsAt: "2026-11-25T10:00:00Z", home: "Kings", away: "Lions" }),
      fixture({ id: "draft-done", status: "completed" }),
    ],
  };
  const { live, upcoming, results } = siteSchedule(site, now);
  assert.deepEqual(live.map((m) => m.id), ["live"]);
  assert.deepEqual(upcoming.map((u) => u.id), ["soon", "next"]);
  assert.deepEqual(results.map((m) => m.id), ["new", "old"]);
});

test("public league table counts signed-off results only", () => {
  const rules = {
    version: 1,
    ballsPerOver: 6,
    oversPerInnings: 20,
    inningsPerSide: 1,
    points: { win: 4, tie: 2, noResult: 2, loss: 0 },
    tieBreakers: ["points", "wins", "net-run-rate"] as Array<"points" | "wins" | "net-run-rate">,
  };
  const result = { winnerTeamId: "a", homeRuns: 150, homeLegalBalls: 120, awayRuns: 120, awayLegalBalls: 120 };
  const tables = siteTables({
    competitions: [{ id: "c1", name: "Sunday League", format: "T20", season: "2026", ruleVersionId: "r1", rules }],
    fixtures: [
      fixture({ id: "f1", status: "completed", result, signedOff: true, signedOffAt: "2026-11-20T20:00:00Z" }),
      fixture({ id: "f2", status: "completed", result: { ...result, winnerTeamId: "b" }, signedOff: false }),
    ],
  });
  assert.equal(tables.length, 1);
  assert.equal(tables[0]?.counted, 1);
  assert.equal(tables[0]?.rows[0]?.name, "Riverside");
  assert.equal(tables[0]?.rows[0]?.points, 4);
  assert.equal(tables[0]?.rows[1]?.points, 0);
});

test("every shown file is listed for signing", () => {
  const site: PublicClubSite = {
    published: true,
    name: "R",
    kind: "club",
    slug: "r-cc",
    site: { heroPath: "org/hero/a.jpg" } as PublicClubSite["site"],
    photos: [{ id: "p", path: "org/photos/b.jpg", caption: "" }],
    posts: [{ id: "d", kind: "document", title: "Rules", body: "", filePath: "org/docs/c.pdf", linkUrl: null, pinned: false, publishedAt: "2026-11-01T00:00:00Z" }],
  };
  assert.deepEqual(siteFilePaths(site), ["org/hero/a.jpg", "org/photos/b.jpg", "org/docs/c.pdf"]);
});
