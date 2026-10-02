import { getRequestURL, send, setResponseHeader, setResponseStatus, type H3Error } from 'h3'
import type { NitroErrorHandler } from 'nitropack'

/**
 * API errors as RFC 9457 problem documents. Other paths fall through to Nuxt's error page.
 * Unexpected errors are logged and reported without internals.
 */
const handler: NitroErrorHandler = async (error, event) => {
  const url = getRequestURL(event)
  if (!url.pathname.startsWith('/api/')) return
  const e = error as Partial<H3Error>
  const status = e.statusCode ?? 500
  const expected = status < 500 && !!e.statusCode
  if (!expected) console.error(error)
  const data =
    expected && e.data && typeof e.data === 'object' ? (e.data as Record<string, unknown>) : {}
  const body = {
    type: 'about:blank',
    title: e.statusMessage || statusTitle(status),
    status,
    ...(expected && e.message && e.message !== e.statusMessage ? { detail: e.message } : {}),
    instance: url.pathname,
    ...data,
  }
  setResponseStatus(event, status)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  await send(event, JSON.stringify(body), 'application/problem+json')
}

function statusTitle(status: number): string {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    412: 'Precondition Failed',
    413: 'Content Too Large',
    415: 'Unsupported Media Type',
    422: 'Unprocessable Content',
    428: 'Precondition Required',
  }
  return titles[status] ?? (status >= 500 ? 'Internal Server Error' : 'Error')
}

export default handler
