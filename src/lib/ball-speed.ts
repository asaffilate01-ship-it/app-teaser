/**
 * Ball speed from a video clip: the coach marks the frame the ball leaves the hand and the frame it
 * reaches the batter (or stumps). Speed = distance / time. One frame of error at each mark is
 * reported as a range so nobody reads more accuracy into it than the camera allows.
 */

/** Distances along a 22-yard (20.12 m) pitch from the bowler's release, which is roughly at the popping crease. */
export const speedDistances = {
  stumps: { metres: 18.9, label: "Release to the batter's stumps (18.9 m)" },
  batter: { metres: 17.68, label: "Release to the batter's crease (17.7 m)" },
  bounce: { metres: 14.5, label: "Release to a good-length bounce (about 14.5 m)" },
} as const;
export type SpeedDistance = keyof typeof speedDistances;

export interface SpeedReading {
  kph: number;
  mph: number;
  /** Slowest and fastest speeds if each mark is one frame out. */
  lowKph: number;
  highKph: number;
  seconds: number;
  /** Plain warning when the number looks wrong (marks swapped, too far apart, impossible speed). */
  warning: string | null;
}

const KPH_PER_MPS = 3.6;
const MPH_PER_KPH = 0.621371;
const round1 = (value: number) => Math.round(value * 10) / 10;

/** timeScale is real elapsed seconds per media second (1 for real-time footage).
 * An exported 240 fps capture slowed to 30 fps has a timeScale of 0.125.
 * Distance uncertainty is an operator-supplied bound, not a statistical confidence interval.
 */
export function ballSpeed(
  releaseSeconds: number,
  arrivalSeconds: number,
  metres: number,
  fps: number,
  timeScale = 1,
  distanceError = 0,
): SpeedReading | null {
  if (
    ![releaseSeconds, arrivalSeconds, metres, fps, timeScale, distanceError].every(
      Number.isFinite,
    ) ||
    releaseSeconds < 0 ||
    arrivalSeconds <= releaseSeconds ||
    metres <= 0 ||
    fps <= 0 ||
    timeScale <= 0 ||
    timeScale > 1 ||
    distanceError < 0 ||
    distanceError >= metres
  )
    return null;
  const seconds = (arrivalSeconds - releaseSeconds) * timeScale;
  const frame = timeScale / fps;
  const kph = (metres / seconds) * KPH_PER_MPS;
  const lowKph = ((metres - distanceError) / (seconds + 2 * frame)) * KPH_PER_MPS;
  const highKph =
    seconds > 2 * frame
      ? ((metres + distanceError) / (seconds - 2 * frame)) * KPH_PER_MPS
      : Infinity;
  if (!Number.isFinite(kph) || !Number.isFinite(lowKph)) return null;
  let warning: string | null = null;
  if (kph > 170 || kph < 25) warning = "Unusual cricket delivery speed. Check distance and timing.";
  else if (!Number.isFinite(highKph) || (highKph - lowKph) / kph > 0.25)
    warning = "Timing or distance uncertainty is high. Use clearer, higher-frame-rate footage.";
  return {
    kph: round1(kph),
    mph: round1(kph * MPH_PER_KPH),
    lowKph: round1(lowKph),
    highKph: Number.isFinite(highKph) ? round1(highKph) : Infinity,
    seconds: Math.round(seconds * 1000) / 1000,
    warning,
  };
}

export function reviewableBallSpeed(reading: SpeedReading | null): boolean {
  return Boolean(
    reading &&
    !reading.warning &&
    Number.isFinite(reading.kph) &&
    Number.isFinite(reading.highKph) &&
    reading.kph >= 25 &&
    reading.kph <= 170,
  );
}

/** Frame rate from frame timestamps seen while the clip plays (median gap), rounded to common camera rates. */
export function detectFps(frameTimes: readonly number[]): number | null {
  const gaps: number[] = [];
  for (let i = 1; i < frameTimes.length; i += 1) {
    const gap = frameTimes[i]! - frameTimes[i - 1]!;
    if (gap > 0.0005 && gap < 0.2) gaps.push(gap);
  }
  if (gaps.length < 5) return null;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  const raw = 1 / median;
  const common = [24, 25, 30, 50, 60, 100, 120, 240];
  return common.reduce(
    (best, rate) => (Math.abs(rate - raw) < Math.abs(best - raw) ? rate : best),
    common[0]!,
  );
}

