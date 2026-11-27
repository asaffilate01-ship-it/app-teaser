import assert from "node:assert/strict";
import test from "node:test";
import { languages, langOrder } from "../src/lib/content.ts";
import { helpCopy, searchHelpQuestions } from "../src/lib/help-centre.ts";

test("all five public languages have eight additional unique help answers", () => {
  for (const lang of langOrder) {
    const copy = helpCopy[lang];
    assert.equal(copy.items.length, 8);
    const items = [...languages[lang].faq.items, ...copy.items];
    assert.equal(new Set(items.map((item) => item.q)).size, items.length);
    assert.ok(items.length >= 26);
    assert.ok(copy.items.every((item) => item.q.length > 10 && item.a.length > 40));
    assert.doesNotMatch(JSON.stringify(copy), /itechlounge/i);
  }
});

test("search matches questions and answers, ignores case and accents, and handles no matches", () => {
  const items = helpCopy.en.items;
  assert.equal(searchHelpQuestions(items, "  CAMERA  ").length, 0);
  assert.equal(searchHelpQuestions(items, "speed uncertainty").length, 1);
  assert.equal(searchHelpQuestions(items, "unmatched999").length, 0);
  assert.deepEqual(searchHelpQuestions(items, " "), items);
  assert.ok(searchHelpQuestions(helpCopy.fr.items, "camera").length === 0);
  assert.equal(searchHelpQuestions(helpCopy.fr.items, "vitesse radar").length, 1);
  assert.equal(searchHelpQuestions(helpCopy.fr.items, "separee approbation").length, 0);
  assert.equal(searchHelpQuestions(helpCopy.fr.items, "approbation distincte").length, 1);
  assert.equal(searchHelpQuestions([{ q: "Équipe", a: "Privé" }], "equipe prive").length, 1);
});

test("new help explains AI and measurement limitations without claiming native store release", () => {
  const items = helpCopy.en.items;
  assert.match(items[0]!.a, /require separate approval/);
  assert.match(items[1]!.a, /not a certified radar reading/);
  assert.match(items[3]!.a, /human review/);
  assert.match(items[3]!.a, /does not change official scores/);
});
