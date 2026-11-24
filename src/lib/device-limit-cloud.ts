import { getCloudClient } from "@/lib/cloud";
import { deviceLabel, type DeviceStatus } from "@/lib/device-limit";

const KEY = "criclume:device-key";
const claimedKey = (userId: string) => `criclume:device-claimed:${userId}`;

export function thisDeviceKey(): string {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved && saved.length >= 16) return saved;
    const next = crypto.randomUUID();
    window.localStorage.setItem(KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export function hasClaimed(userId: string): boolean {
  try {
    return window.localStorage.getItem(claimedKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function setClaimed(userId: string, claimed: boolean) {
  try {
    if (claimed) window.localStorage.setItem(claimedKey(userId), "1");
    else window.localStorage.removeItem(claimedKey(userId));
  } catch {
    /* Storage is optional. */
  }
}

export async function claimThisDevice(): Promise<number> {
  const { data, error } = await getCloudClient().rpc("claim_login_device", {
    p_device_key: thisDeviceKey(),
    p_label: deviceLabel(navigator.userAgent),
  });
  if (error) throw error;
  return Number((data as { signedOut?: number } | null)?.signedOut ?? 0);
}

export async function checkThisDevice(): Promise<DeviceStatus> {
  const { data, error } = await getCloudClient().rpc("check_login_device", {
    p_device_key: thisDeviceKey(),
  });
  if (error) throw error;
  return data === "active" || data === "revoked" ? data : "unknown";
}

export type LoginDevice = {
  id: string;
  label: string;
  signedInAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  thisDevice: boolean;
};

export async function listMyDevices(): Promise<LoginDevice[]> {
  const mine = thisDeviceKey();
  const { data, error } = await getCloudClient()
    .from("login_devices")
    .select("id,label,device_key,signed_in_at,last_seen_at,revoked_at")
    .order("signed_in_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    signedInAt: row.signed_in_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    thisDevice: row.device_key === mine,
  }));
}

export async function signOutDevice(id: string): Promise<void> {
  const { error } = await getCloudClient().rpc("sign_out_login_device", { p_device_id: id });
  if (error) throw error;
}
