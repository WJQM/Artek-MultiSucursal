// Service Worker mínimo para PWA - cacheo simple de offline
const CACHE_VERSION = "repairtrack-v5";
const STATIC_CACHE = [
  "/",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_CACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Solo GET y misma origen
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // No cachear APIs
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cachear solo html y estáticos
        if (res.ok && (req.destination === "document" || req.destination === "style" || req.destination === "script" || req.destination === "image")) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy).catch(() => {}));
        }
        return res;
      })
      // Sin conexión: se usa la copia guardada. La portada solo reemplaza a una PÁGINA; nunca a un estilo,
      // script o fuente (si no, el sistema se ve sin diseño cuando el servidor se está reiniciando)
      .catch(() => caches.match(req).then((r) => r || (req.mode === "navigate" ? caches.match("/") : undefined) || Response.error()))
  );
});

// ===== Avisos en el celular (Web Push) =====
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "RepairTrackQR", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "RepairTrackQR";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/api/brand/icon?size=192",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/" },
    })
  );
});

// Al tocar el aviso: si el sistema ya está abierto, se usa esa ventana; si no, se abre
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.focus().then(() => ("navigate" in w ? w.navigate(url) : null));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
