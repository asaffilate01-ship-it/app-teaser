import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadOrganisationDashboard,
  subscribeToOrganisationOperations,
  type PlatformDashboardData,
} from "@/lib/platform-cloud";
import type { PlatformRole } from "@/lib/platform";
import { createRefreshCoordinator } from "@/lib/refresh-coordinator";

type RefreshScope = {
  organisationId: string;
  role: PlatformRole;
  coordinator: ReturnType<typeof createRefreshCoordinator>;
};

export function usePlatformDashboard(organisationId: string | null, role: PlatformRole | null) {
  const [snapshot, setSnapshot] = useState<{
    data: PlatformDashboardData;
    role: PlatformRole;
    lastUpdated: number;
  } | null>(null);
  const [loading, setLoading] = useState(Boolean(organisationId && role));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scopeRef = useRef<RefreshScope | null>(null);

  useEffect(() => {
    setSnapshot(null);
    setError(null);
    setRefreshing(false);
    setLoading(Boolean(organisationId && role));
    if (!organisationId || !role) return;

    const coordinator = createRefreshCoordinator(async () => {
      if (!coordinator.isActive()) return;
      setRefreshing(true);
      setError(null);
      try {
        const next = await loadOrganisationDashboard(organisationId, role);
        if (coordinator.isActive()) {
          if (next.organisationId !== organisationId) {
            throw new Error("The workspace response did not match the selected organisation.");
          }
          setSnapshot({ data: next, role, lastUpdated: Date.now() });
        }
      } catch (reason) {
        if (coordinator.isActive()) {
          setError(reason instanceof Error ? reason.message : "Could not load the control centre.");
        }
      } finally {
        if (coordinator.isActive()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    });

    const scope = { organisationId, role, coordinator };
    scopeRef.current = scope;
    const refresh = () => void coordinator.request();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const unsubscribe = subscribeToOrganisationOperations(organisationId, refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      coordinator.dispose();
      if (scopeRef.current === scope) scopeRef.current = null;
      unsubscribe();
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [organisationId, role]);

  const refresh = useCallback(async () => {
    const scope = scopeRef.current;
    if (scope?.organisationId !== organisationId || scope.role !== role) return;
    await scope.coordinator.request();
  }, [organisationId, role]);

  const run = useCallback(
    async <T>(action: () => Promise<T>): Promise<T> => {
      const scope = scopeRef.current;
      if (
        scope?.organisationId !== organisationId ||
        scope.role !== role ||
        !scope.coordinator.isActive()
      ) {
        throw new Error("The selected workspace is no longer active.");
      }
      setError(null);
      try {
        const result = await action();
        await scope.coordinator.request();
        return result;
      } catch (reason) {
        if (scope.coordinator.isActive()) {
          setError(reason instanceof Error ? reason.message : "The operation failed.");
        }
        throw reason;
      }
    },
    [organisationId, role],
  );

  const current =
    snapshot?.data.organisationId === organisationId && snapshot.role === role ? snapshot : null;
  return {
    data: current?.data ?? null,
    loading,
    refreshing,
    error,
    setError,
    refresh,
    run,
    lastUpdated: current?.lastUpdated ?? null,
  };
}
