const CACHE = 'valuation-static-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys()
  await Promise.all(names.filter(name => name.startsWith('valuation-') && name !== CACHE).map(name => caches.delete(name)))
  await self.clients.claim()
})()))

self.addEventListener('fetch', event => {
  const {request} = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  event.respondWith((async () => {
    try {
      const response = await fetch(request)
      if (response.ok && response.type === 'basic' && (request.destination === 'document' || ['script', 'style', 'image', 'manifest'].includes(request.destination))) {
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, response.clone())))
      }
      return response
    } catch {
      const cached = await caches.match(request)
      if (cached) return cached
      throw new Error('Offline and no cached response is available')
    }
  })())
})
