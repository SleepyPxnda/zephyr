import { sql } from 'drizzle-orm'
import { log } from '../lib/log'

/** Liveness and readiness for Docker and monitoring: 200 once the database answers, else 503. */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  try {
    await useDb().execute(sql`select 1`)
    return { status: 'ok' }
  } catch (e) {
    log.error('health check: database unreachable', { err: e })
    setResponseStatus(event, 503)
    return { status: 'unavailable' }
  }
})
