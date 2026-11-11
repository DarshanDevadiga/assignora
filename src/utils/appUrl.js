/**
 * Application URL Helper
 * Centralizes the resolution of the application base URL and authentication callback URLs.
 * Ensures production email verification and callback links always use the deployed application URL
 * (https://assignora-cyan.vercel.app) while maintaining configurable local development support.
 */

const DEFAULT_PRODUCTION_URL = 'https://assignora-cyan.vercel.app'

/**
 * Returns the base application URL.
 * Priority:
 * 1. Explicit VITE_APP_URL environment variable if defined and non-empty.
 * 2. If running in production (or on a non-localhost domain), defaults to https://assignora-cyan.vercel.app.
 * 3. In local development on localhost/127.0.0.1, uses window.location.origin.
 * 4. Fallback to https://assignora-cyan.vercel.app.
 */
export function getAppUrl() {
  const envUrl = (
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL
      ? import.meta.env.VITE_APP_URL
      : typeof process !== 'undefined' && process.env?.VITE_APP_URL
      ? process.env.VITE_APP_URL
      : ''
  ).trim().replace(/\/+$/, '')

  if (envUrl) {
    return envUrl
  }

  // Detect non-localhost browser runtime
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
    if (!isLocalhost && window.location.origin) {
      return window.location.origin.replace(/\/+$/, '')
    }
  }

  // Detect production build
  const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD
  if (isProd) {
    return DEFAULT_PRODUCTION_URL
  }

  // Local development fallback
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '')
  }

  return DEFAULT_PRODUCTION_URL
}

/**
 * Constructs an absolute authentication redirect URL for Supabase callbacks.
 * Guarantees HTTPS protocol for production and prevents empty or localhost redirects in production.
 *
 * @param {string} path - Callback path (default: '/auth/callback')
 * @returns {string} - Fully qualified redirect URL
 */
export function getAuthRedirectUrl(path = '/auth/callback') {
  const baseUrl = getAppUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  let fullUrl = `${baseUrl}${cleanPath}`

  // Enforce HTTPS in production or whenever base URL is assignora-cyan.vercel.app
  if (
    fullUrl.includes('assignora-cyan.vercel.app') ||
    (typeof import.meta !== 'undefined' && import.meta.env?.PROD)
  ) {
    if (fullUrl.startsWith('http://') && !fullUrl.startsWith('http://localhost') && !fullUrl.startsWith('http://127.0.0.1')) {
      fullUrl = fullUrl.replace(/^http:\/\//, 'https://')
    }
  }

  return fullUrl
}
