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
