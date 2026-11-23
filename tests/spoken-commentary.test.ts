import assert from "node:assert/strict";
import test from "node:test";
import type { CommentaryLine } from "../src/lib/commentary.ts";
import { linesToSpeak, speechText } from "../src/lib/spoken-commentary.ts";

const line = (id: string, over: string, text: string, tone: CommentaryLine["tone"] = "dot"): CommentaryLine => ({ id, over, text, tone });

test("ball 12.3 is read as the third ball of the 13th over, then the text", () => {
  assert.equal(speechText(line("a", "12.3", "FOUR through cover.")), "Over 13, ball 3. FOUR through cover.");
  assert.equal(speechText(line("b", "End of over 12", "8 runs.", "over")), "End of over 12. 8 runs.");
});

test("switching on reads only the latest ball, not the whole innings", () => {
  const feed = [line("c", "0.3", "c"), line("b", "0.2", "b"), line("a", "0.1", "a")];
  assert.deepEqual(linesToSpeak(feed, new Set()).map((item) => item.id), ["c"]);
});

test("new balls are read oldest first, at most three after a gap", () => {
  const feed = ["f", "e", "d", "c", "b", "a"].map((id, index) => line(id, `0.${6 - index}`, id));
  // c, d, e, f are new; only the latest three are read, oldest first.
  assert.deepEqual(linesToSpeak(feed, new Set(["b", "a"])).map((item) => item.id), ["d", "e", "f"]);
});
