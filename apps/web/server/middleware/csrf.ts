/**
 * CSRF protection for changing requests (SPEC "Sicherheit"): besides the SameSite=Lax session
 * cookie, a POST/PUT/PATCH/DELETE to the API must come from our own origin. Browsers always
 * send `Origin` (or `Sec-Fetch-Site`) on such requests.
 */
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  if (SAFE.has(event.method) || !event.path.startsWith('/api/')) return
  const own = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
  const origin = getRequestHeader(event, 'origin')
  if (origin ? origin === own : getRequestHeader(event, 'sec-fetch-site') === 'same-origin') return
  throw problem(403, 'csrf', 'Anfrage von fremder Herkunft abgelehnt.')
})
