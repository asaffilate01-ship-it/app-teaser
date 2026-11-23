// Extra code loaded into the generated offline worker (sw.js) with importScripts.

// A new version starts with a clean scorer page cache, so an old saved page can never point at
// files from an older version. Also removes the cache of the previous hand-written worker.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("criclume-scorer-") || key.startsWith("criclume-static-")).map((key) => caches.delete(key))),
    ),
  );
});

// Match alerts for fans who turned them on from a public scoreboard. Text is name-free.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "CricLume", body: event.data ? event.data.text() : "" };
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(String(data.title || "CricLume match update").slice(0, 120), {
      body: String(data.body || "").slice(0, 200),
      icon: "/icon-192.png",
      badge: "/icon-maskable-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url === url);
      if (open) return open.focus();
      return self.clients.openWindow(url);
    }),
  );
});
