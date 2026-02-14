/* Fractions Arcade - Offline-first Service Worker */

importScripts("assets/js/fractions_games.js");

const VERSION = "v2026-02-14-adventure-hq-profiles-back-button-clean-new-player";
const CACHE_NAME = `fractions-arcade-${VERSION}`;

const CORE_ASSETS = [
  "./",
  "index.html",
  "settings.html",
  "manifest.webmanifest",
  "assets/css/arcade.css",
  "assets/css/mission.css",
  "assets/js/fractions_games.js",
  "assets/js/fractions_app.js",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png"
];

const GAME_URLS = (typeof FRACTIONS_ARCADE_GAMES !== "undefined")
  ? FRACTIONS_ARCADE_GAMES.map((g) => g.href)
  : [];

const PRECACHE_URLS = CORE_ASSETS.concat(GAME_URLS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k.startsWith("fractions-arcade-") && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, copy).catch(() => {});
          }).catch(() => {});
          return resp;
        })
        .catch(() => {
          if (req.mode === "navigate") return caches.match("index.html");
          return cached;
        });
    })
  );
});
