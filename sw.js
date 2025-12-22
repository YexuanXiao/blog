const CACHE_VERSION = 'v1.1'
const CACHE_NAME = `sw-cache-${CACHE_VERSION}`

function checkExt(path) {
    const EXT_WHITE_LIST = [
        '.js', '.css', '.json', '.txt', '.png', '.jpg', '.jpeg', '.svg', '.avif', '.woff2', '.gif', '.moc', '.mtn', '.webmanifest'
    ]
    for (const ext of EXT_WHITE_LIST) {
        if (path.endsWith(ext))
            return true
    }

    return false
}

function shouldCache(request) {
    const SITE_WHITE_LIST = [
        'static.nykz.org'
    ]
    const url = new URL(request.url)
    if (url.hostname === self.location.hostname)
        return checkExt(url.pathname)

    for (const domain of SITE_WHITE_LIST) {
        if (url.hostname === domain)
            return checkExt(url.pathname)
    }

    return false
}

self.addEventListener('install', event => {
    event.waitUntil(
        (async () => {
            await self.skipWaiting()
        })()
    )
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
