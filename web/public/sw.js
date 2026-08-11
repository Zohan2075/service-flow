// ServiceFlow Service Worker — offline-first caching + push-ready
// Bump CACHE version to force update after deploy.

const CACHE = "serviceflow-v11";
const IS_LOCALHOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener("install", () => self.skipWaiting());

// ─── Activate — clean old caches, claim clients immediately ─────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => IS_LOCALHOST || k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch strategy ─────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (IS_LOCALHOST) return;

  const url = new URL(request.url);

  // Google Fonts CSS + font files → cache-first (rarely change)
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Skip all other cross-origin (Google APIs, CDN scripts, etc.)
  if (url.origin !== self.location.origin) return;

  // Immutable hashed static assets → cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else (HTML navigations, other same-origin) → network-first
  event.respondWith(networkFirst(request));
});

// ─── Strategies ─────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 504 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback for navigations: try the root cached page
    if (request.mode === "navigate") {
      const root = await caches.match("/");
      if (root) return root;
    }
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// ─── Push Notifications (ready for Phase 2) ────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
      const payload = event.data.json();
      const data = payload.data || {};
      event.waitUntil(
        self.registration.showNotification(payload.title || "ServiceFlow", {
          body: payload.body || "",
        icon: "/android-chrome-192x192.png",
        badge: "/android-chrome-192x192.png",
        tag: payload.tag || "serviceflow",
          data: { ...data, url: data.url || payload.url || "/interested" },
        requireInteraction: payload.requireInteraction ?? false,
        vibrate: [200, 100, 200],
      })
    );
  } catch {
    // Fallback: plain text notification
    event.waitUntil(
      self.registration.showNotification("ServiceFlow", {
        body: event.data.text(),
        icon: "/android-chrome-192x192.png",
        badge: "/android-chrome-192x192.png",
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/interested";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) return client.navigate(url).then(() => client.focus());
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
