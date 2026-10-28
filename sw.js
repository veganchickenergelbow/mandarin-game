// Mandarin Game service worker: cache-first app shell. BUMP `VERSION` on every deploy; old caches are deleted on activate.
const VERSION = 'mg-v2';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'tone-test.html',
  'js/main.js', 'js/store.js', 'js/speech.js', 'js/draw.js', 'js/ui.js',
  'js/screens/home.js', 'js/screens/warmup.js', 'js/screens/scene.js', 'js/screens/debrief.js',
  'js/core/pitch.js', 'js/core/pinyin.js', 'js/core/sandhi.js', 'js/core/syllables.js', 'js/core/match.js', 'js/core/progress.js',
  'data/scenes/index.json', 'data/scenes/work_huang_price.json', 'data/scenes/life_hawker_chicken_rice.json'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));   // one miss must not abort install
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('mg-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    let hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.status === 200) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') hit = await cache.match('index.html');
      if (hit) return hit;
      throw err;
    }
  })());
});
