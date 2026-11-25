import { ballSpeed, reviewableBallSpeed } from "./ball-speed.ts";

export type VideoSpeedEvidence = {
  version: 1;
  metric: "video_segment_average";
  method: "manual" | "reviewed_motion";
  firstSeconds: number;
  secondSeconds: number;
  distanceMetres: number;
  distanceErrorMetres: number;
  mediaFps: number;
  timeScale: number;
  kph: number;
  lowKph: number;
  highKph: number;
};

export type VideoSpeedInput = Omit<
  VideoSpeedEvidence,
  "version" | "metric" | "kph" | "lowKph" | "highKph"
>;

/** Reviewed numeric evidence only: no media URLs, file names or player identifiers. */
export function createVideoSpeedEvidence(input: VideoSpeedInput): VideoSpeedEvidence | null {
  if (
    (input.method !== "manual" && input.method !== "reviewed_motion") ||
    input.distanceMetres < 1 ||
    input.distanceMetres > 25 ||
    input.mediaFps < 1 ||
    input.mediaFps > 240 ||
    input.firstSeconds > 86400 ||
    input.secondSeconds > 86400
  )
    return null;
  const reading = ballSpeed(
    input.firstSeconds,
    input.secondSeconds,
    input.distanceMetres,
    input.mediaFps,
    input.timeScale,
    input.distanceErrorMetres,
  );
  if (!reading || !reviewableBallSpeed(reading)) return null;
  return {
    version: 1,
    metric: "video_segment_average",
    method: input.method,
    firstSeconds: input.firstSeconds,
    secondSeconds: input.secondSeconds,
    distanceMetres: input.distanceMetres,
    distanceErrorMetres: input.distanceErrorMetres,
    mediaFps: input.mediaFps,
    timeScale: input.timeScale,
    kph: reading.kph,
    lowKph: reading.lowKph,
    highKph: reading.highKph,
  };
}

/** Recalculate all derived fields instead of trusting a claimed speed or uncertainty. */
export function validateVideoSpeedEvidence(value: unknown): VideoSpeedEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<Record<keyof VideoSpeedEvidence, unknown>>;
  if (
    item.version !== 1 ||
    item.metric !== "video_segment_average" ||
    (item.method !== "manual" && item.method !== "reviewed_motion")
  )
    return null;
  const numeric = [
    item.firstSeconds,
    item.secondSeconds,
    item.distanceMetres,
    item.distanceErrorMetres,
    item.mediaFps,
    item.timeScale,
    item.kph,
    item.lowKph,
    item.highKph,
  ];
  if (!numeric.every((number) => typeof number === "number" && Number.isFinite(number)))
    return null;
  const evidence = createVideoSpeedEvidence({
    method: item.method,
    firstSeconds: item.firstSeconds as number,
    secondSeconds: item.secondSeconds as number,
    distanceMetres: item.distanceMetres as number,
    distanceErrorMetres: item.distanceErrorMetres as number,
    mediaFps: item.mediaFps as number,
    timeScale: item.timeScale as number,
  });
  if (
    !evidence ||
    evidence.kph !== item.kph ||
    evidence.lowKph !== item.lowKph ||
    evidence.highKph !== item.highKph
  )
    return null;
  return evidence;
}
