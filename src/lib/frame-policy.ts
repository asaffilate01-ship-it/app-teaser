/**
 * Only the read-only score widget (/embed/...) may be shown inside other websites.
 * Every other page refuses to be framed, so sign-in, scoring and club pages can't be click-jacked.
 */
export function isEmbeddablePath(pathname: string): boolean {
  return /^\/embed\/[a-z0-9-]{1,120}\/?$/i.test(pathname);
}

export function frameHeaders(pathname: string): {
  frameAncestors: string;
  xFrameOptions: string | null;
  resourcePolicy: string;
} {
  return isEmbeddablePath(pathname)
    ? { frameAncestors: "frame-ancestors *", xFrameOptions: null, resourcePolicy: "cross-origin" }
    : {
        frameAncestors: "frame-ancestors 'none'",
        xFrameOptions: "DENY",
        resourcePolicy: "same-origin",
      };
}
