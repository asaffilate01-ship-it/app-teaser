/** Descriptive comparison of paired readings, never a radar certification or speed correction. */
export type SpeedReference = "same_segment" | "radar_release";
export type SpeedPair = { trial: number; videoKph: number; referenceKph: number };
export const maximumSpeedPairs = 200;
export const preliminarySpeedSampleSize = 20;

export function parseComparisonSpeed(value: string): number | null {
  const raw = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const speed = Number(raw);
  return Number.isFinite(speed) && speed > 0 && speed <= 200 ? speed : null;
}

export function compareSpeedPairs(pairs: readonly SpeedPair[], toleranceKph: number) {
  if (!Number.isFinite(toleranceKph) || toleranceKph <= 0 || toleranceKph > 30) return null;
  if (!pairs.length || pairs.length > maximumSpeedPairs) return null;
  const trials = new Set<number>();
  let signed = 0;
  let absolute = 0;
  let squared = 0;
  let maximum = 0;
  let within = 0;
  for (const pair of pairs) {
    if (
      !Number.isSafeInteger(pair.trial) ||
      pair.trial < 1 ||
      trials.has(pair.trial) ||
      ![pair.videoKph, pair.referenceKph].every(
        (speed) => Number.isFinite(speed) && speed > 0 && speed <= 200,
      )
    ) {
      return null;
    }
    trials.add(pair.trial);
    const difference = pair.videoKph - pair.referenceKph;
    const magnitude = Math.abs(difference);
    signed += difference;
    absolute += magnitude;
    squared += difference * difference;
    maximum = Math.max(maximum, magnitude);
    if (magnitude <= toleranceKph + 1e-9) within += 1;
  }
  const count = pairs.length;
  return {
    count,
    meanDifference: signed / count,
    meanAbsoluteDifference: absolute / count,
    rootMeanSquareDifference: Math.sqrt(squared / count),
    maximumAbsoluteDifference: maximum,
    withinTolerance: within,
    withinTolerancePercent: (within / count) * 100,
    preliminarySampleSizeReached: count >= preliminarySpeedSampleSize,
  };
}

export function speedComparisonCsv(
  pairs: readonly SpeedPair[],
  reference: SpeedReference,
  toleranceKph: number,
): string | null {
  if (reference !== "same_segment" && reference !== "radar_release") return null;
  if (!compareSpeedPairs(pairs, toleranceKph)) return null;
  const header =
    "trial,video_kph,reference_kph,video_minus_reference_kph,reference_metric,tolerance_kph";
  return (
    [
      header,
      ...pairs.map((pair) =>
        [
          pair.trial,
          pair.videoKph.toFixed(2),
          pair.referenceKph.toFixed(2),
          (pair.videoKph - pair.referenceKph).toFixed(2),
          reference,
          toleranceKph,
        ].join(","),
      ),
    ].join("\r\n") + "\r\n"
  );
}
