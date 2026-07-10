const CACHE = 'shot-scout-v1'
const SHELL = ['/shot-scout/', '/shot-scout/index.html', '/shot-scout/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  // HTML은 network-first: sw.js가 배포 간 안 바뀌어도 새 index.html을 받게 함
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request).then(r => r ?? caches.match('/shot-scout/')))
    )
    return
  }

  // 해시된 에셋 등은 cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
    })
  )
})
