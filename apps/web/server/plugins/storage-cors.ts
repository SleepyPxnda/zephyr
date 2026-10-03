import { allowBrowserReads } from '../lib/storage'

/** Sets the bucket's CORS rule once at startup, so the browser can load music (M9). */
export default defineNitroPlugin(() => {
  const { s3, bucket } = useS3()
  allowBrowserReads(s3, bucket).catch((e: unknown) => {
    console.error('[storage] could not set the bucket CORS rule', e)
  })
})
