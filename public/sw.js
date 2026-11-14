const CACHE_NAME = "cgcc-cafeteria-v3";
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-512x512.png",
  "/apple-touch-icon.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function offlineFallbackResponse() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offline · CGCC Cafeteria Express</title>
  <style>
    body{font:15px/1.5 system-ui,-apple-system,sans-serif;background:#faf7f2;color:#1c1917;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem}
    .card{max-width:24rem;width:100%;text-align:center;background:#fff;border:1px solid #e7e5e4;border-radius:1rem;padding:1.75rem;box-shadow:0 4px 20px rgba(0,0,0,.06)}
    h1{font-size:1.25rem;margin:0 0 .5rem}
    p{color:#57534e;margin:0 0 1.25rem}
    button{background:#1c1917;color:#fff;border:0;border-radius:9999px;padding:.625rem 1.25rem;font:inherit;font-weight:600;cursor:pointer}
  </style>
</head>
<body>
  <div class="card">
    <h1>You are offline</h1>
    <p>Check your internet connection and tap below to reload CGCC Cafeteria Express.</p>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API, server functions, SW, admin, vendor, or Vite JS/CSS chunks.
  // Caching HTML or hashed JS chunks across deploys causes ChunkLoadError in installed PWAs.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_server") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/vendor") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/@") ||
    url.pathname === "/sw.js" ||
    /\.(?:css|js|mjs)$/i.test(url.pathname)
  ) {
    return;
  }

  // Always fetch fresh HTML on navigation so installed PWAs never load stale chunk references.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => offlineFallbackResponse()),
    );
    return;
  }

  // Cache-first only for static media/fonts/icons/webmanifest.
  const isMediaAsset = /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?|webmanifest)$/i.test(
    url.pathname,
  );

  if (isMediaAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
  }
});
