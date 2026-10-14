import { serverEnv } from '../lib/env'
import { log } from '../lib/log'
import { allowBrowserReads, createS3 } from '../lib/storage'

/** Sets the bucket's CORS rule once at startup, so the browser can load music (M9). */
export default defineNitroPlugin(() => {
  const env = serverEnv()
  // STORAGE=local serves files from our own origin, no CORS needed
  if (env.STORAGE !== 's3') return
  allowBrowserReads(createS3(env), env.S3_BUCKET).catch((e: unknown) => {
    log.error('could not set the bucket CORS rule', { err: e })
  })
})
