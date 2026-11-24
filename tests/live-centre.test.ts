import { describe, it } from "node:test";
import { expect } from "./assert-expect.ts";
import {
  filterLiveMatches,
  liveEventsBetween,
  liveFilterOptions,
  newBallsBetween,
  parseLiveAlertPrefs,
  shouldAlert,
  type LiveMatch,
} from "../src/lib/live-centre.ts";

const base: LiveMatch = {
  slug: "riverside-v-kingsmead",
  matchId: "m1",
  status: "live",
  updatedAt: "2026-11-23T10:00:00Z",
  homeTeam: { id: "h", name: "Riverside CC", shortName: "RIV" },
  awayTeam: { id: "a", name: "Kingsmead CC", shortName: "KIN" },
  competition: { id: "c1", name: "Lahore Premier" },
  country: "PK",
  region: "Punjab",
  liveState: {
    battingTeamId: "h",
    runs: 40,
    wickets: 1,
    overs: "5.0",
    inningsNumber: 1,
    settings: { ballsPerOver: 6, oversPerInnings: 20 },
    recent: [
      { label: "1" }, { label: "·" }, { label: "2" }, { label: "1" }, { label: "·" }, { label: "1" },
    ].map((ball) => ({ ...ball, kind: "normal" })),
  },
};

const after = (patch: Partial<NonNullable<LiveMatch["liveState"]>>, extra: Partial<LiveMatch> = {}): LiveMatch => ({
  ...base,
  ...extra,
  liveState: { ...base.liveState, ...patch },
});

describe("live centre filters", () => {
  const others: LiveMatch[] = [
    base,
    { ...base, slug: "b", country: "PK", region: "Sindh", competition: { id: "c2", name: "Karachi Cup" } },
    { ...base, slug: "c", country: "GB", region: "Yorkshire", competition: { id: "c3", name: "Yorkshire League" }, status: "completed" },
  ];

  it("shows only matches in the chosen country and region", () => {
    expect(filterLiveMatches(others, { bucket: "all", country: "PK" }).map((m) => m.slug)).toEqual(["riverside-v-kingsmead", "b"]);
    expect(filterLiveMatches(others, { bucket: "all", country: "PK", region: "sindh" }).map((m) => m.slug)).toEqual(["b"]);
  });

  it("separates live matches from results", () => {
    expect(filterLiveMatches(others, { bucket: "live" })).toHaveLength(2);
    expect(filterLiveMatches(others, { bucket: "results" }).map((m) => m.slug)).toEqual(["c"]);
  });

  it("filters by competition and by followed matches", () => {
    expect(filterLiveMatches(others, { bucket: "all", competition: "c3" }).map((m) => m.slug)).toEqual(["c"]);
    expect(filterLiveMatches(others, { bucket: "all", following: new Set(["b"]) }).map((m) => m.slug)).toEqual(["b"]);
  });

  it("offers regions only from the chosen country", () => {
    const options = liveFilterOptions(others, { country: "PK" });
    expect(options.regions.map((r) => r.value).sort()).toEqual(["Punjab", "Sindh"]);
    expect(options.countries.find((c) => c.value === "PK")?.count).toBe(2);
  });
});

describe("live alerts", () => {
  it("announces a six and a four from the new balls", () => {
    const next = after({ runs: 50, overs: "5.2", recent: [...base.liveState!.recent!.slice(2), { label: "6", kind: "boundary" }, { label: "4", kind: "boundary" }] });
    const kinds = liveEventsBetween(base, next).map((e) => e.kind);
    expect(kinds).toContain("six");
    expect(kinds).toContain("four");
  });

  it("announces a wicket", () => {
    const next = after({ wickets: 2, overs: "5.1", recent: [...base.liveState!.recent!.slice(1), { label: "W", kind: "wicket" }] });
    const events = liveEventsBetween(base, next);
    expect(events[0]?.kind).toBe("wicket");
    expect(events[0]?.body).toContain("2nd wicket down");
  });

  it("stays quiet when a ball is undone", () => {
    const undone = after({ runs: 34, overs: "4.5" });
    expect(liveEventsBetween(base, undone)).toEqual([]);
  });

  it("announces a rain delay and play resuming", () => {
    const stopped = after({ stoppage: { reason: "rain", since: "2026-11-23T10:05:00Z" } });
    expect(liveEventsBetween(base, stopped).map((e) => e.title)).toEqual(["Rain delay: Riverside CC v Kingsmead CC"]);
    expect(liveEventsBetween(stopped, base).map((e) => e.title)).toEqual(["Play resumes: Riverside CC v Kingsmead CC"]);
  });

  it("announces the end of the match with the result", () => {
    const done = after({ result: "Riverside CC won by 12 runs" }, { status: "completed" });
    const events = liveEventsBetween(base, done);
    expect(events.map((e) => [e.kind, e.title])).toEqual([["result", "Riverside CC won by 12 runs"]]);
  });

  it("announces a team reaching 50", () => {
    const next = after({ runs: 52, overs: "5.3", recent: [...base.liveState!.recent!.slice(3), { label: "4", kind: "boundary" }, { label: "4", kind: "boundary" }, { label: "4", kind: "boundary" }] });
    expect(liveEventsBetween(base, next).some((e) => e.kind === "milestone" && e.title === "Riverside CC reach 50")).toBe(true);
  });

  it("does not invent boundaries when the trail cannot line up", () => {
    expect(newBallsBetween([{ label: "1" }], [{ label: "6", kind: "boundary" }], 1, 1)).toEqual([]);
  });

  it("only alerts followed matches when set to following", () => {
    const prefs = { ...parseLiveAlertPrefs(null), scope: "following" as const };
    const event = { key: "k", kind: "six" as const, slug: "x", title: "SIX!", body: "" };
    expect(shouldAlert(event, prefs, new Set())).toBe(false);
    expect(shouldAlert(event, prefs, new Set(["x"]))).toBe(true);
    expect(shouldAlert(event, { ...prefs, kinds: { ...prefs.kinds, six: false } }, new Set(["x"]))).toBe(false);
  });
});
