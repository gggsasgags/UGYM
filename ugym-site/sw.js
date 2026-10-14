// UGYM - cache do app para funcionar sem internet.
// Os dados ficam no localStorage do aparelho, o service worker só guarda a casca.
const CACHE = 'ugym-v6';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './supabase.js', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // navegação: tenta a rede, cai para o cache quando estiver sem sinal
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && r.status === 200 && r.type === 'basic') {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return r;
    }).catch(() => hit))
  );
});
