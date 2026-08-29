/**
 * Con Edison Floor 07 MusterCommand Service Worker
 * Provides offline shell caching, asset pre-fetching, and background life-safety push handling.
 */

const CACHE_NAME = "mustercommand-v1";
const OFFLINE_URL = "/";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg"
];

// Install Event — Pre-cache App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — Clean up stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Network first with cache fallback for HTML/assets, bypass for /api & SSE
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Bypass service worker cache for live backend API and SSE text/event-stream
  if (url.pathname.startsWith("/api/") || event.request.headers.get("accept")?.includes("text/event-stream")) {
    return;
  }

  // Navigation requests: Network first, fallback to cached offline app shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL) || caches.match("/index.html");
      })
    );
    return;
  }

  // Static Assets: Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached and update in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Offline asset fallback
        return caches.match(event.request);
      });
    })
  );
});

// Push Notification Event for Life-Safety Alerts
self.addEventListener("push", (event) => {
  let data = { title: "EMERGENCY LIFE-SAFETY ALERT", body: "Floor 07 Evacuation in progress. Proceed to designated assembly point." };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    vibrate: [200, 100, 200, 100, 200],
    data: { url: "/?mode=signin" },
    tag: "life-safety-alert",
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click — Focus or open app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/?mode=signin");
      }
    })
  );
});
