import test from "node:test";
import assert from "node:assert/strict";
import { languages } from "../src/lib/content.ts";
import { adRevenueSharePercent } from "../src/lib/plans.ts";

test("hero plan notes quote the paid ad share (30%) and the video add-on share (50%) in every language", () => {
  const paid = adRevenueSharePercent("club");
  const video = adRevenueSharePercent("club", { videoAddon: true });
  assert.equal(paid, 30);
  assert.equal(video, 50);
  for (const [language, copy] of Object.entries(languages)) {
    assert.equal(copy.hero.planNotes.length, 4, `${language}: Starter, Club, League and video add-on`);
    assert.match(copy.hero.planNotes[1]!, new RegExp(`${paid}\\s?%`), `${language}: Club note`);
    assert.match(copy.hero.planNotes[3]!, new RegExp(`${video}\\s?%`), `${language}: video add-on note`);
    assert.match(copy.hero.planNotes[3]!, /16/, `${language}: up to 16 cameras with the add-on`);
  }
});

test("every language lists the same number of hero features", () => {
  const counts = Object.values(languages).map((copy) => copy.hero.features.length);
  assert.ok(counts.every((n) => n === counts[0]));
});

test("plan cards state the ad share each tier earns, in every language", () => {
  for (const [language, copy] of Object.entries(languages)) {
    const [, club, league] = copy.pricing.plans;
    assert.ok(club!.perks.some((p) => /30\s?%/.test(p)), `${language}: Club card names 30%`);
    assert.ok(league!.perks.some((p) => /30\s?%/.test(p)), `${language}: League card names 30%`);
    assert.ok(copy.pricing.addon.perks.some((p) => /50\s?%/.test(p)), `${language}: video add-on names 50%`);
    assert.ok(copy.pricing.addon.perks.some((p) => /\b16\b/.test(p)), `${language}: video add-on names 16 cameras`);
    assert.ok(league!.perks.some((p) => /criclume\.com/.test(p)), `${language}: League card offers the free criclume.com address`);
  }
});
