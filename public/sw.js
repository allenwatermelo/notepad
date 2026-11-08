// Retire the old offline cache. It can serve a cached page without Vercel's
// authentication gate, while its uncached JavaScript assets are redirected
// to Vercel's sign-in service and fail as cross-origin module requests.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => event.waitUntil((async () => {
  const oldCaches = await caches.keys()
  await Promise.all(oldCaches.filter(name => name.startsWith('little-bloom-')).map(name => caches.delete(name)))
  await self.registration.unregister()
})()))
