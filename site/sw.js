const CACHE = 'hangul-snap-v2.1-tray-20261113';
const SHELL = [
  '/', '/index.html', '/styles.css', '/brand.css', '/manifest.json',
  '/js/main.js', '/js/api.js', '/js/capture-copy.js', '/js/i18n.js', '/js/i18n-extra.js',
  '/js/jamo-data.js', '/js/missions.js', '/js/spatial.js', '/js/speech.js', '/js/vocabulary.js',
  '/assets/hanmo/welcome.svg', '/assets/hanmo/success.svg', '/assets/hanmo/thinking.svg',
  '/assets/HANMO_FINAL_CENTERED_192.png', '/assets/HANMO_FINAL_CENTERED_512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('hangul-snap-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('range')
    || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;

  const shellAsset = request.mode === 'navigate' || SHELL.includes(url.pathname);
  if (!shellAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = request.mode === 'navigate' ? '/index.html' : url.pathname;
    try {
      const response = await fetch(request, {cache:'no-cache'});
      if (response.ok && response.status === 200) {
        await cache.put(key,response.clone()).catch(() => {});
      }
      return response;
    } catch {
      return await cache.match(key) || new Response('', {status:503});
    }
  })());
});
