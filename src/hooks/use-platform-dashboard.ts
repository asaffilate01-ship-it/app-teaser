import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadOrganisationDashboard,
  subscribeToOrganisationOperations,
  type PlatformDashboardData,
} from "@/lib/platform-cloud";
import type { PlatformRole } from "@/lib/platform";

export function usePlatformDashboard(organisationId: string | null, role: PlatformRole | null) {
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(Boolean(organisationId && role));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!organisationId || !role) {
      setData(null);
      setLoading(false);
      return;
    }
    const request = ++requestRef.current;
    setRefreshing(true);
    setError(null);
    try {
      const next = await loadOrganisationDashboard(organisationId, role);
      if (request === requestRef.current) setData(next);
    } catch (reason) {
      if (request === requestRef.current)
        setError(reason instanceof Error ? reason.message : "Could not load the control centre.");
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [organisationId, role]);

  useEffect(() => {
    setData(null);
    setLoading(Boolean(organisationId && role));
    void refresh();
    if (!organisationId || !role) return;
    return subscribeToOrganisationOperations(organisationId, () => void refresh());
  }, [organisationId, refresh, role]);

  const run = useCallback(
    async <T>(action: () => Promise<T>): Promise<T> => {
      setError(null);
      try {
        const result = await action();
        await refresh();
        return result;
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "The operation failed.";
        setError(message);
        throw reason;
      }
    },
    [refresh],
  );

  return { data, loading, refreshing, error, setError, refresh, run };
}
