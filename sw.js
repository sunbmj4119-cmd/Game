/* 오프라인 캐시: 한 번 접속하면 비행기 모드에서도 플레이 가능 */
var CACHE = 'jeonyeok-v3';
var ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/art.js', './js/data/chars.js', './js/data/cards.js', './js/data/cards2.js', './js/data/cards3.js', './js/data/items.js',
  './js/data/world.js', './js/data/shop.js', './js/core.js', './js/meta.js', './js/rank.js', './js/audio.js', './js/minigames.js', './js/ui.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
