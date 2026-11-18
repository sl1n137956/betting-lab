/* Betting Lab app-shell cache. Never caches live API responses. */
const CACHE = 'betting-lab-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
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
  if (!isAppShell(url)) return;
  event.respondWith((async () => {
    const isPage = !url.pathname.split('/').pop() || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    if (isPage){
      try{
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        cache.put(new Request('./index.html', {cache:'reload'}), fresh.clone());
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
