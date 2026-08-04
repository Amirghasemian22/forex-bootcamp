const CACHE_NAME = 'fx-bootcamp-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for the app shell so the app fully works offline after first load.
// Anything not in the shell (e.g. font/API calls) falls back to the network,
// and quietly fails if there's no connection (the app doesn't depend on them).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});

// Best-effort daily check for due reviews, only fires if the browser grants
// Periodic Background Sync (mainly Chrome on Android/desktop as an installed PWA).
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-review-check') {
    event.waitUntil(checkReviewsAndNotify());
  }
});

async function checkReviewsAndNotify() {
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('forexBootcampDB', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const sessions = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get('sessions');
      req.onsuccess = () => resolve(req.result ? JSON.parse(req.result) : {});
      req.onerror = () => reject(req.error);
    });
    const today = new Date().toISOString().slice(0, 10);
    let due = 0;
    Object.values(sessions).forEach((s) => {
      (s.reviews || []).forEach((r) => { if (!r.done && r.date <= today) due++; });
    });
    if (due > 0) {
      await self.registration.showNotification('یادآور بوت‌کمپ فارکس', {
        body: due + ' مرور برای امروز دارید.',
        icon: 'icon-192.png'
      });
    }
  } catch (e) {
    // silent — best-effort only
  }
}
