import test from "node:test";
import assert from "node:assert/strict";
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
    assert.ok(copy.home.sampleNotice.length > 24, `${language}: examples must be labelled`);
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

test("no public translation claims licensed rain-adjusted targets are available", () => {
  for (const [language, copy] of Object.entries(languages)) {
    const rain = copy.faq.items.find(({ q }) =>
      /rain rules|Regenregeln|regenregels|reënreëls|règles de pluie/i.test(q),
    );
    assert.ok(rain, `${language}: expected rain rule FAQ`);
    assert.match(
      rain.a,
      /^(Not yet|Noch nicht|Nog niet|Nog nie|Pas encore)\b/i,
      `${language}: FAQ must be honest about licensed rain targets`,
    );
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
