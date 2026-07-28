/*
 * Lobby of Stories — service worker.
 *
 * Deliberately conservative: it exists to make the site installable and to make
 * repeat loads fast, not to build an offline reader. Page HTML is never cached,
 * because a signed-in reader's pages carry their own library and progress and a
 * shared cache would hand one visitor another's rendering. Only content-hashed
 * build output and the app icons — neither of which is user-specific — are
 * stored.
 */

const VERSION = 'los-v1'
const ASSET_CACHE = `${VERSION}-assets`

/** Same-origin paths safe to serve straight from the cache. */
const CACHEABLE = [
  /^\/_next\/static\//,
  /^\/_next\/image/,
  /^\/app-icon-[\w-]+\.png$/,
  /^\/apple-icon/,
  /^\/icon/,
  /^\/manifest\.webmanifest$/,
]

/** Never intercepted: auth, APIs and the admin console must always hit the network. */
const BYPASS = [/^\/api\//, /^\/sign-in/, /^\/sign-up/, /^\/admin/]

const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Offline — Lobby of Stories</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;padding:2rem;
       background:#1a1714;color:#f5f0e8;font-family:Georgia,serif;text-align:center}
  p.k{font-size:.65rem;letter-spacing:.3em;text-transform:uppercase;color:#c9a84c;margin:0 0 1.5rem}
  h1{font-size:1.75rem;font-weight:400;margin:0 0 1rem}
  p.m{color:#7a746a;font-size:.9rem;line-height:1.8;margin:0 0 2rem}
  button{font:inherit;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;padding:10px 28px;
         color:#c9a84c;background:transparent;border:1px solid #c9a84c;cursor:pointer}
</style>
</head>
<body>
  <div>
    <p class="k">Lobby of Stories</p>
    <h1>You&rsquo;re offline</h1>
    <p class="m">The lobby needs a connection to fetch your stories.<br>Reconnect and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`

const isCacheable = (path) => CACHEABLE.some((re) => re.test(path))
const isBypassed = (path) => BYPASS.some((re) => re.test(path))

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit

  const response = await fetch(request)
  // Opaque and error responses are passed through without being stored.
  if (response.ok && response.type === 'basic') {
    cache.put(request, response.clone())
  }
  return response
}

async function networkOnlyWithOfflinePage(request) {
  try {
    return await fetch(request)
  } catch {
    return new Response(OFFLINE_PAGE, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isBypassed(url.pathname)) return

  if (isCacheable(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Navigations always go to the network; the offline card is the only fallback.
  if (request.mode === 'navigate') {
    event.respondWith(networkOnlyWithOfflinePage(request))
  }
})
