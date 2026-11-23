import assert from "node:assert/strict";
import test from "node:test";
import { serviceWorkerAllowed } from "../src/lib/sw-guard.ts";

const at = (hostname: string, extra: Partial<Parameters<typeof serviceWorkerAllowed>[0]> = {}) =>
  serviceWorkerAllowed({ prod: true, hostname, inIframe: false, search: "", ...extra });

test("alerts and offline helper run on the live site only", () => {
  assert.equal(at("criclume.com"), true);
  assert.equal(at("www.criclume.com"), true);
  assert.equal(at("app-teaser.lovable.app"), true);
  assert.equal(at("id-preview--4fdd88f7-86ce-40f6-8f36-03dbb58cdac2.lovable.app"), false);
  assert.equal(at("preview--app-teaser.lovable.app"), false);
  assert.equal(at("x.lovableproject.com"), false);
  assert.equal(at("criclume.com", { inIframe: true }), false);
  assert.equal(at("criclume.com", { prod: false }), false);
  assert.equal(at("criclume.com", { search: "?sw=off" }), false);
});
