/**
 * One local recording session owns at most one segment. Stopping capture
 * leaves the segment leased until its final callback drains the last chunks.
 * A delayed or repeated callback cannot restart or finish a different session.
 */
export function createRecordingLifecycle<T>() {
  let generation = 0;
  let requested = false;
  let current: { generation: number; recorder: T } | null = null;

  const owns = (session: number, recorder: T) =>
    current?.generation === session && current.recorder === recorder;

  return {
    begin(): number | null {
      if (requested || current) return null;
      requested = true;
      return ++generation;
    },
    attach(session: number, recorder: T): boolean {
      if (!requested || session !== generation || current) return false;
      current = { generation: session, recorder };
      return true;
    },
    owns,
    stop(): T | null {
      requested = false;
      return current?.recorder ?? null;
    },
    finish(session: number, recorder: T) {
      if (!owns(session, recorder)) return { accepted: false, continueRecording: false };
      current = null;
      return { accepted: true, continueRecording: requested && session === generation };
    },
    running: () => requested,
    finalizing: () => !requested && current !== null,
  };
}
