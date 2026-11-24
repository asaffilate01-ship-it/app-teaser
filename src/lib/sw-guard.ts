/** Whether this page may use the app's service worker (offline page + match alerts).
 *  Never in development, inside the editor preview frame, or on preview hosts. */
export function serviceWorkerAllowed(input: {
  prod: boolean;
  hostname: string;
  inIframe: boolean;
  search: string;
}): boolean {
  if (!input.prod || input.inIframe) return false;
  if (new URLSearchParams(input.search).get("sw") === "off") return false;
  const host = input.hostname.toLowerCase();
  const label = host.split(".")[0] ?? "";
  const previewSuffix = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"].some((suffix) =>
    host.endsWith(suffix),
  );
  if (
    previewSuffix &&
    (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label) || /^project--.+-dev$/.test(label))
  )
    return false;
  for (const domain of ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"]) {
    if (host === domain || host.endsWith(`.${domain}`)) return false;
  }
  return true;
}

export function browserServiceWorkerAllowed(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  let inIframe = true;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  return serviceWorkerAllowed({
    prod: import.meta.env.PROD,
    hostname: window.location.hostname,
    inIframe,
    search: window.location.search,
  });
}
