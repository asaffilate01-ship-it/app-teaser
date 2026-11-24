import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getCloudClient } from "@/lib/cloud";
import { shouldSignOut } from "@/lib/device-limit";
import { checkThisDevice, claimThisDevice, hasClaimed, setClaimed } from "@/lib/device-limit-cloud";

const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Keeps a login to two devices. A fresh sign-in claims this device (the server signs out the oldest extra one);
 * afterwards the device checks in on open, on return to the screen and every few minutes.
 * Only a clear "signed out" answer from the server signs this device out — never a failed or offline check.
 */
export function useDeviceLimit(session: Session | null) {
  const [signedOutHere, setSignedOutHere] = useState(false);
  const [pushedOut, setPushedOut] = useState(0);
  const busy = useRef(false);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    setSignedOutHere(false);
    let stopped = false;
    const run = async () => {
      if (
        busy.current ||
        stopped ||
        (typeof navigator !== "undefined" && navigator.onLine === false)
      )
        return;
      busy.current = true;
      try {
        if (!hasClaimed(userId)) {
          const count = await claimThisDevice();
          setClaimed(userId, true);
          if (count > 0 && !stopped) setPushedOut(count);
          return;
        }
        const status = await checkThisDevice();
        if (status === "unknown") {
          await claimThisDevice();
          return;
        }
        if (shouldSignOut(status) && !stopped) {
          setClaimed(userId, false);
          setSignedOutHere(true);
          await getCloudClient().auth.signOut({ scope: "local" });
        }
      } catch {
        /* Offline or a hiccup: try again later, never sign out on an error. */
      } finally {
        busy.current = false;
      }
    };
    void run();
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onOnline = () => void run();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void run(), CHECK_EVERY_MS);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [userId]);

  return {
    signedOutHere,
    pushedOut,
    dismissPushedOut: () => setPushedOut(0),
    dismissSignedOut: () => setSignedOutHere(false),
  };
}
