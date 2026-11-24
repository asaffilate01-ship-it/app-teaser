import assert from "node:assert/strict";
import test from "node:test";
import {
  b64url,
  encryptPayload,
  fromB64url,
  isAllowedPushEndpoint,
  vapidAuthorization,
  vapidKeysFromSecret,
} from "../src/lib/web-push.server.ts";

test("the VAPID public key is the private key's real public point and the JWT verifies", async () => {
  const keys = await vapidKeysFromSecret("s".repeat(64));
  const priv = await crypto.subtle.importKey(
    "jwk",
    keys.privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );
  assert.ok(priv);
  const pub = await crypto.subtle.importKey(
    "raw",
    fromB64url(keys.publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const header = await vapidAuthorization(
    "https://fcm.googleapis.com/fcm/send/x",
    keys,
    "mailto:alerts@criclume.com",
  );
  const [h, c, s] = header.match(/t=([^,]+)/)![1]!.split(".") as [string, string, string];
  assert.equal(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      fromB64url(s),
      new TextEncoder().encode(`${h}.${c}`),
    ),
    true,
  );
  assert.equal(
    JSON.parse(new TextDecoder().decode(fromB64url(c))).aud,
    "https://fcm.googleapis.com",
  );
  assert.equal((await vapidKeysFromSecret("s".repeat(64))).publicKey, keys.publicKey);
});

test("encrypted payload decrypts with the subscriber's keys (aes128gcm)", async () => {
  const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const body = await encryptPayload(new TextEncoder().encode("WICKET"), {
    p256dh: b64url(uaPublic),
    auth: b64url(auth),
  });
  const salt = body.slice(0, 16);
  const asPublic = body.slice(21, 21 + body[20]!);
  const asKey = await crypto.subtle.importKey(
    "raw",
    asPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256),
  );
  const hk = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) =>
    new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: s, info },
        await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]),
        n * 8,
      ),
    );
  const enc = new TextEncoder();
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hk(auth, shared, info, 32);
  const cek = await crypto.subtle.importKey(
    "raw",
    await hk(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const nonce = await hk(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      cek,
      body.slice(21 + asPublic.length),
    ),
  );
  assert.equal(new TextDecoder().decode(plain.slice(0, -1)), "WICKET");
  assert.equal(plain.at(-1), 2);
});

test("only real browser push services are accepted", () => {
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(isAllowedPushEndpoint("https://web.push.apple.com/QH"), true);
  assert.equal(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x"), true);
  assert.equal(isAllowedPushEndpoint("http://fcm.googleapis.com/x"), false);
  assert.equal(isAllowedPushEndpoint("https://evil.example.com/push"), false);
  assert.equal(isAllowedPushEndpoint("https://169.254.169.254/latest"), false);
});
