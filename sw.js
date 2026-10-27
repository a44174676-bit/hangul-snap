const CACHE='hangul-snap-shell-v1-visionfix-20261028';
const SHELL=['/','/index.html','/styles.css','/js/app.js','/js/data.js','/js/hangul.js','/js/dictionary.js','/assets/icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const r=event.request;if(r.method!=='GET'||r.url.includes('/.netlify/')||r.url.includes('/api/')||new URL(r.url).origin!==self.location.origin)return;event.respondWith(fetch(r).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy));}return res;}).catch(()=>caches.match(r).then(m=>m||caches.match('/index.html'))));});
