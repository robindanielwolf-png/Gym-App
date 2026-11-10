// Service Worker: legt alle App-Dateien in einen Cache und liefert sie offline aus.
// Version und Stand immer gemeinsam ändern mit js/version.js und den versionierten
// Modul-URLs (?v=) samt CSP-Hash der Import-Map in index.html.
const VERSION = '0.2.0';
// Stand innerhalb einer Version: bei jeder Dateiänderung erhöhen, damit der Cache sicher neu lädt.
const STAND = 2;

const SCOPE_PFAD = new URL(self.registration.scope).pathname;
const IST_VORSCHAU = SCOPE_PFAD.endsWith('/vorschau/');

// Vorschau und Live teilen sich die Domain und damit den Cache-Speicher:
// Jeder Bereich räumt nur Caches mit seinem eigenen Präfix auf.
const CACHE_PRAEFIX = IST_VORSCHAU ? 'gym-tracker-vorschau-' : 'gym-tracker-live-';
const CACHE_NAME = `${CACHE_PRAEFIX}${VERSION}-${STAND}`;

const DATEIEN = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/version.js',
  './js/umgebung.js',
  './js/startdaten.js',
  './js/db.js',
  './js/sicherung.js',
  './js/format.js',
  './js/ui.js',
  './js/tabs.js',
  './js/logik.js',
  './js/training.js',
  './js/satz.js',
  './js/uebungen.js',
  './js/sicherung-sheet.js',
  './icons/app-icon-180.png',
  './icons/app-icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(DATEIEN.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(
      namen.filter((n) => n.startsWith(CACHE_PRAEFIX) && n !== CACHE_NAME).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET') return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PFAD)) return;
  // Der Live-Worker greift nie in die Vorschau ein.
  if (!IST_VORSCHAU && url.pathname.startsWith(SCOPE_PFAD + 'vorschau/')) return;
  event.respondWith(antworte(anfrage));
});

async function antworte(anfrage) {
  const cache = await caches.open(CACHE_NAME);
  if (anfrage.mode === 'navigate') {
    const seite = await cache.match('./index.html');
    if (seite) return frisch(seite);
  }
  const treffer = await cache.match(anfrage, { ignoreSearch: true });
  return treffer ? frisch(treffer) : fetch(anfrage);
}

// Der Browser soll Antworten nicht selbst zwischenspeichern, sonst bleibt nach einem
// Update alter Code im Speicher (WebKit). Offline liefert ohnehin dieser Cache.
function frisch(antwort) {
  const kopf = new Headers(antwort.headers);
  kopf.set('Cache-Control', 'no-cache');
  return new Response(antwort.body, { status: antwort.status, statusText: antwort.statusText, headers: kopf });
}
