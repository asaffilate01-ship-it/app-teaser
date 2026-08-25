interface MonitoringEvent {
  level: "info" | "warning" | "error";
  name: string;
  message: string;
  context?: Record<string, unknown>;
}

function endpoint(): string | null {
  return import.meta.env["VITE_MONITORING_ENDPOINT"]?.trim() || null;
}

export function reportMonitoringEvent(event: MonitoringEvent): void {
  const url = endpoint();
  if (!url || typeof window === "undefined") return;
  const body = JSON.stringify({
    ...event,
    release: import.meta.env["VITE_RELEASE_SHA"] ?? "development",
    route: window.location.pathname,
    occurredAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  });
}
