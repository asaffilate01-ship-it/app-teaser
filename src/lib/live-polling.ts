import { createRefreshCoordinator } from "./refresh-coordinator.ts";

/** A single request stream and timer for polling, manual retries and visibility changes. */
export function createLivePolling(options: {
  load: () => Promise<void>;
  interval: () => number;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (timer: number) => void;
}) {
  const coordinator = createRefreshCoordinator(options.load);
  let timer: number | undefined;
  let generation = 0;
  const clear = () => {
    if (timer !== undefined) options.cancel(timer);
    timer = undefined;
  };
  const request = (): Promise<void> => {
    if (!coordinator.isActive()) return Promise.resolve();
    clear();
    const current = ++generation;
    const result = coordinator.request();
    const scheduleNext = () => {
      if (!coordinator.isActive() || current !== generation) return;
      timer = options.schedule(() => void request(), options.interval());
    };
    // Even a rejected fetch must not permanently stop polling.
    return result.then(scheduleNext, scheduleNext);
  };
  return {
    request,
    isActive: coordinator.isActive,
    dispose: () => {
      coordinator.dispose();
      clear();
    },
  };
}
