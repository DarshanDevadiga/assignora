/**
 * Lightweight user-scoped data cache with TTL, SWR helpers, in-flight request
 * deduplication, prefix invalidation, and synchronous logout purge.
 */

const cacheStore = new Map()
const inFlightStore = new Map()
const clearListeners = new Set()

const DEFAULT_TTL_MS = 45 * 1000 // 45 seconds

/**
 * Retrieve cached data synchronously if present and valid (or stale when allowStale is true).
 */
export function getCached(key, { allowStale = false } = {}) {
  if (!key) return null
  const entry = cacheStore.get(key)
  if (!entry) return null

  const isExpired = Date.now() > entry.expiresAt
  if (isExpired && !allowStale) {
    return null
  }

  return entry.data
}

/**
 * Store data in the in-memory cache with an explicit TTL.
 */
export function setCached(key, data, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return data
  const now = Date.now()
  cacheStore.set(key, {
    data,
    cachedAt: now,
    expiresAt: now + Math.max(0, ttlMs),
  })
  return data
}

/**
 * Deduplicate concurrent requests for the same key and serve fresh cached results within TTL.
 */
export async function fetchWithCache(key, fetcher, { ttlMs = DEFAULT_TTL_MS, forceRefresh = false } = {}) {
  if (!key || typeof fetcher !== 'function') {
    return fetcher()
  }

  if (!forceRefresh) {
    const existing = getCached(key, { allowStale: false })
    if (existing !== null && existing !== undefined) {
      return existing
    }

    if (inFlightStore.has(key)) {
      return inFlightStore.get(key)
    }
  }

  const requestPromise = Promise.resolve()
    .then(() => fetcher())
    .then((result) => {
      setCached(key, result, ttlMs)
      inFlightStore.delete(key)
      return result
    })
    .catch((err) => {
      inFlightStore.delete(key)
      throw err
    })

  if (!forceRefresh) {
    inFlightStore.set(key, requestPromise)
  }

  return requestPromise
}

/**
 * Delete a single cached entry and any in-flight tracker for that key.
 */
export function invalidateCacheKey(key) {
  if (!key) return
  cacheStore.delete(key)
  inFlightStore.delete(key)
}

/**
 * Delete all cached entries whose key starts with any provided prefix.
 */
export function invalidateCachePrefix(...prefixes) {
  const flatPrefixes = prefixes.flat().filter(Boolean)
  if (flatPrefixes.length === 0) return

  for (const key of cacheStore.keys()) {
    if (flatPrefixes.some((prefix) => key.startsWith(prefix))) {
      cacheStore.delete(key)
    }
  }
  for (const key of inFlightStore.keys()) {
    if (flatPrefixes.some((prefix) => key.startsWith(prefix))) {
      inFlightStore.delete(key)
    }
  }
}

/**
 * Register a module-local cache clear callback invoked during global logout reset.
 */
export function subscribeCacheClear(fn) {
  if (typeof fn !== 'function') return () => {}
  clearListeners.add(fn)
  return () => {
    clearListeners.delete(fn)
  }
}

/**
 * Purge all application caches and external cache listeners synchronously on logout or account switch.
 */
export function clearAllAppCaches() {
  cacheStore.clear()
  inFlightStore.clear()
  clearListeners.forEach((fn) => {
    try {
      fn()
    } catch {
      // Ignore cleanup listener errors during teardown
    }
  })
}
