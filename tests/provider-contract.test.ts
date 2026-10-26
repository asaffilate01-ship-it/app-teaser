import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyVideoSignature,
  parseVideoCallback,
  httpsEndpoint,
} from "../supabase/functions/_shared/provider-contract.ts";
test("callback HMAC rejects tampering, stale timestamps and missing secret", async () => {
  const raw = '{"jobId":"11111111-1111-4111-8111-111111111111","status":"ready"}',
    secret = "fixture-only-".repeat(4),
    timestamp = "1793000000";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${raw}`)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  await verifyVideoSignature(raw, timestamp, sig, secret, Number(timestamp) * 1000);
  await assert.rejects(() =>
    verifyVideoSignature(raw + " ", timestamp, sig, secret, Number(timestamp) * 1000),
  );
  await assert.rejects(() =>
    verifyVideoSignature(raw, timestamp, sig, secret, Number(timestamp) * 1000 + 300001),
  );
  await assert.rejects(() =>
    verifyVideoSignature(raw, timestamp, sig, "", Number(timestamp) * 1000),
  );
});
test("callback does not accept storage paths or publication states", () => {
  const c = { jobId: "11111111-1111-4111-8111-111111111111", status: "ready" };
  assert.deepEqual(parseVideoCallback(c), c);
  assert.throws(() => parseVideoCallback({ ...c, path: "public/file" }));
  assert.throws(() => parseVideoCallback({ ...c, status: "published" }));
  assert.throws(() => httpsEndpoint("http://example.com"));
  assert.throws(() => httpsEndpoint("https://user:pass@example.com"));
});
