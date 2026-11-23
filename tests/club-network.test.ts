import { describe, expect, test } from "bun:test";
import { cleanPlace, placeLine, provinceNames, regionNames, townNames, type GeoCountry } from "../src/lib/geo";
import { canAddTeam, suggestedShortName, suggestedTeamName } from "../src/lib/team-types";
import { teamLimit } from "../src/lib/plans";
import { externalTeams } from "../src/lib/platform-cloud";

const sample: GeoCountry = {
  v: 1,
  p: [
    { n: "Punjab", r: [{ n: "Lahore", t: ["Lahore", "Model Town"] }, { n: "Multan", t: ["Multan"] }], t: [] },
    { n: "Islamabad", r: [], t: ["Islamabad", "Saidpur"] },
  ],
};

describe("club location lists", () => {
  test("each level lists only places inside the one picked before it", () => {
    expect(provinceNames(sample)).toEqual(["Punjab", "Islamabad"]);
    expect(regionNames(sample, "Punjab")).toEqual(["Lahore", "Multan"]);
    expect(townNames(sample, "Punjab", "Lahore")).toEqual(["Lahore", "Model Town"]);
    expect(townNames(sample, "Punjab", "")).toEqual([]);
  });
  test("a province without regions goes straight to its towns", () => {
    expect(regionNames(sample, "Islamabad")).toEqual([]);
    expect(townNames(sample, "Islamabad", "")).toEqual(["Islamabad", "Saidpur"]);
  });
  test("saved places are trimmed to the database limits", () => {
    const clean = cleanPlace({ country: "PK", province: ` ${"P".repeat(70)} `, district: "x".repeat(90), town: " Lahore " });
    expect(clean.province.length).toBe(60);
    expect(clean.district.length).toBe(80);
    expect(clean.town).toBe("Lahore");
    expect(cleanPlace({ country: "pk", province: "", district: "", town: "" }).country).toBe("");
  });
  test("place line reads town first and drops repeats", () => {
    expect(placeLine({ town: "Lahore", district: "Lahore", province: "Punjab" })).toBe("Lahore, Punjab");
  });
});

describe("teams per plan", () => {
  test("free clubs get one team, paid plans as many as they like", () => {
    expect(teamLimit("starter")).toBe(1);
    expect(teamLimit("club")).toBeNull();
    expect(teamLimit("league")).toBeNull();
  });
  test("a second team is blocked on the free plan only", () => {
    expect(canAddTeam({ limit: 1, used: 0 })).toBe(true);
    expect(canAddTeam({ limit: 1, used: 1 })).toBe(false);
    expect(canAddTeam({ limit: null, used: 12 })).toBe(true);
  });
  test("team names are suggested from the club and team type", () => {
    expect(suggestedTeamName("Riverside Cricket Club", "second_xi")).toBe("Riverside CC 2nd XI");
    expect(suggestedTeamName("Riverside Cricket Club", "u13")).toBe("Riverside CC U13");
    expect(suggestedTeamName("Riverside Cricket Club", "women")).toBe("Riverside CC Women 1st XI");
    expect(suggestedShortName("Riverside CC 2nd XI", "second_xi")).toBe("RIV2");
  });
});

describe("invited clubs' teams", () => {
  test("carry their club name and every competition they entered", () => {
    const teams = externalTeams(
      [
        { competition_id: "c1", team_id: "t1", name: "1st XI", short_name: "KIN", club_name: "Kingsmead CC" },
        { competition_id: "c2", team_id: "t1", name: "1st XI", short_name: "KIN", club_name: "Kingsmead CC" },
        { competition_id: "c1", team_id: "own", name: "Ours", short_name: "OUR", club_name: "Riverside" },
      ],
      new Set(["own"]),
    );
    expect(teams).toHaveLength(1);
    expect(teams[0]?.name).toBe("Kingsmead CC 1st XI");
    expect(teams[0]?.competitionIds).toEqual(["c1", "c2"]);
    expect(teams[0]?.external).toBe(true);
  });
});
