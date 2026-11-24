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
    case "starting":
      return "Provider starting; recording not yet confirmed";
    case "recording":
      return "Provider reports recording active";
    case "stopping":
      return "Provider finalising the recording";
    case "provider_completed":
      return "Provider completed; private archive not yet verified";
    case "failed":
      return "Cloud recording failed; inspect provider";
  }
}

/** Starting a chargeable recording requires a known, current device status.
 * Stopping must remain possible when status is unavailable; the server locates
 * and authorises the active recording independently.
 */
export function cameraCloudControls(input: {
  armed: boolean;
  verified: boolean;
  state: unknown;
  busy: boolean;
}) {
  const known = input.state === null || isCameraCloudState(input.state);
  const verified = input.verified && known;
  return {
    canStart: !input.busy && input.armed && verified && !cameraCloudActive(input.state),
    canStop:
      !input.busy &&
      (!verified || (cameraCloudActive(input.state) && input.state !== "stopping")),
  };
}
