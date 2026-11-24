/**
 * Serialise refresh work and collapse bursts into a single pending follow-up.
 * A disposed scope must never start another request. The caller is responsible
 * for ignoring results from a request that was already in flight at disposal.
 */
export function createRefreshCoordinator(load: () => Promise<void>) {
  let active = true;
  let pending = false;
  let inFlight: Promise<void> | null = null;

  const request = (): Promise<void> => {
    if (!active) return Promise.resolve();
    pending = true;
    if (inFlight) return inFlight;
    inFlight = Promise.resolve().then(async () => {
      try {
        while (active && pending) {
          pending = false;
          await load();
        }
      } finally {
        inFlight = null;
      }
    });
    return inFlight;
  };

  return {
    request,
    isActive: () => active,
    dispose: () => {
      active = false;
      pending = false;
    },
  };
}
