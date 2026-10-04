import {
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { ServerEnv } from './env'

/**
 * S3 client for any S3-compatible store (Hetzner Object Storage, ...). Checksums only
 * where the API requires them: the SDK's newer default (CRC32 on every request) is not understood by
 * every non-AWS provider.
 */
export function createS3(env: ServerEnv): S3Client {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

export async function putObject(
  s3: S3Client,
  bucket: string,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  )
}

/**
 * Lets the browser read objects through signed addresses (music is decoded with Web Audio, which
 * needs CORS). Only GET/HEAD; the signature in the address stays the access check.
 */
export async function allowBrowserReads(s3: S3Client, bucket: string): Promise<void> {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ['GET', 'HEAD'],
            AllowedOrigins: ['*'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  )
}

/** Removes objects, at most 1000 per request (S3 limit). */
export async function deleteObjects(s3: S3Client, bucket: string, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000)
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    )
}

export async function bucketReady(s3: S3Client, bucket: string): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
    return true
  } catch {
    return false
  }
}
