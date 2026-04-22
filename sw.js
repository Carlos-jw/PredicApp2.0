/**
 * sw.js — Service Worker de PredicApp.
 * Estrategia: Cache First para assets estáticos, Network First para HTML.
 * Versión: v16 — debe coincidir con data-build en index.html.
 */

const CACHE_NAME   = 'predicapp-v16';
const CACHE_STATIC = 'predicapp-static-v16';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/firebase-config.js',
  '/app.js',
  '/auth.js',
  '/config.js',
  '/data-sync.js',
  '/db.js',
  '/dom-helpers.js',
  '/enroll-form.js',
  '/modals.js',
  '/my-reservations.js',
  '/navigation.js',
  '/permissions.js',
  '/render-admin.js',
  '/render-home.js',
  '/render-misc.js',
  '/render-profile.js',
  '/render-queue.js',
  '/reports.js',
  '/reserve-form.js',
  '/reservations.js',
  '/service-worker.js',
  '/setup-admin.js',
  '/setup-auth.js',
  '/setup-participants.js',
  '/setup-reports.js',
  '/slot-actions.js',
  '/state.js',
  '/toast.js',
  '/user-status.js',
  '/utils.js',
  '/style.css',
  '/assets/manifest.json',
  '/assets/192x192.png',
  '/assets/512x512.png'
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) =>
        console.warn('[SW] No se pudieron cachear todos los assets:', err)
      )
    ).then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('predicapp-') && k !== CACHE_STATIC)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url         = new URL(request.url);

  // Ignorar peticiones a Firebase y APIs externas
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('gstatic.com')     ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    return;
  }

  // HTML: Network First
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Assets JS/CSS/imágenes: Cache First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(request, clone));
        }
        return response;
      });
    })
  );
});
