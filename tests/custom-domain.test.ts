import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PRIMARY_DOMAIN = "criclume.com";
const STALE_HOST = "app-teaser.lovable.app";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

test("sitemap lists only the primary custom domain", () => {
  const xml = read("../public/sitemap.xml");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  assert.ok(urls.length > 0, "sitemap must list at least one page");
  for (const url of urls) {
    assert.ok(
      url.startsWith(`https://${PRIMARY_DOMAIN}/`),
      `sitemap entry should be on ${PRIMARY_DOMAIN}, found ${url}`,
    );
  }
  assert.ok(!xml.includes(STALE_HOST), `sitemap must not mention ${STALE_HOST}`);
});

test("robots.txt advertises the sitemap on the primary domain", () => {
  const robots = read("../public/robots.txt");
  const sitemapLine = robots.split("\n").find((line) => line.toLowerCase().startsWith("sitemap:"));

  assert.ok(sitemapLine, "robots.txt must declare a Sitemap line");
  assert.equal(sitemapLine.trim(), `Sitemap: https://${PRIMARY_DOMAIN}/sitemap.xml`);
});

test("no page metadata still points at the old Lovable address", () => {
  const routeDir = new URL("../src/routes/", import.meta.url);
  const offenders = readdirSync(routeDir)
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) => read(`../src/routes/${name}`).includes(STALE_HOST));

  assert.deepEqual(
    offenders,
    [],
    `routes still referencing ${STALE_HOST}: ${offenders.join(", ")}`,
  );
});

test("homepage declares the primary domain as canonical and as its share URL", () => {
  const home = read("../src/routes/index.tsx");

  assert.ok(
    home.includes(`href: "https://${PRIMARY_DOMAIN}/"`),
    "homepage must carry a canonical link on the primary domain",
  );
  assert.ok(
    home.includes(`content: "https://${PRIMARY_DOMAIN}/"`),
    "homepage must carry an og:url on the primary domain",
  );
});