/** Fastest and average measured speed per bowler, from balls that carry a speed. */
export function speedsByBowler(
  deliveries: readonly { bowlerId: string; speedKph?: number | undefined }[],
) {
  const map = new Map<string, number[]>();
  for (const ball of deliveries) {
    if (ball.speedKph == null || !Number.isFinite(ball.speedKph) || ball.speedKph <= 0) continue;
    const readings = map.get(ball.bowlerId);
    if (readings) readings.push(ball.speedKph);
    else map.set(ball.bowlerId, [ball.speedKph]);
  }
  return [...map.entries()]
    .map(([bowlerId, speeds]) => ({
      bowlerId,
      balls: speeds.length,
      fastest: Math.max(...speeds),
      average: round1(speeds.reduce((sum, value) => sum + value, 0) / speeds.length),
    }))
    .sort((a, b) => b.fastest - a.fastest);
}

// ---------------------------------------------------------------------------
// Automatic tracking (runs on the phone, no upload, no cost).
// The coach marks once per fixed camera where the bowler's crease (A) and the batter's end (B) are.
// For each clip we look for a small moving blob in a band along A→B, follow it frame by frame and
// fit a straight line to its progress; the fit gives release and arrival times between frames.
// Best from a side-on camera; behind-the-bowler views bend the distances and read high or low.
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface BallCandidate {
  /** Progress along A→B: 0 at A, 1 at B. */
  t: number;
  /** Moving pixels in the blob. */
  size: number;
}

export interface CandidateOptions {
  /** Brightness change (0–255) that counts as movement. */
  threshold?: number;
  /** Half-width of the band around A→B, as a share of its length. */
  band?: number;
  /** Largest blob (pixels) that can still be the ball; the bowler and batter are bigger. */
  maxSize?: number;
  minSize?: number;
}

/**
 * Small moving blobs near the line A→B in the middle frame of three (greyscale, one byte per pixel).
 * Pixels must change against both neighbours, which removes most of the background and slow movement.
 */
export function ballCandidates(
  prev: ArrayLike<number>,
  cur: ArrayLike<number>,
  next: ArrayLike<number>,
  width: number,
  height: number,
  a: Point,
  b: Point,
  options: CandidateOptions = {},
): BallCandidate[] {
  const threshold = options.threshold ?? 28;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 4) return [];
  const band = (options.band ?? 0.16) * length;
  const maxSize = options.maxSize ?? Math.max(6, Math.round((length * 0.05) ** 2));
  const minSize = options.minSize ?? 1;
  const bins = new Map<number, { count: number; sumT: number }>();
  const binWidth = 0.02;
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x) - band - 0.15 * Math.abs(dx)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x) + band + 0.15 * Math.abs(dx)));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y) - band - 0.15 * Math.abs(dy)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y) + band + 0.15 * Math.abs(dy)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const i = y * width + x;
      const c = cur[i]!;
      if (Math.abs(c - prev[i]!) < threshold || Math.abs(next[i]! - c) < threshold) continue;
      const t = ((x - a.x) * dx + (y - a.y) * dy) / (length * length);
      if (t < -0.15 || t > 1.15) continue;
      const off = Math.abs((x - a.x) * dy - (y - a.y) * dx) / length;
      if (off > band) continue;
      const key = Math.floor(t / binWidth);
      const bin = bins.get(key) ?? { count: 0, sumT: 0 };
      bin.count += 1;
      bin.sumT += t;
      bins.set(key, bin);
    }
  }
  // Join neighbouring bins into blobs.
  const keys = [...bins.keys()].sort((p, q) => p - q);
  const out: BallCandidate[] = [];
  let group: number[] = [];
  const flush = () => {
    if (!group.length) return;
    let count = 0;
    let sumT = 0;
    for (const key of group) {
      count += bins.get(key)!.count;
      sumT += bins.get(key)!.sumT;
    }
    const spread = group.length * binWidth;
    if (count >= minSize && count <= maxSize && spread <= 0.12)
      out.push({ t: sumT / count, size: count });
    group = [];
  };
  for (const key of keys) {
    if (group.length && key - group.at(-1)! > 1) flush();
    group.push(key);
  }
  flush();
  return out;
}

export interface TrackPoint {
  time: number;
  t: number;
}

