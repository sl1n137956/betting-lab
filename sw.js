/* Verdict app-shell cache. Never caches live API responses.
   v2: HTML pages are network-first with cache: 'no-store' so a new
   deploy is not stuck behind GitHub Pages or a stale iOS shell. */
const CACHE = 'betting-lab-shell-v213';
// v47: the photo reader (Tesseract.js + its English model from jsDelivr) is cached once so later photo checks start fast
const OCR_CACHE = 'verdict-ocr-v1';
function isOcrAsset(url){ return url.hostname === 'cdn.jsdelivr.net' && /tesseract/i.test(url.pathname); }
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-512-maskable.png', './apple-touch-icon.png', './favicon-32.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async u => {
      try{
        const r = await fetch(u, {cache:'no-store'});
        if (r.ok) await cache.put(u, r);
      }catch(e){}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== OCR_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isAppShell(url){
  if (url.origin !== self.location.origin) return false;
  const file = url.pathname.split('/').pop();
  if (!file || file === 'index.html' || url.pathname.endsWith('/')) return true;
  return file === 'manifest.webmanifest' || file === 'apple-touch-icon.png' || /\.png$/.test(file);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Cross-origin requests are ESPN, Open-Meteo, Polymarket, The Odds API, etc.
  // Leave them to the network and never put the responses in this cache.
  if (isOcrAsset(url)){
    event.respondWith((async () => {
      const c = await caches.open(OCR_CACHE);
      const hit = await c.match(req.url);
      if (hit) return hit;
      const fresh = await fetch(req);
      if (fresh && fresh.ok && fresh.type !== 'opaque') c.put(req.url, fresh.clone());
      return fresh;
    })());
    return;
  }
  if (!isAppShell(url)) return;
  event.respondWith((async () => {
    const isPage = !url.pathname.split('/').pop() || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    if (isPage){
      try{
        const fresh = await fetch(req, {cache:'no-store'});
        if (fresh && fresh.ok){
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          cache.put(new Request('./index.html', {cache:'reload'}), fresh.clone());
        }
        return fresh;
      }catch(e){
        return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
      }
    }
    const cached = await caches.match(req);
    if (cached) return cached;
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    if (list[0]) return list[0].focus();
    return clients.openWindow('./');
  }));
});
