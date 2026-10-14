import { timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { files } from '../../db/schema'
import { serverEnv } from '../../lib/env'
import { localPath, STORAGE_KEY } from '../../lib/storage'

/**
 * Serves a stored file with STORAGE=local, in place of the signed S3 address: the address from
 * `signedUrl` carries the expiry and an HMAC over key and expiry, which is the access check.
 */
export default defineEventHandler(async (event) => {
  const notFound = () => problem(404, 'not_found', 'Die Datei wurde nicht gefunden.')
  const env = serverEnv()
  if (env.STORAGE !== 'local') throw notFound()
  const key = getRouterParam(event, 'key') ?? ''
  const { exp, sig } = getQuery(event)
  const expires = Number(exp)
  const valid =
    STORAGE_KEY.test(key) &&
    typeof sig === 'string' &&
    expires * 1000 > Date.now() &&
    sig.length === 64 &&
    timingSafeEqual(Buffer.from(sig), Buffer.from(localSignature(key, expires)))
  if (!valid) throw notFound()

  const [file] = await useDb()
    .select({ mime: files.mime })
    .from(files)
    .where(eq(files.storageKey, key))
  const body = file ? await readFile(localPath(env.STORAGE_DIR, key)).catch(() => null) : null
  if (!file || !body) throw notFound()
  setResponseHeaders(event, { 'Content-Type': file.mime, 'Cache-Control': 'private, max-age=300' })
  return body
})
