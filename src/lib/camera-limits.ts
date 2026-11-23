/** Most phones (or club cameras) one match camera room can hold. The database enforces the same limit. */
export const MAX_CAMERA_PHONES = 16;
/** Phones a new camera room allows until a director raises it. */
export const DEFAULT_CAMERA_PHONES = 4;

/** Every phone-limit choice a director can pick, 1 to MAX_CAMERA_PHONES. */
export function cameraLimitChoices(): number[] {
  return Array.from({ length: MAX_CAMERA_PHONES }, (_, index) => index + 1);
}

/** Grid columns for the director's "Grid" view so up to 16 angles stay visible without endless scrolling. */
export function directorGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
}
