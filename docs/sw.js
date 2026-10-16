// Service worker : jeu jouable hors-ligne après la première visite.
// Pages et manifestes : réseau d'abord (les mises à jour arrivent tout de suite), cache si hors-ligne.
// Images, sons, code : cache d'abord, rafraîchi en arrière-plan.
const CACHE = 'gardiens-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const fresh = e.request.mode === 'navigate' || url.pathname.endsWith('.json') || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('/');
  e.respondWith(caches.open(CACHE).then(async (c) => {
    if (fresh) {
      try { const r = await fetch(e.request, { cache: 'no-store' }); if (r.ok) c.put(e.request, r.clone()); return r; }
      catch { return (await c.match(e.request)) || Response.error(); }
    }
    const hit = await c.match(e.request);
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