export interface BallTrack {
  releaseTime: number;
  arrivalTime: number;
  /** Progress per second along A→B (1 = the whole distance in one second). */
  rate: number;
  points: TrackPoint[];
  /** How well a straight line fits (1 = perfect). */
  fit: number;
}

/**
 * The ball's path: the longest run of candidates that moves steadily from A towards B at a speed a
 * bowled ball can travel, then a straight-line fit of progress against time.
 */
export function fitBallTrack(candidates: readonly TrackPoint[], metres = 18.9): BallTrack | null {
  // 40–170 km/h over the A→B distance, as progress per second.
  const minRate = 40 / 3.6 / metres;
  const maxRate = 170 / 3.6 / metres;
  if (!Number.isFinite(metres) || metres <= 0) return null;
  const sorted = candidates
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.t) && p.t >= -0.15 && p.t <= 1.15)
    .sort((p, q) => p.time - q.time || p.t - q.t);
  const n = sorted.length;
  if (n < 4) return null;
  const best = new Array<number>(n).fill(1);
  const from = new Array<number>(n).fill(-1);
  for (let j = 0; j < n; j += 1) {
    for (let i = j - 1; i >= 0; i -= 1) {
      const gap = sorted[j]!.time - sorted[i]!.time;
      if (gap > 0.25) break;
      if (gap <= 0) continue;
      const rate = (sorted[j]!.t - sorted[i]!.t) / gap;
      if (rate < minRate * 0.6 || rate > maxRate * 1.4) continue;
      if (best[i]! + 1 > best[j]! || (best[i]! + 1 === best[j]! && i < from[j]!)) {
        best[j] = best[i]! + 1;
        from[j] = i;
      }
    }
  }
  let end = 0;
  for (let i = 1; i < n; i += 1) if (best[i]! > best[end]!) end = i;
  let chain: TrackPoint[] = [];
  for (let i = end; i >= 0; i = from[i]!) chain.unshift(sorted[i]!);
  // Drop points that sit off the straight line (a hand or shadow picked up at the start or end).
  for (let guard = 0; guard < 6 && chain.length > 4; guard += 1) {
    const line = lineFit(chain);
    if (!line) break;
    let worst = -1;
    let worstOff = 0.02;
    chain.forEach((p, index) => {
      const off = Math.abs(p.t - (line.intercept + line.rate * p.time));
      if (off > worstOff) {
        worst = index;
        worstOff = off;
      }
    });
    if (worst < 0) break;
    chain = chain.filter((_, index) => index !== worst);
  }
  if (chain.length < 4) return null;
  const span = chain.at(-1)!.t - chain[0]!.t;
  if (span < 0.35) return null;
  const meanTime = chain.reduce((sum, p) => sum + p.time, 0) / chain.length;
  const meanT = chain.reduce((sum, p) => sum + p.t, 0) / chain.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of chain) {
    sxy += (p.time - meanTime) * (p.t - meanT);
    sxx += (p.time - meanTime) ** 2;
    syy += (p.t - meanT) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  const rate = sxy / sxx;
  if (rate < minRate || rate > maxRate) return null;
  const intercept = meanT - rate * meanTime;
  return {
    releaseTime: (0 - intercept) / rate,
    arrivalTime: (1 - intercept) / rate,
    rate,
    points: chain,
    fit: (sxy * sxy) / (sxx * syy),
  };
}

function lineFit(points: readonly TrackPoint[]): { rate: number; intercept: number } | null {
  const meanTime = points.reduce((sum, p) => sum + p.time, 0) / points.length;
  const meanT = points.reduce((sum, p) => sum + p.t, 0) / points.length;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += (p.time - meanTime) * (p.t - meanT);
    sxx += (p.time - meanTime) ** 2;
  }
  if (sxx === 0) return null;
  const rate = sxy / sxx;
  return { rate, intercept: meanT - rate * meanTime };
}

/** Request faster local capture without claiming the browser or encoder achieved it. */
export const cameraCaptureRates = [30, 60, 120] as const;
export type CameraCaptureRate = (typeof cameraCaptureRates)[number];

export function speedCaptureProfile(rate: CameraCaptureRate) {
  return {
    facingMode: "environment",
    width: { ideal: rate === 30 ? 1920 : 1280 },
    height: { ideal: rate === 30 ? 1080 : 720 },
    frameRate: { ideal: rate },
  };
}

export function reportedCaptureRate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? round1(value) : null;
}
