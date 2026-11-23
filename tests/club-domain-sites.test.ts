import test from "node:test";
import assert from "node:assert/strict";
import {
  cachedClubHost,
  clubDomainRedirect,
  isPlatformHost,
  rememberClubHost,
  toExternalPath,
  toInternalPath,
} from "../src/lib/club-domains.ts";
import { cleanDomainInput, dnsRecordsFor, looksLikeDomain } from "../src/lib/club-domain-records.ts";

test("CricLume's own addresses and previews are never treated as club domains", () => {
  for (const host of ["criclume.com", "www.criclume.com", "localhost", "app-teaser.lovable.app", "id-preview--x.lovable.app"]) {
    assert.equal(isPlatformHost(host), true, host);
  }
  assert.equal(isPlatformHost("riversidecc.com"), false);
});

test("clean addresses on a club domain map to that club's website pages and back", () => {
  assert.equal(toInternalPath("/", "riverside"), "/club/riverside");
  assert.equal(toInternalPath("/fixtures", "riverside"), "/club/riverside/fixtures");
  assert.equal(toInternalPath("/news/abc-123", "riverside"), "/club/riverside/news/abc-123");
  assert.equal(toExternalPath("/club/riverside", "riverside"), "/");
  assert.equal(toExternalPath("/club/riverside/gallery", "riverside"), "/gallery");
  assert.equal(toExternalPath("/club/other/gallery", "riverside"), "/club/other/gallery");
});

test("on a club domain, app pages go to criclume.com and long club addresses go to the clean one", () => {
  const slug = "riverside";
  assert.equal(clubDomainRedirect(new URL("https://riversidecc.com/"), slug), null);
  assert.equal(clubDomainRedirect(new URL("https://riversidecc.com/news"), slug), null);
  assert.equal(clubDomainRedirect(new URL("https://riversidecc.com/app?x=1"), slug), "https://criclume.com/app?x=1");
  assert.equal(clubDomainRedirect(new URL("https://riversidecc.com/club/other"), slug), "https://criclume.com/club/other");
  assert.equal(clubDomainRedirect(new URL("https://riversidecc.com/club/riverside/news"), slug), "/news");
  assert.equal(clubDomainRedirect(new URL("https://riversidecc.com/assets/app.js"), slug), null);
  assert.equal(clubDomainRedirect(new URL("https://riversidecc.com/_serverFn/abc"), slug), null);
});

test("domain lookups are remembered for a while, then asked again", () => {
  rememberClubHost("Example-Club.org", "example", 1000, 0);
  assert.equal(cachedClubHost("example-club.org", 500), "example");
  assert.equal(cachedClubHost("example-club.org", 2000), undefined);
});

test("clubs see the root and www address records plus any extra records", () => {
  const records = dnsRecordsFor("185.158.133.1", "TXT _lovable lovable_verify=abc\nnot a record");
  assert.deepEqual(records, [
    { type: "A", name: "@", value: "185.158.133.1" },
    { type: "A", name: "www", value: "185.158.133.1" },
    { type: "TXT", name: "_lovable", value: "lovable_verify=abc" },
  ]);
});

test("typed web addresses are cleaned before sending", () => {
  assert.equal(cleanDomainInput(" https://www.RiversideCC.com/home "), "riversidecc.com");
  assert.equal(looksLikeDomain("riversidecc.com"), true);
  assert.equal(looksLikeDomain("not a domain"), false);
});

test("a free club address like riverside.criclume.com is looked up as a club website; CricLume's own names are not", async () => {
  const { criclumeClubLabel } = await import("../src/lib/club-domains.ts");
  assert.equal(isPlatformHost("riverside.criclume.com"), false);
  assert.equal(criclumeClubLabel("Riverside.CriCLume.com"), "riverside");
  assert.equal(isPlatformHost("www.criclume.com"), true);
  assert.equal(isPlatformHost("a.b.criclume.com"), true);
  assert.equal(criclumeClubLabel("riversidecc.com"), null);
});

test("free CricLume address names: 3-40 letters, numbers or single dashes, and CricLume's own names are kept", async () => {
  const { cleanClubLabel, clubLabelProblem } = await import("../src/lib/club-domain-records.ts");
  assert.equal(cleanClubLabel("Riverside C.C."), "riverside-c-c");
  assert.equal(cleanClubLabel("https://Riverside.criclume.com/news"), "riverside");
  assert.equal(cleanClubLabel("x".repeat(60)).length, 40);
  assert.equal(clubLabelProblem("riverside-cc"), null);
  assert.notEqual(clubLabelProblem("ab"), null);
  assert.notEqual(clubLabelProblem("www"), null);
  assert.notEqual(clubLabelProblem("shop"), null);
});

test("staff add the free address in criclume.com's DNS by its name", async () => {
  const { criclumeStaffRecords } = await import("../src/lib/club-domain-records.ts");
  assert.deepEqual(criclumeStaffRecords("riverside.criclume.com", "185.158.133.1", "TXT _lovable.riverside lovable_verify=abc"), [
    { type: "A", name: "riverside", value: "185.158.133.1" },
    { type: "TXT", name: "_lovable.riverside", value: "lovable_verify=abc" },
  ]);
});

test("the app and the database keep the same list of CricLume-only names", async () => {
  const { readFileSync } = await import("node:fs");
  const { reservedClubLabels } = await import("../src/lib/club-domain-records.ts");
  const sql = readFileSync(new URL("../drizzle/migrations/0032_club_criclume_addresses.sql", import.meta.url), "utf8");
  const list = sql.match(/any \(array\[([\s\S]*?)\]\)/)?.[1] ?? "";
  const dbNames = new Set([...list.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]));
  assert.deepEqual([...dbNames].sort(), [...reservedClubLabels].sort());
});
