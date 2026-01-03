const CACHE_VERSION = 'v1.6'
const CACHE_NAME = `sw-cache-${CACHE_VERSION}`

function checkExt(path) {
    const ext_white_list = [
        '.js', '.css', '.json', '.txt', '.png', '.jpg', '.jpeg', '.svg', '.avif', '.woff2', '.gif', '.moc', '.mtn', '.webmanifest'
    ]
    for (const ext of ext_white_list) {
        if (path.endsWith(ext))
            return true
    }

    return false
}

function shouldCache(request) {
    const site_white_list = [
        'static.nykz.org'
    ]
    const url = new URL(request.url)
    if (url.hostname === self.location.hostname)
        return checkExt(url.pathname)

    for (const hostname of site_white_list) {
        if (url.hostname === hostname)
            return checkExt(url.pathname)
    }

    return false
}

self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys()
            await Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
            await self.clients.claim()
        })()
    )
})

self.addEventListener('fetch', event => {
    const { request } = event
    if (request.method !== 'GET' || !shouldCache(request))
        return

    event.respondWith(
        (async () => {
            const cached = await caches.match(request)
            if (cached)
                return cached

            const networkResp = await fetch(request)
            if (!networkResp || networkResp.status !== 200)
                return networkResp

            const respToCache = networkResp.clone()
            const cache = await caches.open(CACHE_NAME)
            await cache.put(request, respToCache)

            return networkResp
        })()
    )
})
