/**
 * Web Push (RFC 8030/8291/8292) with WebCrypto only, so it runs on the edge worker without Node packages.
 * The VAPID key pair is derived from the PUSH_VAPID_SECRET secret, so no key file needs storing.
 */

const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const A = P - 3n;
const G: Point = [
  0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
  0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n,
];
type Point = [bigint, bigint] | null;

const mod = (value: bigint, m = P) => ((value % m) + m) % m;
function inverse(value: bigint): bigint {
  let [a, b, x, y] = [mod(value), P, 1n, 0n];
  while (b !== 0n) {
    const q = a / b;
    [a, b, x, y] = [b, a - q * b, y, x - q * y];
  }
  return mod(x);
}
function add(p1: Point, p2: Point): Point {
  if (!p1) return p2;
  if (!p2) return p1;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  if (x1 === x2 && mod(y1 + y2) === 0n) return null;
  const slope =
    x1 === x2 && y1 === y2
      ? mod((3n * x1 * x1 + A) * inverse(2n * y1))
      : mod((y2 - y1) * inverse(x2 - x1));
  const x3 = mod(slope * slope - x1 - x2);
  return [x3, mod(slope * (x1 - x3) - y1)];
}
function multiply(k: bigint, point: Point): Point {
  let result: Point = null;
  let addend = point;
  while (k > 0n) {
    if (k & 1n) result = add(result, addend);
    addend = add(addend, addend);
    k >>= 1n;
  }
  return result;
}

const toBytes = (value: bigint, length = 32) => {
  const out = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i -= 1) {
    out[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return out;
};
const fromBytes = (bytes: Uint8Array) =>
  bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
export const b64url = (bytes: Uint8Array | ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export const fromB64url = (text: string): Uint8Array<ArrayBuffer> => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};
const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};
const utf8 = (text: string): Uint8Array<ArrayBuffer> =>
  new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;

export interface VapidKeys {
  publicKey: string; // base64url, uncompressed point (65 bytes) — the browser's applicationServerKey
  privateJwk: JsonWebKey;
}

/** Deterministic P-256 key pair from the app secret. */
export async function vapidKeysFromSecret(secret: string): Promise<VapidKeys> {
  if (secret.length < 32) throw new Error("PUSH_VAPID_SECRET is too short");
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const seed = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, utf8("criclume-vapid-v1")));
  const d = mod(fromBytes(seed), N - 1n) + 1n;
  const point = multiply(d, G)!;
  const x = toBytes(point[0]);
  const y = toBytes(point[1]);
  return {
    publicKey: b64url(concat(new Uint8Array([4]), x, y)),
    privateJwk: {
      kty: "EC",
      crv: "P-256",
      d: b64url(toBytes(d)),
      x: b64url(x),
      y: b64url(y),
      ext: true,
    },
  };
}

/** VAPID Authorization header value for a push endpoint (RFC 8292). */
export async function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  now = Date.now(),
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = b64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    utf8(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })),
  );
  const key = await crypto.subtle.importKey(
    "jwk",
    keys.privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    utf8(`${header}.${claims}`),
  );
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`;
}

type Bytes = Uint8Array<ArrayBuffer>;
async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8),
  );
}

/** aes128gcm payload encryption for one subscription (RFC 8291). */
export async function encryptPayload(
  payload: Bytes,
  subscriber: { p256dh: string; auth: string },
  random: { salt?: Bytes; keyPair?: CryptoKeyPair } = {},
): Promise<Bytes> {
  const uaPublic = fromB64url(subscriber.p256dh);
  const authSecret = fromB64url(subscriber.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length !== 16)
    throw new Error("Invalid subscription keys");
  const local =
    random.keyPair ??
    ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256),
  );
  const ikm = await hkdf(
    authSecret,
    shared,
    concat(utf8("WebPush: info\0"), uaPublic, asPublic),
    32,
  );
  const salt = random.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      concat(payload, new Uint8Array([2])),
    ),
  );
  const recordSize = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Only real browser push services, so this server never posts to arbitrary addresses. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "fcm.googleapis.com" ||
      host === "android.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}

/** Sends one notification. Returns "gone" when the browser has unsubscribed (the row should be deleted). */
export async function sendPush(
  target: PushTarget,
  message: unknown,
  keys: VapidKeys,
  subject: string,
): Promise<"sent" | "gone" | "failed"> {
  if (!isAllowedPushEndpoint(target.endpoint)) return "gone";
  try {
    const body = await encryptPayload(utf8(JSON.stringify(message)), target);
    const response = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuthorization(target.endpoint, keys, subject),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "3600",
        Urgency: "high",
      },
      body,
    });
    if (response.status === 404 || response.status === 410) return "gone";
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
