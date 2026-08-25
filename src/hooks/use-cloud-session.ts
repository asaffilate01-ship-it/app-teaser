import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  currentCloudSession,
  getCloudClient,
  isCloudConfigured,
  requestSignInLink,
  signOutCloud,
} from "@/lib/cloud";

export function useCloudSession() {
  const configured = isCloudConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    void currentCloudSession()
      .then((next) => {
        if (active) setSession(next);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load session.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const { data } = getCloudClient().auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [configured]);

  const requestLink = useCallback(async (email: string, redirectTo?: string) => {
    setError(null);
    await requestSignInLink(email, redirectTo ?? `${window.location.origin}/platform`);
  }, []);

  const signOut = useCallback(async () => {
    await signOutCloud();
    setSession(null);
  }, []);

  return { configured, session, loading, error, requestLink, signOut };
}
