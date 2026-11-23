import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { languages } from "../src/lib/content.ts";

const internalMoneyQuestions = [
  "How does CricLume make money?",
  "Wie verdient CricLume Geld?",
  "Hoe verdient CricLume geld?",
  "Hoe maak CricLume geld?",
  "Comment CricLume gagne-t-il de l'argent ?",
];

test("public homepage translations exclude internal commercial strategy and fabricated live metrics", () => {
  assert.equal(Object.keys(languages).length, 5);
  for (const [language, copy] of Object.entries(languages)) {
    const publicText = JSON.stringify(copy);
    assert.doesNotMatch(
      publicText,
      /How CricLume makes money|Business model|Geschäftsmodell|Verdienmodel|Sakemodel|Modèle économique|Hoe CricLume geld verdient|Wie CricLume Geld verdient/i,
      `${language}: private commercial copy should not ship in the public bundle`,
    );
    assert.doesNotMatch(publicText, /100%.*history|<1s|4\+.*(?:angles|camera|Winkel|hoeke)/i);
    assert.doesNotMatch(
      publicText,
      /Live • Riverside CC|Regstreeks • Riverside CC|En direct • Riverside CC/,
    );
    assert.ok(copy.home.workflowKicker.length > 5, `${language}: workflow heading is required`);
    assert.equal(copy.home.workflowSteps.length, 3, `${language}: explain three core workflows`);
    for (const step of copy.home.workflowSteps) {
      assert.ok(
        step.title.length > 3 && step.body.length > 30,
        `${language}: avoid empty workflow cards`,
      );
    }
    assert.ok(copy.hero.previewLabel.length > 5, `${language}: screenshot needs preview label`);
    assert.ok(
      copy.pricing.pilotNotice.length > 40,
      `${language}: pricing requires clear pilot notice`,
    );
    assert.equal(
      copy.faq.items.some(({ q }) => internalMoneyQuestions.includes(q)),
      false,
      `${language}: internal revenue FAQ must be absent`,
    );
  }
});

test("rain FAQ offers the built rain rules and DLS only from official inputs", () => {
  for (const [language, copy] of Object.entries(languages)) {
    const rain = copy.faq.items.find(({ q }) =>
      /rain rules|Regenregeln|regenregels|reënreëls|règles de pluie/i.test(q),
    );
    assert.ok(rain, `${language}: expected rain rule FAQ`);
    assert.doesNotMatch(rain.a, /^(Not yet|Noch nicht|Nog niet|Nog nie|Pas encore)\b/i);
    assert.match(rain.a, /DLS/, `${language}: DLS option must be named`);
    assert.match(rain.a, /offici|offiziell|amptelik/i, `${language}: DLS comes from the official resource`);
  }
});

test("camera copy states the real 16-phone match limit, never unlimited", () => {
  for (const [language, copy] of Object.entries(languages)) {
    const text = JSON.stringify(copy);
    assert.doesNotMatch(text, /Unlimited camera|Unbegrenzte Kamera|Onbeperkt camera|Onbeperkte kamera|caméra illimités/i);
    const cameras = copy.faq.items[1]!;
    assert.match(cameras.a, /\b16\b/, `${language}: camera FAQ names the 16-phone limit`);
    assert.doesNotMatch(text, /\b8 (phones|Handys|telefoons|fone|téléphones)/, `${language}: no leftover 8-phone limit`);
  }
});

test("free scoring and paid Club enquiries are distinct public journeys", () => {
  for (const [language, copy] of Object.entries(languages)) {
    assert.equal(copy.pricing.plans.length, 3, `${language}: three plan tiers expected`);
    const hasMatchExport = copy.pricing.plans[0]!.perks.some((value) =>
      /JSON|export|Export|uitvoer|back-up|Sicherung|sauvegarde/i.test(value),
    );
    assert.ok(hasMatchExport, `${language}: free plan needs the match export perk`);
    assert.ok(copy.pricing.plans[1]!.cta.length > 3);
  }
});

test("homepage does not advertise stale fictional fixtures or invented results", () => {
  const route = readFileSync("src/routes/index.tsx", "utf8");
  assert.doesNotMatch(
    route,
    /const fixtures\s*=|const leaderboard\s*=|Sat 12 Sep|Riverside CC 148\/4/,
  );
  assert.match(route, /t\.home\.workflowSteps\.map/);
  assert.match(route, /t\.hero\.previewLabel/);
});
