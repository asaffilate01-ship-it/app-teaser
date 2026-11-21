import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { languages } from "../src/lib/content.ts";
import {
  canonicalUrl,
  CRICLUME_OG_IMAGE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  cricketSearchTopics,
  criclumeStructuredData,
} from "../src/lib/seo.ts";

test("only criclume.com is the canonical public marketing and legal host", () => {
  assert.equal(canonicalUrl("/"), "https://criclume.com/");
  assert.equal(canonicalUrl("/privacy"), "https://criclume.com/privacy");
  assert.equal(canonicalUrl("/terms"), "https://criclume.com/terms");
  assert.match(CRICLUME_OG_IMAGE, /^https:\/\/criclume\.com\/icon-512\.png$/);
  assert.match(readFileSync("public/sitemap.xml", "utf8"), /https:\/\/criclume\.com\//);
  assert.doesNotMatch(readFileSync("public/sitemap.xml", "utf8"), /lovable\.app/);
  assert.match(readFileSync("public/robots.txt", "utf8"), /Sitemap: https:\/\/criclume\.com\/sitemap\.xml/);
});

test("accurate site metadata covers real cricket scoring search intent", () => {
  assert.match(HOME_TITLE, /cricket scoring/i);
  assert.match(HOME_DESCRIPTION, /ball by ball|ball-by-ball/i);
  assert.ok(cricketSearchTopics.length >= 10);
  assert.match(cricketSearchTopics.join(" "), /cricket scorecard/);
  assert.match(cricketSearchTopics.join(" "), /cricket league fixtures/);
  const schema = JSON.stringify(criclumeStructuredData);
  assert.match(schema, /"WebApplication"/);
  assert.match(schema, /"SportsApplication"/);
  assert.doesNotMatch(schema, /aggregateRating|fake|endorsement/i);
});

test("public copy does not expose internal release notices in any language", () => {
  for (const [lang, copy] of Object.entries(languages)) {
    assert.equal("intro" in copy.featuresTab, false, `${lang}: remove release features paragraph`);
    assert.equal("desc" in copy.footer, false, `${lang}: remove release footer paragraph`);
    assert.ok(copy.hero.keywordLine.length > 18, `${lang}: real search description`);
    assert.doesNotMatch(copy.hero.body, /pilot|being tested|in development|wird getestet|worden getest|en pilote/i);
  }
  const home = readFileSync("src/routes/index.tsx", "utf8");
  assert.doesNotMatch(home, /t\.featuresTab\.intro|t\.footer\.desc|shotDashboard|shotScoreboard|shotMobile|shotReview/);
  assert.match(home, /<MarketingScreenPreview/);
});

test("gallery replaces unrelated logos and fabricated match statistics", () => {
  const gallery = readFileSync("src/components/MarketingScreenPreview.tsx", "utf8");
  assert.doesNotMatch(gallery, /ScorePro|CoachView|Royal Challengers|Riverside CC|KKR|RCB/i);
  assert.match(gallery, /CRICLUME/);
  assert.match(gallery, /CricLume club command-centre/);
  const root = readFileSync("src/routes/__root.tsx", "utf8");
  assert.match(root, /apple-touch-icon/);
  assert.match(root, /icon\.svg/);
});
