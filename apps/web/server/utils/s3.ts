import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { serverEnv } from '../lib/env'
import { createS3 } from '../lib/storage'

let client: S3Client | undefined

export function useS3(): { s3: S3Client; bucket: string } {
  client ??= createS3(serverEnv())
  return { s3: client, bucket: serverEnv().S3_BUCKET }
}

/** Short-lived download address for a stored object (SPEC: 5 minutes). */
export async function signedUrl(key: string, seconds = 300): Promise<string> {
  const { s3, bucket } = useS3()
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: seconds,
  })
}
