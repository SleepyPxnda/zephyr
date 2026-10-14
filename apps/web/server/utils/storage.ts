import { createHmac } from 'node:crypto'
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { serverEnv } from '../lib/env'
import { createS3, createStore, type ObjectStore } from '../lib/storage'

let store: ObjectStore | undefined
let client: S3Client | undefined

export function useStore(): ObjectStore {
  store ??= createStore(serverEnv())
  return store
}

/** Signature of a local download address (STORAGE=local), keyed with the session password. */
export function localSignature(key: string, exp: number): string {
  return createHmac('sha256', useRuntimeConfig().session.password)
    .update(`${key}:${exp}`)
    .digest('hex')
}

/** Short-lived download address for a stored object (SPEC: 5 minutes). */
export async function signedUrl(key: string, seconds = 300): Promise<string> {
  const env = serverEnv()
  if (env.STORAGE === 'local') {
    const exp = Math.floor(Date.now() / 1000) + seconds
    return `/api/storage/${key}?exp=${exp}&sig=${localSignature(key, exp)}`
  }
  client ??= createS3(env)
  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: seconds,
  })
}
