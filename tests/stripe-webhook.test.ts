import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyStripeSignature } from "../src/lib/stripe-webhook.server.ts";

const secret = "whsec_test_only";
const payload = '{"id":"evt_test","type":"checkout.session.completed"}';

function signatureHeader(timestamp: number, body: string, signingSecret = secret): string {
  const signature = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

test("Stripe webhook verifier accepts a current correctly signed payload", async () => {
  const timestamp = Math.floor(Date.now() / 1000);
  await verifyStripeSignature(payload, signatureHeader(timestamp, payload), secret);
});

test("Stripe webhook verifier rejects a changed payload and stale timestamp", async () => {
  const timestamp = Math.floor(Date.now() / 1000);
  await assert.rejects(
    verifyStripeSignature(`${payload} `, signatureHeader(timestamp, payload), secret),
    /verification failed/,
  );
  await assert.rejects(
    verifyStripeSignature(payload, signatureHeader(timestamp - 600, payload), secret),
    /outside the allowed window/,
  );
});
