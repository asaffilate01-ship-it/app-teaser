/** Cloud egress statuses are provider reports, not verified private archive files. */
export const cameraCloudStates = [
  "starting",
  "recording",
  "stopping",
  "provider_completed",
  "failed",
] as const;

export type CameraCloudState = (typeof cameraCloudStates)[number];

export function isCameraCloudState(value: unknown): value is CameraCloudState {
  return cameraCloudStates.some((item) => item === value);
}

export function cameraCloudActive(state: unknown): boolean {
  return state === "starting" || state === "recording" || state === "stopping";
}

export function cameraCloudLabel(state: CameraCloudState): string {
  switch (state) {
    case "starting": return "Provider starting; recording not yet confirmed";
    case "recording": return "Provider reports recording active";
    case "stopping": return "Provider finalising the recording";
    case "provider_completed": return "Provider completed; private archive not yet verified";
    case "failed": return "Cloud recording failed; inspect provider";
  }
}
